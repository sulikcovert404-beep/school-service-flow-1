import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  MutationCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getSessionUser, requireParentActor, requireSchoolAdmin } from "./guard";

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

// ---- Internal helpers used by the FCM worker (src/convex/fcm.ts) ----

/** Public VAPID key for the browser subscription step (null = feature off). */
export const getWebPushPublicKey = query({
  args: {},
  handler: () => process.env.WEB_PUSH_PUBLIC_KEY ?? null,
});

/** Session check for the FCM test action (runs in the default runtime). */
export const fcmGuardSession = internalQuery({
  args: {},
  handler: async (ctx) => {
    const session = await getSessionUser(ctx);
    return session ? { role: session.role } : null;
  },
});

/** Next batch of QUEUED notifications (plain objects — safe to cross into an action). */
export const listQueuedInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_status", (q) => q.eq("status", "QUEUED"))
      .take(50);
    return rows.map((n) => ({
      _id: n._id,
      parentId: n.parentId,
      title: n.title,
      body: n.body,
      attempts: n.attempts,
    }));
  },
});

/** Push targets registered for a parent (FCM tokens + web subscriptions). */
export const listParentTokensInternal = internalQuery({
  args: { parentId: v.id("parents") },
  handler: async (ctx, args) => {
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
    return devices.map((d) => ({
      id: d._id,
      token: d.token,
      platform: d.platform,
    }));
  },
});

/** Remove a dead push target (expired/unsubscribed web subscription). */
export const deleteDeviceInternal = internalMutation({
  args: { id: v.id("devices") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/** Record delivery outcome for one outbox row. */
export const markResultInternal = internalMutation({
  args: { id: v.id("notifications"), ok: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const n = await ctx.db.get(args.id);
    if (!n) return;
    if (args.ok) {
      await ctx.db.patch(n._id, {
        status: "SENT",
        sentAt: Date.now(),
        attempts: n.attempts + 1,
        lastError: args.error,
      });
    } else {
      const attempts = n.attempts + 1;
      await ctx.db.patch(n._id, {
        attempts,
        lastError: args.error,
        status: attempts >= MAX_ATTEMPTS ? "FAILED" : "QUEUED",
      });
    }
  },
});

/** Register a push device (FCM token) for the signed-in parent (or admin preview). */
export const registerDevice = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal("web"), v.literal("android")),
    parentId: v.optional(v.id("parents")),
  },
  handler: async (ctx, args) => {
    const actor = await requireParentActor(ctx, args.parentId ?? null);
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { parentId: actor.parentId });
      return existing._id;
    }
    return ctx.db.insert("devices", {
      schoolId: actor.schoolId,
      parentId: actor.parentId,
      token: args.token,
      platform: args.platform,
      createdAt: Date.now(),
    });
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
