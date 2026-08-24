# AGENTS.md

## Project Overview
سامانه مدیریت سرویس مدارس (School Service Platform). Event-oriented, multi-tenant by school.

## Version 1 Scope (LOCKED)
- **School Web Dashboard** — هسته اصلی (فقط School Admin).
- **فاز ۲ (تأییدشده توسط Product Owner طبق دیاگرام معماری)**: کنسول وب راننده (offline-first + idempotency)، پورتال وب والد (Today Status/Timeline/اعلان‌ها)، Transactional Outbox اعلان‌ها + Worker (cron)، لاگ اعلان‌ها، Super Admin وب.
- اپ‌های Android واقعی، Live GPS، Payments و… همچنان خارج از محدوده است.
- **فاز ۳**: PWA نصب‌شدنی (manifest + service worker) + Web Push مرورگر (VAPID) به‌عنوان کانال دوم اعلان‌ها.
- هر چیز خارج از این محدوده (GPS, tracking, payments, …) ممنوع است مگر Product Owner تأیید کند.

## Security Rules
- Super Admin فقط با کلید `SUPER_ADMIN_SETUP_KEY` و فقط برای اولین ادمین bootstrap می‌شود؛ بعد از آن فقط از طریق Super Admin موجود.
- Rate limit: ۶۰۰ رویداد/دقیقه به‌ازای هر مدرسه (`checkRateLimit` در guard.ts).
- قرارداد API اپ‌های موبایل: `docs/MOBILE_API.md` · بازبینی امنیتی: `docs/SECURITY_REVIEW.md`.

## Architecture
- Frontend: Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui + react-router.
- Backend/DB: Convex (queries = reactive subscriptions; mutations; no other backend).
- Auth: Convex Auth (email OTP + anonymous/guest). Tenant context (`schoolId`) **همیشه** از session کاربر استخراج می‌شود، نه از client.
- Authorization: Deny by default — هر query/mutation باید schoolId را از user بگیرد.

## Repository Structure
```
src/
  convex/          # schema + queries/mutations (one module per entity)
                   # + driverApp (idempotent write path), notifications (outbox+worker),
                   #   parentApp, superAdmin, crons
  hooks/           # use-offline-queue (Pending Sync / retry / idempotency client-side)
  pages/           # Landing, Auth, Dashboard layout, DriverConsole, ParentPortal, SuperAdmin
  pages/dashboard/ # Overview, Students, Parents, Drivers, Vehicles, Routes, Services,
                   # Reports, AuditLog, Notifications
  components/ui/   # shadcn components
docs/
```

## Conventions
- Persian (fa) RTL UI. Minimalism theme: near-monochrome palette, subtle dividers, generous whitespace.
- No business logic in UI — validation/state transitions live in Convex mutations.
- Attendance events are **append-only**; corrections add a new event, never overwrite.
- Driver events carry a client-generated `idempotencyKey` — retries never duplicate.
- Notifications are **async only** (outbox table + cron worker) — never in the critical write path.
- Every sensitive mutation writes an `auditLogs` row.
- Server time (`Date.now()` in mutation) is the time source of truth.

## Commands
- Typecheck: `bun tsc -b --noEmit`
- Convex codegen + check: `bun convex dev --once && bun tsc -b --noEmit`

## Do / Don't
- Do: smallest correct change, strong typing, small modules.
- Don't: hardcode secrets, trust client-sent tenant IDs, claim "works" without running checks ("Implemented but not executed" otherwise).

## Definition of Done
Implemented · typecheck passed · authz enforced · audit logged · docs synced.
