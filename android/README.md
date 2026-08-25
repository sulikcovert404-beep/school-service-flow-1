# android/ — اسکلت اپ Android (Kotlin + Compose + ConvexClient رسمی)

> **وضعیت: Skeleton — Implemented but not compiled.** این محیط Android SDK ندارد؛
> فایل‌ها باید در Android Studio باز، کامپایل و اجرا شوند. API های SDK (مثل
> `AuthProvider`) را در برابر نسخه `android-convexmobile:0.8.0` چک کنید —
> منطق و قراردادها از `docs/MOBILE_API.md` (تأییدشده از سورس بک‌اند) آمده‌اند.

## راه‌اندازی (۱۰ دقیقه)

1. **Android Studio** (Ladybug یا جدیدتر) → `Open` → پوشه `android/`
2. در `app/build.gradle.kts` مقدار `convex_url` را با deployment واقعی عوض کنید
   (یا بهتر: از `local.properties` بخوانید — commit نکنید)
3. برای Push والد:
   - Firebase Console → پروژه `app-school-1ecc8` → افزودن اپ Android با package `com.schoolservice.app`
   - فایل `google-services.json` را در `app/` بگذارید
4. `Run` ▶️

## Build آنلاین (GitHub Actions — بدون Android Studio)

workflow آماده است: `.github/workflows/android-build.yml`

1. در GitHub ریپو: **Settings → Secrets and variables → Actions → New repository secret**
   - `CONVEX_URL` (الزامی) — آدرس deployment Convex، مثلاً `https://xxxx.convex.cloud`
   - `GOOGLE_SERVICES_JSON` (اختیاری) — کل محتوای فایل google-services.json برای Push والد
2. تب **Actions** → workflow «Android APK» → **Run workflow** (یا هر push به پوشه `android/`)
3. بعد از اتمام → همان اجرا → بخش **Artifacts** → دانلود `app-debug-apk` → نصب روی گوشی

اگر `GOOGLE_SERVICES_JSON` تعریف نشده باشد، build بدون پلاگین Firebase انجام می‌شود (اپ کار می‌کند، فقط Push والد اندروید غیرفعال است).

## ساختار

```
app/src/main/java/com/schoolservice/app/
  SchoolServiceApp.kt        # Application — یک ConvexClient برای کل عمر پروسه
  auth/
    SessionStore.kt          # ذخیره امن توکن‌ها (EncryptedSharedPreferences)
    ConvexAuthProvider.kt    # پل توکن به ConvexClientWithAuth
    AuthRepository.kt        # فلو OTP چهارمرحله‌ای (auth:signIn)
  driver/
    PendingEventQueue.kt     # صف آفلاین رویدادها (DataStore + JSON)
    DriverRepository.kt      # subscribe زنده roster + recordEvent idempotent
    SyncWorker.kt            # WorkManager — retry با backoff نمایی
  parent/
    ParentRepository.kt      # وضعیت زنده فرزندان + ثبت توکن Push
  push/
    SchoolMessagingService.kt # FCM — دریافت و ثبت توکن دستگاه
  ui/
    MainActivity.kt          # ورود OTP + فهرست حداقلی (Compose)
```

## قراردادهای اجباری (از docs/MOBILE_API.md)

- هر رویداد راننده یک `idempotencyKey` (UUID) دارد که **در retry هرگز عوض نمی‌شود**
- پاسخ `duplicate: true` = موفق (retry تکراری بود)
- خطای `RATE_LIMITED` → backoff نمایی
- توکن‌ها فقط در EncryptedSharedPreferences / Keystore
