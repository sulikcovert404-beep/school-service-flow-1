import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { checkRateLimit, requireSuperAdmin, writePlatformAudit } from "./guard";
import { roleValidator } from "./schema";

const TEHRAN_OFFSET_MS = 3.5 * 3600_000;

function startOfTehranDay(now: number) {
  return Math.floor((now + TEHRAN_OFFSET_MS) / 86_400_000) * 86_400_000 - TEHRAN_OFFSET_MS;
}

async function schoolName(ctx: QueryCtx, schoolId: Id<"schools"> | undefined) {
  if (!schoolId) return null;
  const s = await ctx.db.get(schoolId);
  return s?.name ?? null;
}

// ---------------------------------------------------------------------------
// Global overview
// ---------------------------------------------------------------------------

/**
 * Platform-level (Super Admin) overview. Guarded strictly by role=admin —
 * school tenants are never visible to other tenants' admins.
 */
export const globalOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const schools = await ctx.db.query("schools").collect();
    const dayStart = startOfTehranDay(Date.now());

    const rows = await Promise.all(
      schools.map(async (school) => {
        const [students, drivers, vehicles, services, todayEvents, admins] = await Promise.all([
          ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", school._id)).collect(),
          ctx.db.query("drivers").withIndex("by_school", (q) => q.eq("schoolId", school._id)).collect(),
          ctx.db.query("vehicles").withIndex("by_school", (q) => q.eq("schoolId", school._id)).collect(),
          ctx.db.query("services").withIndex("by_school", (q) => q.eq("schoolId", school._id)).collect(),
          ctx.db
            .query("attendanceEvents")
            .withIndex("by_school_time", (q) =>
              q.eq("schoolId", school._id).gte("serverTimestamp", dayStart),
            )
            .collect(),
          ctx.db.query("users").collect(),
        ]);
        return {
          _id: school._id,
          name: school.name,
          city: school.city ?? null,
          phone: school.phone ?? null,
          isActive: school.isActive,
          createdAt: school.createdAt,
          counts: {
            students: students.filter((s) => s.isActive).length,
            drivers: drivers.filter((d) => d.isActive).length,
            vehicles: vehicles.filter((v2) => v2.isActive).length,
            services: services.filter((s) => s.isActive).length,
          },
          todayEvents: todayEvents.length,
          adminCount: admins.filter(
            (u) => u.schoolId === school._id && (u.role === "school_admin" || u.role === "admin"),
          ).length,
        };
      }),
    );

    const [queued, failed] = await Promise.all([
      ctx.db.query("notifications").withIndex("by_status", (q) => q.eq("status", "QUEUED")).collect(),
      ctx.db.query("notifications").withIndex("by_status", (q) => q.eq("status", "FAILED")).collect(),
    ]);
    const allUsers = await ctx.db.query("users").collect();

    return {
      totals: {
        schools: rows.length,
        activeSchools: rows.filter((r) => r.isActive).length,
        students: rows.reduce((acc, r) => acc + r.counts.students, 0),
        drivers: rows.reduce((acc, r) => acc + r.counts.drivers, 0),
        vehicles: rows.reduce((acc, r) => acc + r.counts.vehicles, 0),
        todayEvents: rows.reduce((acc, r) => acc + r.todayEvents, 0),
        users: allUsers.length,
      },
      outboxQueued: queued.length,
      outboxFailed: failed.length,
      schools: rows.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

/**
 * Bootstrap the first Super Admin. Requires the platform setup key from the
 * Keys tab (SUPER_ADMIN_SETUP_KEY) and only works while no Super Admin exists —
 * after that, additional admins can only be granted by an existing Super Admin
 * (setUserRole). Brute-force limited and audited.
 */
export const claimSuperAdmin = mutation({
  args: { setupKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("UNAUTHENTICATED");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("UNAUTHENTICATED");
    if (user.role === "admin") return; // already platform admin

    // Brute-force protection on the setup key.
    await checkRateLimit(ctx, `superadmin-claim:${userId}`, 5, 10 * 60_000);

    const expected = process.env.SUPER_ADMIN_SETUP_KEY;
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();

    if (!expected || existingAdmin || args.setupKey !== expected) {
      throw new Error("FORBIDDEN");
    }

    await ctx.db.patch(userId, { role: "admin" });
    await ctx.db.insert("auditLogs", {
      actorUserId: userId,
      action: "platform.super_admin_bootstrap",
      resourceType: "user",
      resourceId: userId,
      summary: "اولین مدیر پلتفرم با کلید setup فعال شد",
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// School / Tenant management
// ---------------------------------------------------------------------------

export const createSchool = mutation({
  args: {
    name: v.string(),
    city: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireSuperAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("VALIDATION");
    const id = await ctx.db.insert("schools", {
      name,
      city: args.city?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      isActive: true,
      createdAt: Date.now(),
    });
    await writePlatformAudit(ctx, userId, "school.create", "school", `مدرسه «${name}» ایجاد شد`, id);
    return id;
  },
});

export const updateSchool = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.optional(v.string()),
    city: v.optional(v.string()),
    phone: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireSuperAdmin(ctx);
    const school = await ctx.db.get(args.schoolId);
    if (!school) throw new Error("NOT_FOUND");

    const patch: Partial<{ name: string; city: string; phone: string; isActive: boolean }> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("VALIDATION");
      patch.name = name;
    }
    if (args.city !== undefined) patch.city = args.city.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    if (Object.keys(patch).length === 0) return;

    await ctx.db.patch(args.schoolId, patch);
    await writePlatformAudit(
      ctx,
      userId,
      args.isActive === undefined ? "school.update" : args.isActive ? "school.activate" : "school.deactivate",
      "school",
      `مدرسه «${patch.name ?? school.name}» به‌روزرسانی شد`,
      args.schoolId,
      args.schoolId,
    );
  },
});

// ---------------------------------------------------------------------------
// User management (global)
// ---------------------------------------------------------------------------

const USER_PAGE = 50;

export const listUsers = query({
  args: {
    role: v.optional(roleValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { userId: me } = await requireSuperAdmin(ctx);

    // Small-scale: collect + filter. At platform scale this moves to a
    // by_role index / search index.
    let users = await ctx.db.query("users").collect();
    if (args.role) users = users.filter((u) => u.role === args.role);
    users.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));

    const start = args.paginationOpts.cursor ? parseInt(args.paginationOpts.cursor, 10) || 0 : 0;
    const slice = users.slice(start, start + args.paginationOpts.numItems);
    const nextCursor = start + slice.length < users.length ? String(start + slice.length) : null;

    const items = await Promise.all(
      slice.map(async (u) => ({
        id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        isAnonymous: u.isAnonymous ?? false,
        role: u.role ?? null,
        isActive: u.isActive ?? true,
        isSelf: u._id === me,
        schoolId: u.schoolId ?? null,
        schoolName: await schoolName(ctx, u.schoolId),
        createdAt: u._creationTime,
      })),
    );

    return { page: items, isDone: nextCursor === null, continueCursor: nextCursor ?? "" };
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, args) => {
    const { userId: actor } = await requireSuperAdmin(ctx);
    if (actor === args.userId) throw new Error("CANNOT_CHANGE_SELF");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.userId, { role: args.role });
    await writePlatformAudit(
      ctx,
      actor,
      "user.set_role",
      "user",
      `نقش «${target.name ?? target.email ?? args.userId}» به ${args.role} تغییر یافت`,
      args.userId,
      target.schoolId,
    );
  },
});

