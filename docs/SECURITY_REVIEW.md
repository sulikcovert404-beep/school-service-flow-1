# SECURITY_REVIEW.md — بازبینی امنیتی (فاز Production-Hardening)

> تاریخ: ۲۰۲۶-۰۸-۲۴ · محدوده: نسخه فعلی پلتفرم (فاز ۱+۲+۳)

## یافته‌های رفع‌شده در این فاز

| # | یافته | شدت قبلی | وضعیت |
|---|---|---|---|
| ۱ | دریافت نقش Super Admin فقط با یک کلیک (demo claim) — هر کاربر واردشده می‌توانست ادمین پلتفرم شود | **Critical** | ✅ رفع شد: `claimSuperAdmin` حالا کلید `SUPER_ADMIN_SETUP_KEY` از Keys tab می‌خواهد، فقط برای **اولین** ادمین کار می‌کند، brute-force محدود (۵ تلاش/۱۰ دقیقه) و در Audit Log ثبت می‌شود. بعد از bootstrap، ادمین جدید فقط توسط Super Admin موجود (`setUserRole`) قابل واگذاری است. |
| ۲ | نبود Rate Limiting روی مسیر نوشتن رویداد | **Medium** | ✅ رفع شد: limiter ثابت دیتابیسی (`rateLimits`) — حداکثر ۶۰۰ رویداد/دقیقه به‌ازای هر مدرسه (حدود ۱۷ برابر peak واقعی مدرسه ۱۰۰۰ نفری). خطای `RATE_LIMITED` → کلاینت باید backoff نمایی کند. |

## کنترل‌های فعال موجود

- **Tenant Isolation**: همه query/mutation ها `schoolId` را از session استخراج می‌کنند (deny by default) — cross-tenant → `FORBIDDEN`.
- **Authorization**: گاردهای `requireSchoolAdmin / requireDriverActor / requireParentActor / requireSuperAdmin` روی همه توابع حساس.
- **غیرفعال‌سازی فوری کاربر**: `isActive=false` در همه گاردها = بدون احراز.
- **Idempotency**: رویدادهای راننده با `idempotencyKey` — retry هرگز duplicate نمی‌سازد.
- **Append-only Audit**: همه عملیات حساس در `auditLogs`؛ اکشن‌های پلتفرمی هم لاگ می‌شوند.
- **Secrets**: همه کلیدها (Firebase، VAPID، Setup Key) از environment variables — هیچ secret در کد/کلاینت.
- **Web Push**: کلید private فقط سمت سرور؛ کلید public از کوئری عمومی (طبیعتاً public).
- **Brute-force**: محدودیت روی تلاش‌های claim کلید setup.
- **Invite flow کامل**: ادمین‌های جدید فقط توسط Super Admin موجود (`setUserRole`) ساخته می‌شوند؛ تخصیص کاربر به تننت مدرسه فقط با `setUserSchool` (Super Admin) و با audit — کاربر عادی نمی‌تواند خودش را به مدرسه‌ای اضافه کند. ادمین پلتفرم عمداً بدون تننت است.

## یافته‌های باقی‌مانده (قبل از Production واقعی)

| # | یافته | شدت | اقدام لازم |
|---|---|---|---|
| ۱ | ورود Guest/anonymous فعال است (پیش‌فرض برای دمو) | **High** | ✅ کنترل فراهم شد: متغیر `ENABLE_GUEST_LOGIN=false` در Keys tab → دکمه ورود مهمان از صفحه ورود حذف و فقط OTP باقی می‌ماند. **قبل از production این متغیر را تنظیم کنید.** |
| ۲ | OTP ایمیل بدون محدودیت تلاش در سطح Auth | Medium | rate limit روی `auth/emailOtp` یا CAPTCHA. |
| ۳ | لاگ‌های حساس: نام دانش‌آموز در body اعلان‌ها ذخیره می‌شود | Low | Data-minimization: در production فقط نام کوچک + کد. |
| ۴ | Retention/Archiving رویدادها پیاده نشده (Partition-ready است) | Low | قبل از مقیاس بزرگ: policy حذف/آرشیو. |
| ۵ | تست نفوذ و Security Review مستقل انجام نشده | — | قبل از launch واقعی. |
