import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireSchoolAdmin, requireSchoolAdminMutation, writeAudit } from "./guard";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    return ctx.db
      .query("routes")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    stopsNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    if (!args.name.trim()) throw new Error("VALIDATION");
    const id = await ctx.db.insert("routes", {
      schoolId: actor.schoolId,
      name: args.name.trim(),
      stopsNote: args.stopsNote?.trim() || undefined,
      isActive: true,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, actor, "route.create", "route", `ثبت مسیر ${args.name}`, id);
    return id;
  },
});

export const setActive = mutation({
  args: { routeId: v.id("routes"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    const route = await ctx.db.get(args.routeId);
    if (!route || route.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.routeId, { isActive: args.isActive });
    await writeAudit(
      ctx,
      actor,
      "route.set_active",
      "route",
      `${args.isActive ? "فعال‌سازی" : "غیرفعال‌سازی"} مسیر ${route.name}`,
      args.routeId,
    );
  },
});
