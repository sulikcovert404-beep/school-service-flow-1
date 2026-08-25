# سامانه مدیریت سرویس مدارس — نسخه ۱ + فاز ۲

پلتفرم مدیریت سرویس رفت‌وبرگشت دانش‌آموزان — فلو کامل «راننده → سرور → والد».

## محدوده نسخه ۱ (LOCKED)
- **داشبورد وب مدرسه** با کاربر **مدیر مدرسه (School Admin)**.
- مدیریت دانش‌آموزان، والدین، رانندگان، خودروها، مسیرها و سرویس‌ها.
- ثبت وضعیت رفت‌وبرگشت به‌صورت رویدادهای فقط‌الحاقی (`PICKED_UP / DROPPED_OFF / ABSENT`) + مانیتورینگ زنده امروز.
- گزارش رویدادها + لاگ حسابرسی.

## فاز ۲ (تأییدشده طبق دیاگرام معماری)
- **کنسول راننده** (`/driver`) — offline-first: صف محلی، Pending Sync، retry خودکار، ثبت یک‌لمسی با idempotency key (retry هرگز duplicate نمی‌سازد).
- **پورتال والد** (`/parent`) — وضعیت زنده، تایم‌لاین امروز، اطلاعات سرویس/راننده، تاریخچه اعلان‌ها.
- **اعلان‌های async** — Transactional Outbox (`notifications`: QUEUED/SENT/FAILED) + Worker هر دقیقه (cron). ارسال در v1 شبیه‌سازی شده (FCM آماده اتصال).
- **لاگ اعلان‌ها** در داشبورد مدرسه (`/dashboard/notifications`).
- **Super Admin** (`/admin`) — آمار کل پلتفرم و جدول مدارس (نقش `admin`).
- اپ‌های Android واقعی، Live GPS، Payments و… خارج از محدوده است.

## فاز ۳ — PWA + Web Push
- **نصب اپ روی اندروید**: لینک را در Chrome گوشی باز کنید → دکمه «نصب اپ» (کنسول راننده) یا «نصب اپ روی این دستگاه» (پورتال والد) → آیکون، تمام‌صفحه، کارکرد آفلاین.
- **Web Push مرورگر**: پورتال والد → «اعلان‌های این دستگاه» → فعال‌سازی. نیازمند کلیدهای `WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY` در Keys tab.
- ارسال اعلان دوکاناله است: دستگاه اندروید → FCM · مرورگر → Web Push (VAPID).

## Super Admin (امن)
- نقش مدیر پلتفرم فقط با **کلید Setup** فعال می‌شود: متغیر `SUPER_ADMIN_SETUP_KEY` را در Keys tab تعریف کنید → در `/admin` کلید را وارد کنید.
- فقط برای **اولین** ادمین کار می‌کند؛ ادمین‌های بعدی فقط توسط Super Admin موجود واگذار می‌شوند. brute-force محدود + Audit Log.
- تخصیص کاربر به تننت مدرسه فقط با Super Admin انجام می‌شود (تب کاربران → «تخصیص») و در حسابرسی ثبت می‌شود.

## فاز ۴ — Hardening production
- **غیرفعال‌سازی ورود مهمان**: متغیر `ENABLE_GUEST_LOGIN=false` را در Keys tab تعریف کنید → دکمه «ورود مهمان» از صفحه ورود حذف می‌شود و فقط OTP واقعی باقی می‌ماند. (پیش‌فرض برای دمو: فعال)
- **Rate limiting**: حداکثر ۶۰۰ رویداد/دقیقه به‌ازای هر مدرسه (`rateLimits`).
- **قطع دسترسی فوری**: کاربر غیرفعال‌شده توسط Super Admin در همه گاردها مثل بدون‌احراز رفتار می‌کند.
- چک‌لیست کامل: `docs/SECURITY_REVIEW.md`.

## Stack
Vite · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Convex (backend/db) · Convex Auth (Email OTP + Guest اختیاری) · FCM + Web Push

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
- رویدادهای راننده `idempotencyKey` دارند؛ اعلان‌ها فقط async (outbox + worker) هستند و هرگز مسیر نوشتن را مسدود نمی‌کنند.
- زمان سرور مرجع اصلی است.
- مستندات کامل: `docs/SCOPE.md` و `AGENTS.md` · قرارداد API اپ‌های اندروید: `docs/MOBILE_API.md` · بازبینی امنیتی: `docs/SECURITY_REVIEW.md` · نتایج Benchmark: `docs/SCOPE.md` (بخش SCALE_TARGETS).
