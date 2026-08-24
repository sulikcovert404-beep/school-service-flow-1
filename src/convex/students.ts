import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireSchoolAdmin, requireSchoolAdminMutation, writeAudit } from "./guard";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    return ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
  },
});

export const create = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    grade: v.string(),
    className: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    if (!args.firstName.trim() || !args.lastName.trim()) throw new Error("VALIDATION");
    const id = await ctx.db.insert("students", {
      schoolId: actor.schoolId,
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      grade: args.grade.trim(),
      className: args.className?.trim() || undefined,
      isActive: true,
      createdAt: Date.now(),
    });
    await writeAudit(
      ctx,
      actor,
      "student.create",
      "student",
      `ثبت دانش‌آموز ${args.firstName} ${args.lastName}`,
      id,
    );
    return id;
  },
});

export const setActive = mutation({
  args: { studentId: v.id("students"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.studentId, { isActive: args.isActive });
    await writeAudit(
      ctx,
      actor,
      "student.set_active",
      "student",
      `${args.isActive ? "فعال‌سازی" : "غیرفعال‌سازی"} دانش‌آموز ${student.firstName} ${student.lastName}`,
      args.studentId,
    );
  },
});
