# School Service Platform — v1 Documentation

> Source of Truth. نسخهٔ ۱ دقیقاً همین محدوده را پوشش می‌دهد و هیچ چیز بیشتر.

## SCOPE.md — Version 1

**شامل:**
- داشبورد وب مدرسه (School Web Dashboard) — مینیمال، Responsive، RTL.
- کاربران نسخه اول: فقط مدیر مدرسه (School Admin).
- مدیریت: دانش‌آموزان، والدین، رانندگان، خودروها، مسیرها، سرویس‌ها + تخصیص دانش‌آموز به سرویس.
- ثبت وضعیت رفت‌وبرگشت به‌صورت Event append-only:
  `PICKED_UP · DROPPED_OFF · ABSENT`
- نمای کلی با آمار زنده: کل دانش‌آموزان / رانندگان / خودروها / سرویس‌ها + سوار شده، در انتظار، پیاده شده.
- مانیتورینگ زنده سرویس‌های امروز و ثبت دستی وضعیت توسط مدیر (MANUAL_OVERRIDE در Audit).
- گزارش رویدادها با فیلتر + Audit Log.

**خارج از نسخه ۱ (ممنوع تا تأیید Product Owner):**
Android Apps واقعی · Live GPS / Tracking · ETA · Payments · Messaging · AI Route Optimization.

## فاز ۲ — فلو کامل راننده → سرور → والد (طبق دیاگرام معماری)

- **کنسول راننده (وب، `/driver`)**: انتخاب سرویس/شیفت، فهرست دانش‌آموزان، ثبت یک‌لمسی `PICKED_UP` / `DROPPED_OFF`، **offline-first** (صف محلی در localStorage، نشانگر Pending Sync، retry خودکار با backoff).
- **مسیر بحرانی نوشتن**: `driverApp.recordEvent` → اعتبارسنجی مالکیت سرویس/دانش‌آموز → بررسی `idempotencyKey` (retry هرگز duplicate نمی‌سازد) → درج append-only → enqueue اعلان (outbox) → audit log → پاسخ موفق.
- **Transactional Outbox اعلان‌ها**: جدول `notifications` با وضعیت `QUEUED / SENT / FAILED`؛ Worker هر دقیقه (Convex cron) صف را تخلیه می‌کند. در v1 ارسال شبیه‌سازی شده است — جای‌گذاری FCM فقط همین handler را تغییر می‌دهد.
- **پورتال والد (وب، `/parent`)**: وضعیت زنده فرزندان، تایم‌لاین امروز، اطلاعات سرویس/راننده/خودرو، تاریخچه اعلان‌ها.
- **لاگ اعلان‌ها در داشبورد مدرسه** (`/dashboard/notifications`).
- **Super Admin (وب، `/admin`)**: نقش `admin` — نمای کلی پلتفرم، مدیریت Tenantها (ایجاد/ویرایش/فعال‌وغیرفعال مدارس)، مدیریت کاربران سراسری (تغییر نقش + فعال/غیرفعال با قطع دسترسی فوری)، گزارش سراسری رویدادها، لاگ اعلان‌های همه مدارس، حسابرسی سراسری. همه عملیات حساس Super Admin در `auditLogs` ثبت می‌شود (schoolId اختیاری برای اکشن‌های پلتفرمی).

## فاز ۳ — PWA نصب‌شدنی + Web Push (جایگزین اپ Android در این محیط)

- **PWA**: `manifest.webmanifest` فارسی RTL + Service Worker (`public/sw.js`) — نصب روی اندروید (آیکون، تمام‌صفحه، standalone). دکمه «نصب اپ» در کنسول راننده (hook `use-pwa-install`).
- **Web Push مرورگر**: کانال دوم اعلان‌ها علاوه بر FCM. کلیدهای VAPID از `WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY` خوانده می‌شود؛ کلید public از کوئری `notifications.getWebPushPublicKey` به کلاینت می‌رسد و در پورتال والد بخش «اعلان‌های این دستگاه» اشتراک Push را ثبت می‌کند (جدول `devices` با platform `web`).
- **Worker دوکاناله**: `fcm.deliverOutbox` برای دستگاه‌های `android` از FCM HTTP v1 و برای `web` از پروتکل Web Push (VAPID) استفاده می‌کند؛ اشتراک منقضی (404/410) حذف می‌شود.

## ARCHITECTURE.md

