import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireSchoolAdmin, requireSchoolAdminMutation, writeAudit } from "./guard";
import { eventTypeValidator } from "./schema";

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

function startOfTehranDay(now: number) {
  return Math.floor((now + TEHRAN_OFFSET_MS) / 86_400_000) * 86_400_000 - TEHRAN_OFFSET_MS;
}

export type StudentStatus = "waiting" | "picked_up" | "dropped_off" | "absent";

/** Dashboard overview: counts + today's live attendance breakdown + recent events. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    const now = Date.now();
    const dayStart = startOfTehranDay(now);

    const [students, drivers, vehicles, services] = await Promise.all([
      ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("drivers").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("vehicles").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("services").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
    ]);

    const activeStudents = students.filter((s) => s.isActive);

    // Students that are on at least one service define the "today" population.
    const links = await ctx.db
      .query("serviceStudents")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    const servedStudentIds = new Set(links.map((l) => l.studentId));
    const todayPopulation = activeStudents.filter((s) => servedStudentIds.has(s._id));

    const todayEvents = await ctx.db
      .query("attendanceEvents")
      .withIndex("by_school_time", (q) =>
        q.eq("schoolId", schoolId).gte("serverTimestamp", dayStart),
      )
      .collect();

    // Latest event per student wins.
    const latestByStudent = new Map<Id<"students">, (typeof todayEvents)[number]>();
    for (const e of [...todayEvents].sort((a, b) => a.serverTimestamp - b.serverTimestamp)) {
      latestByStudent.set(e.studentId, e);
    }

    let pickedUp = 0;
    let droppedOff = 0;
    let absent = 0;
    for (const student of todayPopulation) {
      const latest = latestByStudent.get(student._id)?.eventType;
      if (latest === "PICKED_UP") pickedUp++;
      else if (latest === "DROPPED_OFF") droppedOff++;
      else if (latest === "ABSENT") absent++;
    }
    const waiting = Math.max(todayPopulation.length - pickedUp - droppedOff - absent, 0);

    const recent = [...todayEvents]
      .sort((a, b) => b.serverTimestamp - a.serverTimestamp)
      .slice(0, 12);
    const studentById = new Map(activeStudents.concat(students.filter((s) => !s.isActive)).map((s) => [s._id, s]));
    const serviceById = new Map(services.map((s) => [s._id, s]));

    const recentEvents = await Promise.all(
      recent.map(async (e) => {
        const s = studentById.get(e.studentId);
        const svc = e.serviceId ? serviceById.get(e.serviceId) : undefined;
        return {
          id: e._id,
          eventType: e.eventType,
          serverTimestamp: e.serverTimestamp,
          source: e.source,
          studentName: s ? `${s.firstName} ${s.lastName}` : "—",
          serviceName: svc?.name ?? null,
        };
      }),
    );

    return {
      counts: {
        students: activeStudents.length,
        parentsActive: (
          await ctx.db.query("parents").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect()
        ).filter((p) => p.isActive).length,
        drivers: drivers.filter((d) => d.isActive).length,
        vehicles: vehicles.filter((v2) => v2.isActive).length,
        services: services.filter((s) => s.isActive).length,
      },
      today: {
        total: todayPopulation.length,
        pickedUp,
        droppedOff,
        absent,
        waiting,
      },
      recentEvents,
    };
  },
});

/** Live roster of one service with each student's current status today. */
export const roster = query({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.schoolId !== schoolId) throw new Error("NOT_FOUND");

    const dayStart = startOfTehranDay(Date.now());
    const links = await ctx.db
      .query("serviceStudents")
      .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
      .collect();

    const rows = await Promise.all(
      links.map(async (link) => {
        const student = await ctx.db.get(link.studentId);
        if (!student || student.schoolId !== schoolId) return null;
        const events = await ctx.db
          .query("attendanceEvents")
          .withIndex("by_student_time", (q) =>
            q.eq("studentId", link.studentId).gte("serverTimestamp", dayStart),
          )
          .collect();
        const latest = events.sort((a, b) => b.serverTimestamp - a.serverTimestamp)[0];
        let status: StudentStatus = "waiting";
        if (student.isActive && latest) {
          if (latest.eventType === "PICKED_UP") status = "picked_up";
          else if (latest.eventType === "DROPPED_OFF") status = "dropped_off";
          else status = "absent";
        }
        return {
          studentId: student._id,
          name: `${student.firstName} ${student.lastName}`,
          grade: student.grade,
          className: student.className ?? null,
          isActive: student.isActive,
          status,
          lastEventAt: latest?.serverTimestamp ?? null,
        };
      }),
    );
    return {
      service: {
        _id: service._id,
        name: service.name,
        shift: service.shift,
      },
      rows: rows
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => a.name.localeCompare(b.name, "fa")),
    };
  },
});

/**
 * Manual attendance entry by the School Admin (v1 has no Driver App).
 * Append-only: a correction inserts a NEW event; history is never rewritten.
 */
export const recordManual = mutation({
  args: {
    serviceId: v.id("services"),
    studentId: v.id("students"),
    eventType: eventTypeValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    const [service, student] = await Promise.all([
      ctx.db.get(args.serviceId),
      ctx.db.get(args.studentId),
    ]);
    if (!service || service.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    if (!student || student.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    const link = await ctx.db
      .query("serviceStudents")
      .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
      .collect();
    if (!link.some((l) => l.studentId === args.studentId)) {
      throw new Error("STUDENT_NOT_ON_SERVICE");
    }

    await ctx.db.insert("attendanceEvents", {
      schoolId: actor.schoolId,
      serviceId: args.serviceId,
      studentId: args.studentId,
      eventType: args.eventType,
      note: args.note?.trim() || undefined,
      actorUserId: actor.userId,
      serverTimestamp: Date.now(), // server time is the source of truth
      source: "manual",
    });

    const labels = {
      PICKED_UP: "سوار شدن",
      DROPPED_OFF: "پیاده شدن",
      ABSENT: "غيبت",
    } as const;
    await writeAudit(
      ctx,
      actor,
      "attendance.manual_override",
      "attendance_event",
      `ثبت دستی «${labels[args.eventType]}» برای ${student.firstName} ${student.lastName}`,
    );
  },
});

/** Paginated event history for the Reports page (newest first). */
export const listEvents = query({
  args: {
    eventType: v.optional(eventTypeValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    const page = await ctx.db
      .query("attendanceEvents")
      .withIndex("by_school_time", (q) => q.eq("schoolId", schoolId))
      .order("desc")
      .filter((e) => (args.eventType ? e.eq(e.field("eventType"), args.eventType) : true))
      .paginate(args.paginationOpts);

    const items = await Promise.all(
      page.page.map(async (e) => {
        const [student, service, actor] = await Promise.all([
          ctx.db.get(e.studentId),
          e.serviceId ? ctx.db.get(e.serviceId) : null,
          ctx.db.get(e.actorUserId),
        ]);
        return {
          id: e._id,
          eventType: e.eventType,
          serverTimestamp: e.serverTimestamp,
          source: e.source,
          note: e.note ?? null,
          studentName: student ? `${student.firstName} ${student.lastName}` : "—",
          serviceName: service?.name ?? null,
          actorName:
            actor?.name ??
            (actor?.email as string | undefined) ??
            "کاربر",
        };
      }),
    );

    return { ...page, page: items };
  },
});
