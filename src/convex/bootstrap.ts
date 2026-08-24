import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { SHIFTS } from "./schema";

/** Returns the signed-in user and their school (tenant context from session only). */
export const myContext = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const school = user.schoolId ? await ctx.db.get(user.schoolId) : null;
    return {
      userId: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      isAnonymous: user.isAnonymous ?? false,
      role: user.role ?? null,
      school,
    };
  },
});

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

function startOfTehranDay(now: number) {
  return Math.floor((now + TEHRAN_OFFSET_MS) / 86_400_000) * 86_400_000 - TEHRAN_OFFSET_MS;
}

const FIRST_NAMES = [
  "علی", "محمد", "رضا", "امیر", "حسین", "مهدی", "سارا", "نگار",
  "مریم", "زهرا", "نرگس", "یاسمن",
];
const LAST_NAMES = [
  "احمدی", "محمدی", "رضایی", "کریمی", "موسوی", "حسینی",
  "صادقی", "جعفری", "نجفی", "قاسمی",
];

/**
 * One-time provisioning: creates the admin's school plus a realistic demo
 * dataset so the dashboard is usable immediately. Idempotent — refuses to run
 * twice for the same user.
 */
export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("UNAUTHENTICATED");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("UNAUTHENTICATED");
    if (user.schoolId) throw new Error("ALREADY_PROVISIONED");

    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", {
      name: "دبستان اندیشه",
      city: "تهران",
      phone: "021-22334455",
      isActive: true,
      createdAt: now,
    });

    // Promote the signed-in user to School Admin of this tenant.
    await ctx.db.patch(user._id, {
      role: "school_admin",
      schoolId,
      name: user.name ?? "مدیر مدرسه",
    });

    // --- Drivers ---
    const driverIds: Id<"drivers">[] = [];
    for (const [fullName, phone, licenseNumber] of [
      ["رضا محمدی", "09121234567", "IR-112233"],
      ["حسین کریمی", "09129876543", "IR-445566"],
      ["مهدی رحیمی", "09135551234", "IR-778899"],
    ] as const) {
      driverIds.push(
        await ctx.db.insert("drivers", {
          schoolId, fullName, phone, licenseNumber, isActive: true, createdAt: now,
        }),
      );
    }

    // --- Vehicles ---
    const vehicleIds: Id<"vehicles">[] = [];
    for (const [plateNumber, model, capacity] of [
      ["12ب345 ایران 22", "ایسوزو NPR", 24],
      ["456ج98 ایران 22", "بنز 408", 22],
      ["789د11 ایران 33", "وولو B7", 30],
    ] as const) {
      vehicleIds.push(
        await ctx.db.insert("vehicles", {
          schoolId, plateNumber, model, capacity, isActive: true, createdAt: now,
        }),
      );
    }

    // --- Routes ---
    const routeNames = ["مسیر سعادت‌آباد", "مسیر پونک", "مسیر شهران"];
    const stops = [
      "میدان کاج، بلوار دریا، بلوار فرحزادی",
      "فلکه دوم، بلوار فردوس، میدان صنعت",
      "میدان آزادگان، لاله‌زار، انبار نفت",
    ];
    const routeIds: Id<"routes">[] = [];
    for (let i = 0; i < routeNames.length; i++) {
      routeIds.push(
        await ctx.db.insert("routes", {
          schoolId,
          name: routeNames[i],
          stopsNote: stops[i],
          isActive: true,
          createdAt: now,
        }),
      );
    }

    // --- Services: each route has a morning + a return shift ---
    const serviceIds: Id<"services">[] = [];
    for (let i = 0; i < 3; i++) {
      for (const shift of [SHIFTS.MORNING, SHIFTS.RETURN] as const) {
        serviceIds.push(
          await ctx.db.insert("services", {
            schoolId,
            name: `${routeNames[i]} - ${shift === SHIFTS.MORNING ? "صبح" : "برگشت"}`,
            routeId: routeIds[i],
            vehicleId: vehicleIds[i],
            driverId: driverIds[i],
            shift,
            isActive: true,
            createdAt: now,
          }),
        );
      }
    }

    // --- Students + Parents ---
    const studentIds: Id<"students">[] = [];
    let s = 0;
    for (let i = 0; i < FIRST_NAMES.length; i++) {
      for (let j = 0; j < LAST_NAMES.length; j += 2) {
        const firstName = FIRST_NAMES[i];
        const lastName = LAST_NAMES[(i + j) % LAST_NAMES.length];
        const grade = String((s % 6) + 1);
        const className = `${(s % 2) + 1}`;
        const studentId = await ctx.db.insert("students", {
          schoolId, firstName, lastName, grade, className, isActive: true, createdAt: now,
        });
        studentIds.push(studentId);
        s++;
      }
    }

    // One parent per pair of (consecutive) students → sibling links.
    for (let i = 0; i < studentIds.length; i += 2) {
      const parentId = await ctx.db.insert("parents", {
        schoolId,
        fullName: `والد ${FIRST_NAMES[(i / 2) % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
        phone: `0912${String(1000000 + i * 13579).slice(0, 7)}`,
        isActive: true,
        createdAt: now,
      });
      for (const studentId of studentIds.slice(i, i + 2)) {
        await ctx.db.insert("parentLinks", { schoolId, parentId, studentId });
      }
    }

    // --- Assign students round-robin across services ---
    for (let i = 0; i < studentIds.length; i++) {
      const serviceId = serviceIds[i % serviceIds.length];
      await ctx.db.insert("serviceStudents", {
        schoolId, serviceId, studentId: studentIds[i],
      });
    }

    // --- Today's attendance events (append-only log) ---
    const dayStart = startOfTehranDay(now);
    const morningServices = serviceIds.filter((_, i) => i % 2 === 0);
    const returnServices = serviceIds.filter((_, i) => i % 2 === 1);

    const insertEvent = (
      serviceId: Id<"services">,
      studentId: Id<"students">,
      eventType: "PICKED_UP" | "DROPPED_OFF" | "ABSENT",
      minutesFromDayStart: number,
      note?: string,
    ) =>
      ctx.db.insert("attendanceEvents", {
        schoolId,
        serviceId,
        studentId,
        eventType,
        note,
        actorUserId: user._id,
        serverTimestamp: dayStart + minutesFromDayStart * 60_000,
        source: "seed",
      });

    for (let i = 0; i < studentIds.length; i++) {
      const morningIdx = i % morningServices.length;
      const roll = Math.random();
      if (roll < 0.1) {
        await insertEvent(morningServices[morningIdx], studentIds[i], "ABSENT", 400, "عدم حضور اطلاع داده شد");
        continue;
      }
      if (roll < 0.85) {
        await insertEvent(morningServices[morningIdx], studentIds[i], "PICKED_UP", 420 + Math.floor(Math.random() * 25));
        // Partially completed return shift.
        if (now > dayStart + 14 * 3600_000 && Math.random() < 0.6) {
          await insertEvent(returnServices[morningIdx], studentIds[i], "DROPPED_OFF", 810 + Math.floor(Math.random() * 20));
        }
      }
      // remaining ~15%: still waiting (no event yet)
    }

    return schoolId;
  },
});