- **Modular Monolith روی Convex**: schema واحد + ماژول‌های query/mutation به تفکیک entity.
- **Multi-Tenant**: هر School یک Tenant؛ `schoolId` همیشه از session کاربر استخراج می‌شود (هرگز از client پذیرفته نمی‌شود). Cross-tenant access → Forbidden.
- **Event-oriented**: `attendanceEvents` کاملاً append-only؛ اصلاح وضعیت = رویداد جدید (CORRECTED/MANUAL_OVERRIDE) نه overwrite.
- **Server time** مرجع زمانی است.
- مسیر رشد آینده (خارج از v1): Outbox → Queue → Workers برای Push، Partition-ready بودن جدول رویدادها با index‌های `(schoolId, serverTimestamp)`.

## DATA_MODEL.md

| Table | توضیح |
|---|---|
| schools | Tenant اصلی |
| users | کاربر Convex Auth + role (`school_admin` در v1) + schoolId |
| students / parents / parentLinks | دانش‌آموز، والد، رابط چند‌به‌چند |
| drivers / vehicles / routes | منابع سرویس |
| services | ترکیب route+vehicle+driver+shift (morning/return) |
| serviceStudents | تخصیص دانش‌آموز به سرویس |
| attendanceEvents | رویداد رفت‌وبرگشت (append-only، دارای idempotencyKey) |
| notifications | Outbox اعلان‌های والدین (QUEUED/SENT/FAILED) |
| auditLogs | لاگ عملیات حساس |

## DECISIONS.md

1. **Convex به‌جای NestJS/PostgreSQL**: محیط اجرای این نسخه Freebuff/Convex است؛ مدل داده و مرزهای ماژول‌ها طوری طراحی شده که مفاهیم (Tenant enforcement، Event append-only، Audit) مستقل از پلتفرم بمانند.
2. **Guest/OTP login حفظ شده** تا تست سریع داشبورد ممکن باشد؛ نقش admin هنگام bootstrap مدرسه صادر می‌شود.
3. **ثبت دستی وضعیت در v1**: چون Driver App خارج از scope است، مدیر مدرسه می‌تواند وضعیت را دستی ثبت کند (با Audit) تا جریان Event و آمار زنده قابل استفاده باشد.
4. Minimalism theme طبق خواسته Product Owner: تک‌رنگ، divider ظریف، whitespace زیاد.
5. **فاز ۲ به‌جای اپ Android**: در این محیط فقط وب قابل اجراست؛ کنسول راننده و پورتال والد همان قرارداد API و جریان رویداد اپ‌های Android را پیاده می‌کنند (offline queue + idempotency + outbox) تا انتقال آینده به Kotlin/Compose صرفاً لایه UI باشد.
6. **پیش‌نمایش نقش (Role Preview)**: در دمو، مدیر مدرسه می‌تواند کنسول راننده/پورتال والد را برای راننده/والدِ تننت خودش باز کند؛ کاربران واقعی `driver`/`parent` هم از همان گاردها عبور می‌کنند. Cross-tenant همچنان Forbidden است.
8. **دسترسی Super Admin**: تغییر نقش/غیرفعال‌سازی کاربر خودش ممنوع (`CANNOT_CHANGE_SELF`)؛ کاربر `isActive=false` در همه گاردها مثل بدون‌احراز رفتار می‌شود.
7. **ارسال اعلان FCM واقعی وصل شد** (FCM HTTP v1 با OAuth JWT سرویس‌اکانت؛ متغیرهای `FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY`). تست اتصال: **Passed** (پروژه app-school-1ecc8). تحویل به دستگاه واقعی نیازمند ثبت توکن Push والدین (جدول `devices`) است؛ والد بدون دستگاه ثبت‌شده → وضعیت SENT با یادداشت `NO_DEVICE_REGISTERED` تا صف گیر نکند. بدون کلید → ارسال شبیه‌سازی می‌ماند.
8. **فاز ۳ (PWA + Web Push)**: اپ Android واقعی (Kotlin) در این محیط قابل build نیست؛ PWA همان جریان (offline queue + idempotency + push) را به‌صورت نصب‌شدنی روی اندروید ارائه می‌دهد. کلیدهای VAPID تولید شده و باید در Keys tab وارد شوند تا کانال Web Push فعال شود.

## SCALE_TARGETS.md

اعداد معماری (۵۵۶ eps میانگین خام در مقیاس ۱M دانش‌آموز) فقط Target هستند و بدون Benchmark واقعی Verified اعلام نمی‌شوند. در v1 هیچ benchmark اجرا نشده — status: **Not measured**.
