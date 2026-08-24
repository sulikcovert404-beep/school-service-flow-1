import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { requireParentActor, requireSchoolAdmin } from "./guard";

const MAX_ATTEMPTS = 3;

const TEHRAN_TZ = "Asia/Tehran";

function formatTehranTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: TEHRAN_TZ,
      hour: "2-digit",
      minute: "2-digit",
    }).format(ts);
  } catch {
    return "";
  }
}

/**
 * Enqueue parent notifications for an attendance event (Transactional Outbox
 * pattern). Called inside the attendance mutation AFTER the event is persisted
 * — the driver's success response never waits on delivery.
 */
export async function enqueueForEvent(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    eventId: Id<"attendanceEvents">;
    studentId: Id<"students">;
    eventType: "PICKED_UP" | "DROPPED_OFF" | "ABSENT";
    occurredAt: number;
  },
) {
  const links = await ctx.db
    .query("parentLinks")
    .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
    .collect();

  const [student, event] = await Promise.all([
    ctx.db.get(args.studentId),
    ctx.db.get(args.eventId),
  ]);
  const studentName = student ? `${student.firstName} ${student.lastName}` : "دانش‌آموز";
  const time = formatTehranTime(args.occurredAt);

  const serviceName = event?.serviceId
    ? ((await ctx.db.get(event.serviceId))?.name ?? null)
    : null;

  const body =
    args.eventType === "PICKED_UP"
      ? `${studentName} ساعت ${time} سوار سرویس مدرسه شد${serviceName ? ` (${serviceName})` : ""}.`
      : args.eventType === "DROPPED_OFF"
        ? `${studentName} ساعت ${time} از سرویس پیاده شد و به مقصد رسید.`
        : `${studentName} ساعت ${time} در سرویس مدرسه غایب ثبت شد.`;

  for (const link of links) {
    await ctx.db.insert("notifications", {
      schoolId: args.schoolId,
      eventId: args.eventId,
      parentId: link.parentId,
      studentId: args.studentId,
      title: "اطلاع‌رسانی سرویس مدرسه",
      body,
      status: "QUEUED",
      attempts: 0,
      createdAt: Date.now(),
    });
  }
}

/**
 * Notification Worker: drains the QUEUED outbox and "delivers" each message.
 * In v1 delivery is simulated (no FCM credentials wired yet) — swapping in a
 * real provider only changes this handler; the outbox contract stays the same.
 * Failures increment attempts; after MAX_ATTEMPTS the row is marked FAILED.
 */
export const processOutbox = mutation({
  args: {},
  handler: async (ctx) => {
    const queued = await ctx.db
      .query("notifications")
      .withIndex("by_status", (q) => q.eq("status", "QUEUED"))
      .take(50);

    let sent = 0;
    let failed = 0;
    for (const n of queued) {
      try {
        // TODO(v2): replace with real FCM send (requires provider credentials).
        await ctx.db.patch(n._id, {
          status: "SENT",
          sentAt: Date.now(),
          attempts: n.attempts + 1,
        });
        sent++;
      } catch (err) {
        const attempts = n.attempts + 1;
        const message = err instanceof Error ? err.message : "unknown error";
        await ctx.db.patch(n._id, {
          attempts,
          lastError: message,
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "QUEUED",
        });
        failed++;
      }
    }
    return { picked: queued.length, sent, failed };
  },
});

/** Notification history for one parent (Parent App "Notification History"). */
export const listForParent = query({
  args: { parentId: v.optional(v.id("parents")) },
  handler: async (ctx, args) => {
    const actor = await requireParentActor(ctx, args.parentId ?? null);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_parent_time", (q) => q.eq("parentId", actor.parentId))
      .order("desc")
      .take(50);
    return rows.map((n) => ({
      id: n._id,
      title: n.title,
      body: n.body,
      status: n.status,
      createdAt: n.createdAt,
      sentAt: n.sentAt ?? null,
    }));
  },
});

/** Notification logs for the School Dashboard (delivery status per message). */
export const listForSchool = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    const page = await ctx.db
      .query("notifications")
      .withIndex("by_school_time", (q) => q.eq("schoolId", schoolId))
      .order("desc")
      .paginate(args.paginationOpts);

    const items = await Promise.all(
      page.page.map(async (n) => {
        const [parent, student] = await Promise.all([
          ctx.db.get(n.parentId),
          ctx.db.get(n.studentId),
        ]);
        return {
          id: n._id,
          title: n.title,
          body: n.body,
          status: n.status,
          attempts: n.attempts,
          lastError: n.lastError ?? null,
          createdAt: n.createdAt,
          sentAt: n.sentAt ?? null,
          parentName: parent?.fullName ?? "—",
          studentName: student ? `${student.firstName} ${student.lastName}` : "—",
        };
      }),
    );
    return { ...page, page: items };
  },
});
