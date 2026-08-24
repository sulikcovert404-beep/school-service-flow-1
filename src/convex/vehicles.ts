import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireSchoolAdmin, requireSchoolAdminMutation, writeAudit } from "./guard";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    return ctx.db
      .query("vehicles")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
  },
});

export const create = mutation({
  args: {
    plateNumber: v.string(),
    model: v.optional(v.string()),
    capacity: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    if (!args.plateNumber.trim()) throw new Error("VALIDATION");
    if (!Number.isFinite(args.capacity) || args.capacity <= 0) throw new Error("VALIDATION");
    const id = await ctx.db.insert("vehicles", {
      schoolId: actor.schoolId,
      plateNumber: args.plateNumber.trim(),
      model: args.model?.trim() || undefined,
      capacity: Math.floor(args.capacity),
      isActive: true,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, actor, "vehicle.create", "vehicle", `ثبت خودرو ${args.plateNumber}`, id);
    return id;
  },
});

export const setActive = mutation({
  args: { vehicleId: v.id("vehicles"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || vehicle.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.vehicleId, { isActive: args.isActive });
    await writeAudit(
      ctx,
      actor,
      "vehicle.set_active",
      "vehicle",
      `${args.isActive ? "فعال‌سازی" : "غیرفعال‌سازی"} خودرو ${vehicle.plateNumber}`,
      args.vehicleId,
    );
  },
});
