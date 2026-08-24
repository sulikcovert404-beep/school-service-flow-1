import { getAuthUserId } from "@convex-dev/auth/server";
import { Infer, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { roleValidator } from "./schema";

export type Role = Infer<typeof roleValidator>;

export type AdminContext = {
  userId: Id<"users">;
  schoolId: Id<"schools">;
};

export type SessionUser = {
  userId: Id<"users">;
  role: Role;
  schoolId: Id<"schools"> | null;
  driverProfileId: Id<"drivers"> | null;
  parentProfileId: Id<"parents"> | null;
};

/**
 * Resolve the signed-in user (or null). Tenant context always comes from the
 * session — never from client-sent IDs.
 */
export async function getSessionUser(ctx: QueryCtx): Promise<SessionUser | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (!user || !user.role) return null;
  // Platform-level deactivation (Super Admin) blocks every session guard.
  if (user.isActive === false) return null;
  return {
    userId,
    role: user.role,
    schoolId: user.schoolId ?? null,
    driverProfileId: user.driverProfileId ?? null,
    parentProfileId: user.parentProfileId ?? null,
  };
}

/**
 * Tenant context is ALWAYS derived from the authenticated session — never from
 * the client. Deny by default: unauthenticated users and non-admin roles are rejected.
 */
export async function requireSchoolAdmin(ctx: QueryCtx): Promise<AdminContext> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("UNAUTHENTICATED");
  }
  const user = await ctx.db.get(userId);
  if (!user || (user.role !== "school_admin" && user.role !== "admin")) {
    throw new Error("FORBIDDEN");
  }
  if (!user.schoolId) {
    throw new Error("NO_SCHOOL");
  }
  return { userId, schoolId: user.schoolId };
}

/** Same check, for mutations. */
export async function requireSchoolAdminMutation(
  ctx: MutationCtx,
): Promise<AdminContext> {
  return requireSchoolAdmin(ctx);
}

/**
 * Platform-level guard: only role=admin (Super Admin). No tenant context —
 * this role deliberately crosses tenant boundaries for platform management.
 */
export async function requireSuperAdmin(
  ctx: QueryCtx,
): Promise<{ userId: Id<"users"> }> {
  const session = await getSessionUser(ctx);
  if (!session) throw new Error("UNAUTHENTICATED");
  if (session.role !== "admin") throw new Error("FORBIDDEN");
  return { userId: session.userId };
}

/** Audit row for a Super Admin action (no tenant context). */
export async function writePlatformAudit(
  ctx: MutationCtx,
  actorUserId: Id<"users">,
  action: string,
  resourceType: string,
  summary: string,
  resourceId?: string,
  schoolId?: Id<"schools">,
) {
  await ctx.db.insert("auditLogs", {
    schoolId,
    actorUserId,
    action,
    resourceType,
    resourceId,
    summary,
    createdAt: Date.now(),
  });
}

/**
 * Actor for Parent App reads: a real parent user, or a School Admin previewing
 * a parent of their own tenant (parentId argument required for preview).
 */
export async function requireParentActor(
  ctx: QueryCtx,
  requestedParentId: Id<"parents"> | null,
): Promise<{ parentId: Id<"parents">; schoolId: Id<"schools">; isParent: boolean }> {
  const session = await getSessionUser(ctx);
  if (!session) throw new Error("UNAUTHENTICATED");
  if (session.role === "parent") {
    if (!session.parentProfileId || !session.schoolId) throw new Error("FORBIDDEN");
    return { parentId: session.parentProfileId, schoolId: session.schoolId, isParent: true };
  }
  if (
    (session.role === "school_admin" || session.role === "admin") &&
    session.schoolId &&
    requestedParentId
  ) {
    const parent = await ctx.db.get(requestedParentId);
    if (!parent || parent.schoolId !== session.schoolId) throw new Error("FORBIDDEN");
    return { parentId: requestedParentId, schoolId: session.schoolId, isParent: false };
  }
  throw new Error("FORBIDDEN");
}

/**
 * Actor for driver-app writes: either a real driver user linked to the given
 * service's driver profile, or a School Admin of the same tenant (preview
 * mode). Returns the acting context; throws when neither applies.
 */
export async function requireDriverActor(
  ctx: QueryCtx,
  serviceDriverId: Id<"drivers">,
  schoolId: Id<"schools">,
): Promise<AdminContext & { isDriver: boolean }> {
  const session = await getSessionUser(ctx);
  if (!session) throw new Error("UNAUTHENTICATED");
  if (session.schoolId !== schoolId) throw new Error("FORBIDDEN");
  if (session.role === "driver") {
    if (!session.driverProfileId || session.driverProfileId !== serviceDriverId) {
      throw new Error("FORBIDDEN");
    }
    return { userId: session.userId, schoolId, isDriver: true };
  }
  if (session.role === "school_admin" || session.role === "admin") {
    return { userId: session.userId, schoolId, isDriver: false };
  }
  throw new Error("FORBIDDEN");
}

/**
 * Fixed-window rate limiter (DB-backed, works across serverless instances).
 * Throws RATE_LIMITED when the caller exceeds `limit` requests per window.
 */
export async function checkRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!row || now - row.windowStart >= windowMs) {
    if (row) await ctx.db.delete(row._id);
    await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    return;
  }
  if (row.count >= limit) throw new Error("RATE_LIMITED");
  await ctx.db.patch(row._id, { count: row.count + 1 });
}

/** Append an audit log row for a sensitive operation. */
export async function writeAudit(
  ctx: MutationCtx,
  actor: AdminContext,
  action: string,
  resourceType: string,
  summary: string,
  resourceId?: string,
) {
  await ctx.db.insert("auditLogs", {
    schoolId: actor.schoolId,
    actorUserId: actor.userId,
    action,
    resourceType,
    resourceId,
    summary,
    createdAt: Date.now(),
  });
}
