import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getSessionUser, requireDriverActor } from "./guard";
import { enqueueForEvent } from "./notifications";

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

function startOfTehranDay(now: number) {
  return Math.floor((now + TEHRAN_OFFSET_MS) / 86_400_000) * 86_400_000 - TEHRAN_OFFSET_MS;
}

export type StudentStatus = "waiting" | "picked_up" | "dropped_off" | "absent";

/**
 * Services assigned to the signed-in driver. School Admins may preview a
 * driver's console by passing driverId (must belong to their own school).
 */
export const myServices = query({
  args: { driverId: v.optional(v.id("drivers")) },
  handler: async (ctx, args) => {
    const session = await getSessionUser(ctx);
    if (!session) throw new Error("UNAUTHENTICATED");

    let driverId: Id<"drivers"> | null = null;
    let schoolId: Id<"schools"> | null = null;

    if (session.role === "driver") {
      driverId = session.driverProfileId;
      schoolId = session.schoolId;
    } else if (
      (session.role === "school_admin" || session.role === "admin") &&
      args.driverId
    ) {
      const driver = await ctx.db.get(args.driverId);
      if (!driver || driver.schoolId !== session.schoolId) throw new Error("FORBIDDEN");
      driverId = driver._id;
      schoolId = session.schoolId;
    }
    if (!driverId || !schoolId) throw new Error("FORBIDDEN");

    const services = await ctx.db
      .query("services")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    const mine = services.filter((s) => s.driverId === driverId && s.isActive);

    return Promise.all(
      mine.map(async (s) => {
        const [route, vehicle] = await Promise.all([
          ctx.db.get(s.routeId),
          ctx.db.get(s.vehicleId),
        ]);
        const studentCount = (
          await ctx.db
            .query("serviceStudents")
            .withIndex("by_service", (q) => q.eq("serviceId", s._id))
            .collect()
        ).length;
        return {
          _id: s._id,
          name: s.name,
          shift: s.shift,
          routeName: route?.name ?? null,
          vehiclePlate: vehicle?.plateNumber ?? null,
          studentCount,
        };
      }),
    );
  },
});

/** Live roster for one service from the driver's point of view. */
export const serviceRoster = query({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("NOT_FOUND");
    await requireDriverActor(ctx, service.driverId, service.schoolId);

    const dayStart = startOfTehranDay(Date.now());
    const links = await ctx.db
      .query("serviceStudents")
      .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
      .collect();

    const rows = await Promise.all(
      links.map(async (link) => {
        const student = await ctx.db.get(link.studentId);
        if (!student || student.schoolId !== service.schoolId) return null;
        const events = await ctx.db
          .query("attendanceEvents")
          .withIndex("by_student_time", (q) =>
            q.eq("studentId", link.studentId).gte("serverTimestamp", dayStart),
          )
          .collect();
        const latest = events.sort((a, b) => b.serverTimestamp - a.serverTimestamp)[0];
        let status: StudentStatus = "waiting";
        if (latest) {
          if (latest.eventType === "PICKED_UP") status = "picked_up";
          else if (latest.eventType === "DROPPED_OFF") status = "dropped_off";
          else status = "absent";
        }
        return {
          studentId: student._id,
          name: `${student.firstName} ${student.lastName}`,
          grade: student.grade,
          status,
          isActive: student.isActive,
          lastEventAt: latest?.serverTimestamp ?? null,
        };
      }),
    );

    return {
      service: { _id: service._id, name: service.name, shift: service.shift },
      rows: rows
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => a.name.localeCompare(b.name, "fa")),
    };
  },
});

/**
 * The critical write path of the whole system:
 *
 *   driver action → validation → idempotency check → persist event (append-only)
 *   → enqueue parent notifications (outbox, async) → audit log → success.
 *
 * `idempotencyKey` is the client-generated event ID: retries (offline sync,
 * flaky network) can never create duplicates. Server time is authoritative.
 */
export const recordEvent = mutation({
  args: {
    serviceId: v.id("services"),
    studentId: v.id("students"),
    eventType: v.union(v.literal("PICKED_UP"), v.literal("DROPPED_OFF")),
    idempotencyKey: v.string(),
    clientTimestamp: v.optional(v.number()),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.serviceId);
    if (!service || !service.isActive) throw new Error("SERVICE_NOT_FOUND");
    const actor = await requireDriverActor(ctx, service.driverId, service.schoolId);

    const [student, assigned] = await Promise.all([
      ctx.db.get(args.studentId),
      ctx.db
        .query("serviceStudents")
        .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
        .collect(),
    ]);
    if (!student || student.schoolId !== service.schoolId || !student.isActive) {
      throw new Error("STUDENT_NOT_FOUND");
    }
    if (!assigned.some((l) => l.studentId === args.studentId)) {
      throw new Error("STUDENT_NOT_ON_SERVICE");
    }

    // Idempotency: same client event ID within the same tenant → no-op.
    const existing = await ctx.db
      .query("attendanceEvents")
      .withIndex("by_idempotency", (q) =>
        q.eq("schoolId", service.schoolId).eq("idempotencyKey", args.idempotencyKey),
      )
      .first();
    if (existing) return { duplicate: true as const, eventId: existing._id };

    const serverTimestamp = Date.now();
    const eventId = await ctx.db.insert("attendanceEvents", {
      schoolId: service.schoolId,
      serviceId: service._id,
      studentId: args.studentId,
      eventType: args.eventType,
      actorUserId: actor.userId,
      serverTimestamp,
      clientTimestamp: args.clientTimestamp,
      deviceId: args.deviceId,
      idempotencyKey: args.idempotencyKey,
      source: "driver",
    });

    // Async notification path — rows land in the outbox; a worker delivers.
    await enqueueForEvent(ctx, {
      schoolId: service.schoolId,
      eventId,
      studentId: args.studentId,
      eventType: args.eventType,
      occurredAt: serverTimestamp,
    });

    const labels = { PICKED_UP: "سوار شدن", DROPPED_OFF: "پیاده شدن" } as const;
    await ctx.db.insert("auditLogs", {
      schoolId: service.schoolId,
      actorUserId: actor.userId,
      action: "attendance.driver_event",
      resourceType: "attendance_event",
      resourceId: eventId,
      summary: `ثبت «${labels[args.eventType]}» توسط راننده برای ${student.firstName} ${student.lastName}`,
      createdAt: Date.now(),
    });

    return { duplicate: false as const, eventId };
  },
});

/** Demo helper: list drivers of the signed-in admin's school (for console preview). */
export const listDriversForPreview = query({
  args: {},
  handler: async (ctx) => {
    const session = await getSessionUser(ctx);
    if (
      !session ||
      (session.role !== "school_admin" && session.role !== "admin") ||
      !session.schoolId
    ) {
      throw new Error("FORBIDDEN");
    }
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_school", (q) => q.eq("schoolId", session.schoolId!))
      .collect();
    return drivers
      .filter((d) => d.isActive)
      .map((d) => ({ _id: d._id, fullName: d.fullName }));
  },
});
