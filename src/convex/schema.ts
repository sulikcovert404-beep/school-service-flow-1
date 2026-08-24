import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
  SCHOOL_ADMIN: "school_admin",
  DRIVER: "driver",
  PARENT: "parent",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
  v.literal(ROLES.SCHOOL_ADMIN),
  v.literal(ROLES.DRIVER),
  v.literal(ROLES.PARENT),
);
export type Role = Infer<typeof roleValidator>;

export const SHIFTS = {
  MORNING: "morning",
  RETURN: "return",
} as const;
export const shiftValidator = v.union(
  v.literal(SHIFTS.MORNING),
  v.literal(SHIFTS.RETURN),
);

export const EVENT_TYPES = {
  PICKED_UP: "PICKED_UP",
  DROPPED_OFF: "DROPPED_OFF",
  ABSENT: "ABSENT",
} as const;
export const eventTypeValidator = v.union(
  v.literal(EVENT_TYPES.PICKED_UP),
  v.literal(EVENT_TYPES.DROPPED_OFF),
  v.literal(EVENT_TYPES.ABSENT),
);
export type AttendanceEventType = Infer<typeof eventTypeValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      schoolId: v.optional(v.id("schools")), // tenant context, derived server-side only
      driverProfileId: v.optional(v.id("drivers")), // set for role=driver
      parentProfileId: v.optional(v.id("parents")), // set for role=parent
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ---- School Service Platform (v1) ----

    schools: defineTable({
      name: v.string(),
      city: v.optional(v.string()),
      phone: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
    }),

    students: defineTable({
      schoolId: v.id("schools"),
      firstName: v.string(),
      lastName: v.string(),
      grade: v.string(),
      className: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_school", ["schoolId"]),

    parents: defineTable({
      schoolId: v.id("schools"),
      fullName: v.string(),
      phone: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_school", ["schoolId"]),

    parentLinks: defineTable({
      schoolId: v.id("schools"),
      parentId: v.id("parents"),
      studentId: v.id("students"),
    })
      .index("by_parent", ["parentId"])
      .index("by_student", ["studentId"])
      .index("by_school", ["schoolId"]),

    drivers: defineTable({
      schoolId: v.id("schools"),
      fullName: v.string(),
      phone: v.optional(v.string()),
      licenseNumber: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_school", ["schoolId"]),

    vehicles: defineTable({
      schoolId: v.id("schools"),
      plateNumber: v.string(),
      model: v.optional(v.string()),
      capacity: v.number(),
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_school", ["schoolId"]),

    routes: defineTable({
      schoolId: v.id("schools"),
      name: v.string(),
      stopsNote: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_school", ["schoolId"]),

    services: defineTable({
      schoolId: v.id("schools"),
      name: v.string(),
      routeId: v.id("routes"),
      vehicleId: v.id("vehicles"),
      driverId: v.id("drivers"),
      shift: shiftValidator,
      isActive: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_school", ["schoolId"])
      .index("by_route", ["routeId"]),

    serviceStudents: defineTable({
      schoolId: v.id("schools"),
      serviceId: v.id("services"),
      studentId: v.id("students"),
    })
      .index("by_service", ["serviceId"])
      .index("by_student", ["studentId"])
      .index("by_school", ["schoolId"]),

    // Append-only attendance log. Never updated or deleted; corrections are new rows.
    attendanceEvents: defineTable({
      schoolId: v.id("schools"),
      serviceId: v.optional(v.id("services")),
      studentId: v.id("students"),
      eventType: eventTypeValidator,
      note: v.optional(v.string()),
      actorUserId: v.id("users"),
      serverTimestamp: v.number(), // source of truth for time
      clientTimestamp: v.optional(v.number()), // device clock, informational only
      deviceId: v.optional(v.string()),
      idempotencyKey: v.optional(v.string()), // client_event_id — retries never duplicate
      source: v.union(v.literal("manual"), v.literal("driver"), v.literal("seed")),
    })
      .index("by_school_time", ["schoolId", "serverTimestamp"])
      .index("by_student_time", ["studentId", "serverTimestamp"])
      .index("by_service_time", ["serviceId", "serverTimestamp"])
      .index("by_idempotency", ["schoolId", "idempotencyKey"]),

    //
    // Transactional outbox for parent push notifications (async — never on the
    // driver's critical write path). A worker drains QUEUED rows; failures are
    // retried with backoff and logged, never blocking the attendance write.
    //
    notifications: defineTable({
      schoolId: v.id("schools"),
      eventId: v.optional(v.id("attendanceEvents")),
      parentId: v.id("parents"),
      studentId: v.id("students"),
      title: v.string(),
      body: v.string(),
      status: v.union(
        v.literal("QUEUED"),
        v.literal("SENT"),
        v.literal("FAILED"),
      ),
      attempts: v.number(),
      lastError: v.optional(v.string()),
      createdAt: v.number(),
      sentAt: v.optional(v.number()),
    })
      .index("by_school_time", ["schoolId", "createdAt"])
      .index("by_status", ["status"])
      .index("by_parent_time", ["parentId", "createdAt"]),

    auditLogs: defineTable({
      schoolId: v.id("schools"),
      actorUserId: v.id("users"),
      action: v.string(), // e.g. "student.create"
      resourceType: v.string(),
      resourceId: v.optional(v.string()),
      summary: v.string(),
      createdAt: v.number(),
    }).index("by_school_time", ["schoolId", "createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
