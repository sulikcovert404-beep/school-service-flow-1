import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireSchoolAdmin, requireSchoolAdminMutation, writeAudit } from "./guard";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    return ctx.db
      .query("drivers")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
  },
});

export const create = mutation({
  args: {
    fullName: v.string(),
    phone: v.optional(v.string()),
    licenseNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    if (!args.fullName.trim()) throw new Error("VALIDATION");
    const id = await ctx.db.insert("drivers", {
      schoolId: actor.schoolId,
      fullName: args.fullName.trim(),
      phone: args.phone?.trim() || undefined,
      licenseNumber: args.licenseNumber?.trim() || undefined,
      isActive: true,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, actor, "driver.create", "driver", `ثبت راننده ${args.fullName}`, id);
    return id;
  },
});

export const setActive = mutation({
  args: { driverId: v.id("drivers"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    const driver = await ctx.db.get(args.driverId);
    if (!driver || driver.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.driverId, { isActive: args.isActive });
    await writeAudit(
      ctx,
      actor,
      "driver.set_active",
      "driver",
      `${args.isActive ? "فعال‌سازی" : "غیرفعال‌سازی"} راننده ${driver.fullName}`,
      args.driverId,
    );
  },
});