export const setUserActive = mutation({
  args: { userId: v.id("users"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const { userId: actor } = await requireSuperAdmin(ctx);
    if (actor === args.userId) throw new Error("CANNOT_CHANGE_SELF");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.userId, { isActive: args.isActive });
    await writePlatformAudit(
      ctx,
      actor,
      args.isActive ? "user.activate" : "user.deactivate",
      "user",
      `${args.isActive ? "فعال‌سازی" : "غیرفعال‌سازی"} کاربر «${target.name ?? target.email ?? args.userId}»`,
      args.userId,
      target.schoolId,
    );
  },
});

/**
 * Invite flow: assign a user (school_admin / driver / parent) to a school
 * tenant. Platform admins (role=admin) stay tenant-less on purpose — they act
 * cross-tenant through the preview guards. Pass schoolId=undefined to detach.
 */
export const setUserSchool = mutation({
  args: { userId: v.id("users"), schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args) => {
    const { userId: actor } = await requireSuperAdmin(ctx);
    if (actor === args.userId) throw new Error("CANNOT_CHANGE_SELF");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("NOT_FOUND");
    if (target.role === "admin" && args.schoolId) {
      throw new Error("PLATFORM_ADMIN_HAS_NO_TENANT");
    }
    if (args.schoolId) {
      const school = await ctx.db.get(args.schoolId);
      if (!school) throw new Error("NOT_FOUND");
    }

    await ctx.db.patch(args.userId, { schoolId: args.schoolId });
    await writePlatformAudit(
      ctx,
      actor,
      args.schoolId ? "user.assign_school" : "user.detach_school",
      "user",
      args.schoolId
        ? `کاربر «${target.name ?? target.email ?? args.userId}» به مدرسه «${
            (await ctx.db.get(args.schoolId))?.name ?? args.schoolId
          }» تخصیص یافت`
        : `کاربر «${target.name ?? target.email ?? args.userId}» از مدرسه جدا شد`,
      args.userId,
      args.schoolId,
    );
  },
});

