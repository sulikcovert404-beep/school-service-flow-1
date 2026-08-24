import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireSchoolAdmin, requireSchoolAdminMutation, writeAudit } from "./guard";

/** Parents of this school, each with their linked students. */
export const listWithChildren = query({
  args: {},
  handler: async (ctx) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    const [parents, links, students] = await Promise.all([
      ctx.db.query("parents").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("parentLinks").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
    ]);
    const studentById = new Map(students.map((s) => [s._id, s]));
    return parents.map((p) => ({
      ...p,
      children: links
        .filter((l) => l.parentId === p._id)
        .map((l) => {
          const s = studentById.get(l.studentId);
          return s
            ? { id: s._id as Id<"students">, name: `${s.firstName} ${s.lastName}`, isActive: s.isActive }
            : null;
        })
        .filter((c) => c !== null),
    }));
  },
});

export const create = mutation({
  args: {
    fullName: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    if (!args.fullName.trim()) throw new Error("VALIDATION");
    const id = await ctx.db.insert("parents", {
      schoolId: actor.schoolId,
      fullName: args.fullName.trim(),
      phone: args.phone?.trim() || undefined,
      isActive: true,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, actor, "parent.create", "parent", `ثبت والد ${args.fullName}`, id);
    return id;
  },
});

export const linkChild = mutation({
  args: { parentId: v.id("parents"), studentId: v.id("students") },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    const [parent, student] = await Promise.all([
      ctx.db.get(args.parentId),
      ctx.db.get(args.studentId),
    ]);
    if (!parent || parent.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    if (!student || student.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    const existing = await ctx.db
      .query("parentLinks")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
    if (existing.some((l) => l.studentId === args.studentId)) return; // idempotent
    await ctx.db.insert("parentLinks", {
      schoolId: actor.schoolId,
      parentId: args.parentId,
      studentId: args.studentId,
    });
    const name = `${student.firstName} ${student.lastName}`;
    await writeAudit(
      ctx,
      actor,
      "parent.link_child",
      "parent",
      `اتصال دانش‌آموز ${name} به والد ${parent.fullName}`,
      args.parentId,
    );
  },
});

export const unlinkChild = mutation({
  args: { parentId: v.id("parents"), studentId: v.id("students") },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    const parent = await ctx.db.get(args.parentId);
    if (!parent || parent.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    const links = await ctx.db
      .query("parentLinks")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
    for (const link of links) {
      if (link.studentId === args.studentId) {
        await ctx.db.delete(link._id);
        const student = await ctx.db.get(args.studentId);
        await writeAudit(
          ctx,
          actor,
          "parent.unlink_child",
          "parent",
          `حذف اتصال دانش‌آموز ${student ? `${student.firstName} ${student.lastName}` : args.studentId} از والد ${parent.fullName}`,
          args.parentId,
        );
      }
    }
  },
});
