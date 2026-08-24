# AGENTS.md

## Project Overview
سامانه مدیریت سرویس مدارس (School Service Platform). Event-oriented, multi-tenant by school.

## Version 1 Scope (LOCKED)
- **School Web Dashboard فقط** — بدون Driver App / Parent App / Super Admin.
- **کاربران نسخه اول: فقط School Admin.**
- هر چیز خارج از این محدوده (GPS, tracking, payments, …) ممنوع است مگر Product Owner تأیید کند.

## Architecture
- Frontend: Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui + react-router.
- Backend/DB: Convex (queries = reactive subscriptions; mutations; no other backend).
- Auth: Convex Auth (email OTP + anonymous/guest). Tenant context (`schoolId`) **همیشه** از session کاربر استخراج می‌شود، نه از client.
- Authorization: Deny by default — هر query/mutation باید schoolId را از user بگیرد.

## Repository Structure
```
src/
  convex/          # schema + queries/mutations (one module per entity)
  pages/           # Landing, Auth, Dashboard layout
  pages/dashboard/ # Overview, Students, Parents, Drivers, Vehicles, Routes, Services, Reports, AuditLog
  components/ui/   # shadcn components
docs/
```

## Conventions
- Persian (fa) RTL UI. Minimalism theme: near-monochrome palette, subtle dividers, generous whitespace.
- No business logic in UI — validation/state transitions live in Convex mutations.
- Attendance events are **append-only**; corrections add a new event, never overwrite.
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