// ---------------------------------------------------------------------------
// Global logs
// ---------------------------------------------------------------------------

export const listAudit = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const page = await ctx.db
      .query("auditLogs")
      .withIndex("by_time")
      .order("desc")
      .paginate(args.paginationOpts);

    const items = await Promise.all(
      page.page.map(async (log) => {
        const actor = await ctx.db.get(log.actorUserId);
        return {
          id: log._id,
          action: log.action,
          resourceType: log.resourceType,
          summary: log.summary,
          createdAt: log.createdAt,
          actorName: actor?.name ?? (actor?.email as string | undefined) ?? "کاربر",
          schoolName: await schoolName(ctx, log.schoolId),
        };
      }),
    );
    return { ...page, page: items };
  },
});

export const listNotifications = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const page = await ctx.db
      .query("notifications")
      .withIndex("by_time")
      .order("desc")
      .paginate(args.paginationOpts);

    const items = await Promise.all(
      page.page.map(async (n) => {
        const [parent, student] = await Promise.all([ctx.db.get(n.parentId), ctx.db.get(n.studentId)]);
        return {
          id: n._id,
          body: n.body,
          status: n.status,
          attempts: n.attempts,
          lastError: n.lastError ?? null,
          createdAt: n.createdAt,
          parentName: parent?.fullName ?? "—",
          studentName: student ? `${student.firstName} ${student.lastName}` : "—",
          schoolName: await schoolName(ctx, n.schoolId),
        };
      }),
    );
    return { ...page, page: items };
  },
});

export const listEvents = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const page = await ctx.db
      .query("attendanceEvents")
      .withIndex("by_time")
      .order("desc")
      .paginate(args.paginationOpts);

    const items = await Promise.all(
      page.page.map(async (e) => {
        const [student, actor] = await Promise.all([ctx.db.get(e.studentId), ctx.db.get(e.actorUserId)]);
        return {
          id: e._id,
          eventType: e.eventType,
          serverTimestamp: e.serverTimestamp,
          source: e.source,
          studentName: student ? `${student.firstName} ${student.lastName}` : "—",
          actorName: actor?.name ?? (actor?.email as string | undefined) ?? "—",
          schoolName: await schoolName(ctx, e.schoolId),
        };
      }),
    );
    return { ...page, page: items };
  },
});
