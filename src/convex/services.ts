import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireSchoolAdminMutation, requireSchoolAdmin, writeAudit } from "./guard";

export type ResolvedService = {
  _id: Id<"services">;
  _creationTime: number;
  name: string;
  shift: "morning" | "return";
  isActive: boolean;
  routeName: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
};

/** Services with route/vehicle/driver names resolved. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    const [services, routes, vehicles, drivers] = await Promise.all([
      ctx.db.query("services").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("routes").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("vehicles").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("drivers").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
    ]);
    const routeById = new Map(routes.map((r) => [r._id, r]));
    const vehicleById = new Map(vehicles.map((v2) => [v2._id, v2]));
    const driverById = new Map(drivers.map((d) => [d._id, d]));

    const result = await Promise.all(
      services.map(async (s) => {
        const links = await ctx.db
          .query("serviceStudents")
          .withIndex("by_service", (q) => q.eq("serviceId", s._id))
          .collect();
        return {
          ...s,
          routeName: routeById.get(s.routeId)?.name ?? null,
          vehiclePlate: vehicleById.get(s.vehicleId)?.plateNumber ?? null,
          driverName: driverById.get(s.driverId)?.fullName ?? null,
          studentCount: links.length,
        };
      }),
    );
    return result;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    routeId: v.id("routes"),
    vehicleId: v.id("vehicles"),
    driverId: v.id("drivers"),
    shift: v.union(v.literal("morning"), v.literal("return")),
  },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    if (!args.name.trim()) throw new Error("VALIDATION");
    // Referenced resources must belong to the same tenant.
    for (const [id, table] of [
      [args.routeId, "routes"],
      [args.vehicleId, "vehicles"],
      [args.driverId, "drivers"],
    ] as const) {
      const doc = await ctx.db.get(id);
      if (!doc || doc.schoolId !== actor.schoolId) throw new Error("INVALID_REFERENCE");
      if (!doc.isActive) throw new Error(`${table.toUpperCase()}_INACTIVE`);
    }
    const id = await ctx.db.insert("services", {
      schoolId: actor.schoolId,
      name: args.name.trim(),
      routeId: args.routeId,
      vehicleId: args.vehicleId,
      driverId: args.driverId,
      shift: args.shift,
      isActive: true,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, actor, "service.create", "service", `ثبت سرویس ${args.name}`, id);
    return id;
  },
});

export const setActive = mutation({
  args: { serviceId: v.id("services"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.serviceId, { isActive: args.isActive });
    await writeAudit(
      ctx,
      actor,
      "service.set_active",
      "service",
      `${args.isActive ? "فعال‌سازی" : "غیرفعال‌سازی"} سرویس ${service.name}`,
      args.serviceId,
    );
  },
});

export const assignStudent = mutation({
  args: { serviceId: v.id("services"), studentId: v.id("students") },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    const [service, student] = await Promise.all([
      ctx.db.get(args.serviceId),
      ctx.db.get(args.studentId),
    ]);
    if (!service || service.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    if (!student || student.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    const existing = await ctx.db
      .query("serviceStudents")
      .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
      .collect();
    if (existing.some((l) => l.studentId === args.studentId)) return; // idempotent
    await ctx.db.insert("serviceStudents", {
      schoolId: actor.schoolId,
      serviceId: args.serviceId,
      studentId: args.studentId,
    });
    const name = `${student.firstName} ${student.lastName}`;
    await writeAudit(ctx, actor, "service.assign_student", "service", `تخصیص ${name} به سرویس ${service.name}`, args.serviceId);
  },
});

export const unassignStudent = mutation({
  args: { serviceId: v.id("services"), studentId: v.id("students") },
  handler: async (ctx, args) => {
    const actor = await requireSchoolAdminMutation(ctx);
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.schoolId !== actor.schoolId) throw new Error("NOT_FOUND");
    const links = await ctx.db
      .query("serviceStudents")
      .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
      .collect();
    for (const link of links) {
      if (link.studentId === args.studentId) {
        await ctx.db.delete(link._id);
        const student = await ctx.db.get(args.studentId);
        const name = student ? `${student.firstName} ${student.lastName}` : String(args.studentId);
        await writeAudit(ctx, actor, "service.unassign_student", "service", `حذف تخصیص ${name} از سرویس ${service.name}`, args.serviceId);
      }
    }
  },
});
