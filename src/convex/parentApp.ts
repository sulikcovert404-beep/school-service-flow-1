import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireParentActor, getSessionUser } from "./guard";

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

function startOfTehranDay(now: number) {
  return Math.floor((now + TEHRAN_OFFSET_MS) / 86_400_000) * 86_400_000 - TEHRAN_OFFSET_MS;
}

export type StudentStatus = "waiting" | "picked_up" | "dropped_off" | "absent";

/**
 * Children of the signed-in parent with today's live status and daily timeline.
 * School Admins may preview a parent's portal by passing parentId (same tenant).
 */
export const myChildren = query({
  args: { parentId: v.optional(v.id("parents")) },
  handler: async (ctx, args) => {
    const actor = await requireParentActor(ctx, args.parentId ?? null);
    const dayStart = startOfTehranDay(Date.now());

    const links = await ctx.db
      .query("parentLinks")
      .withIndex("by_parent", (q) => q.eq("parentId", actor.parentId))
      .collect();

    return Promise.all(
      links.map(async (link) => {
        const student = await ctx.db.get(link.studentId);
        if (!student || student.schoolId !== actor.schoolId) return null;

        const events = await ctx.db
          .query("attendanceEvents")
          .withIndex("by_student_time", (q) =>
            q.eq("studentId", link.studentId).gte("serverTimestamp", dayStart),
          )
          .collect();
        const sorted = [...events].sort((a, b) => a.serverTimestamp - b.serverTimestamp);
        const latest = sorted[sorted.length - 1];

        let status: StudentStatus = "waiting";
        if (latest) {
          if (latest.eventType === "PICKED_UP") status = "picked_up";
          else if (latest.eventType === "DROPPED_OFF") status = "dropped_off";
          else status = "absent";
        }

        const timeline = await Promise.all(
          sorted.map(async (e) => {
            const service = e.serviceId ? await ctx.db.get(e.serviceId) : null;
            return {
              id: e._id,
              eventType: e.eventType,
              serverTimestamp: e.serverTimestamp,
              serviceName: service?.name ?? null,
            };
          }),
        );

        // Current service context (driver / vehicle / route) for the parent.
        const assignment = await ctx.db
          .query("serviceStudents")
          .withIndex("by_student", (q) => q.eq("studentId", link.studentId))
          .first();
        let serviceInfo: {
          name: string;
          shift: string;
          driverName: string | null;
          driverPhone: string | null;
          vehiclePlate: string | null;
          routeName: string | null;
        } | null = null;
        if (assignment) {
          const service = await ctx.db.get(assignment.serviceId);
          if (service && service.schoolId === actor.schoolId) {
            const [driver, vehicle, route] = await Promise.all([
              ctx.db.get(service.driverId),
              ctx.db.get(service.vehicleId),
              ctx.db.get(service.routeId),
            ]);
            serviceInfo = {
              name: service.name,
              shift: service.shift,
              driverName: driver?.fullName ?? null,
              driverPhone: driver?.phone ?? null,
              vehiclePlate: vehicle?.plateNumber ?? null,
              routeName: route?.name ?? null,
            };
          }
        }

        return {
          studentId: student._id,
          name: `${student.firstName} ${student.lastName}`,
          grade: student.grade,
          className: student.className ?? null,
          isActive: student.isActive,
          status,
          lastEventAt: latest?.serverTimestamp ?? null,
          timeline,
          service: serviceInfo,
        };
      }),
    ).then((rows) => rows.filter((r): r is NonNullable<typeof r> => r !== null));
  },
});

/** Service history for one child (last N days, newest first). */
export const childHistory = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    const session = await getSessionUser(ctx);
    if (!session) throw new Error("UNAUTHENTICATED");
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("NOT_FOUND");

    if (session.role === "parent") {
      if (!session.parentProfileId) throw new Error("FORBIDDEN");
      const link = await ctx.db
        .query("parentLinks")
        .withIndex("by_parent", (q) => q.eq("parentId", session.parentProfileId!))
        .collect();
      if (!link.some((l) => l.studentId === args.studentId)) throw new Error("FORBIDDEN");
    } else if (session.role === "school_admin" || session.role === "admin") {
      if (student.schoolId !== session.schoolId) throw new Error("FORBIDDEN");
    } else {
      throw new Error("FORBIDDEN");
    }

    const events = await ctx.db
      .query("attendanceEvents")
      .withIndex("by_student_time", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .take(60);

    return Promise.all(
      events.map(async (e) => {
        const service = e.serviceId ? await ctx.db.get(e.serviceId) : null;
        return {
          id: e._id,
          eventType: e.eventType,
          serverTimestamp: e.serverTimestamp,
          serviceName: service?.name ?? null,
        };
      }),
    );
  },
});
