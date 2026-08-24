import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Platform-level (Super Admin) overview. Guarded strictly by role=admin —
 * school tenants are never visible to other tenants' admins.
 */
export const globalOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("UNAUTHENTICATED");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("FORBIDDEN");

    const schools = await ctx.db.query("schools").collect();
    const now = Date.now();
    const dayStart =
      Math.floor((now + 3.5 * 3600_000) / 86_400_000) * 86_400_000 - 3.5 * 3600_000;

    const rows = await Promise.all(
      schools.map(async (school) => {
        const [students, drivers, vehicles, services, todayEvents] = await Promise.all([
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
        ]);
        return {
          _id: school._id,
          name: school.name,
          city: school.city ?? null,
          isActive: school.isActive,
          createdAt: school.createdAt,
          counts: {
            students: students.filter((s) => s.isActive).length,
            drivers: drivers.filter((d) => d.isActive).length,
            vehicles: vehicles.filter((v2) => v2.isActive).length,
            services: services.filter((s) => s.isActive).length,
          },
          todayEvents: todayEvents.length,
        };
      }),
    );

    const queued = (
      await ctx.db.query("notifications").withIndex("by_status", (q) => q.eq("status", "QUEUED")).collect()
    ).length;

    return {
      totals: {
        schools: rows.length,
        students: rows.reduce((acc, r) => acc + r.counts.students, 0),
        drivers: rows.reduce((acc, r) => acc + r.counts.drivers, 0),
        vehicles: rows.reduce((acc, r) => acc + r.counts.vehicles, 0),
        todayEvents: rows.reduce((acc, r) => acc + r.todayEvents, 0),
      },
      outboxQueued: queued,
      schools: rows.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

/**
 * Demo-only: lets a fresh signed-in user claim the platform-admin role so the
 * Super Admin dashboard is reachable in this environment. Must be removed or
 * gated behind an invite flow before production.
 */
export const claimSuperAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("UNAUTHENTICATED");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("UNAUTHENTICATED");
    if (user.role === "admin") return; // already platform admin
    await ctx.db.patch(userId, { role: "admin" });
  },
});
