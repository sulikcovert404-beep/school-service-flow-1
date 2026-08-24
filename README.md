# سامانه مدیریت سرویس مدارس — نسخه ۱

داشبورد وب مدرسه برای مدیریت سرویس رفت‌وبرگشت دانش‌آموزان.

## محدوده نسخه ۱ (LOCKED)
- **فقط داشبورد وب مدرسه** با کاربر **مدیر مدرسه (School Admin)**.
- مدیریت دانش‌آموزان، والدین، رانندگان، خودروها، مسیرها و سرویس‌ها.
- ثبت وضعیت رفت‌وبرگشت به‌صورت رویدادهای فقط‌الحاقی (`PICKED_UP / DROPPED_OFF / ABSENT`) + مانیتورینگ زنده امروز.
- گزارش رویدادها + لاگ حسابرسی.
- هر چیز دیگر (Driver/Parent App، Super Admin، GPS، پرداخت و…) خارج از این نسخه است.

## Stack
Vite · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Convex (backend/db) · Convex Auth (Email OTP + Guest)

## اجرا
```bash
bun install
bun dev            # frontend
bun convex dev     # backend
```

## Commands
- Typecheck: `bun tsc -b --noEmit`
- Convex codegen + check: `bun convex dev --once && bun tsc -b --noEmit`

## نکات معماری
- Multi-tenant: هر مدرسه یک Tenant؛ `schoolId` همیشه از نشست کاربر استخراج می‌شود (deny by default).
- رویدادهای حضور append-only هستند؛ اصلاح وضعیت = رکورد جدید + لاگ حسابرسی.
- زمان سرور مرجع اصلی است.
- مستندات کامل: `docs/SCOPE.md` و `AGENTS.md`.
