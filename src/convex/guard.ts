import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

export type AdminContext = {
  userId: Id<"users">;
  schoolId: Id<"schools">;
};

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
