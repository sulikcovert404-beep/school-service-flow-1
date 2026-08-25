# MOBILE_API.md — قرارداد API برای اپ‌های Android (Kotlin / Jetpack Compose)

> بک‌اند از قبل کامل و تست‌شده است. اپ اندروید فقط یک کلاینت جدید است — **هیچ تغییر بک‌اندی لازم نیست**.
> ترنسپورت: **کلاینت رسمی Convex اندروید** (`dev.convex:android-convexmobile`) — بدون Retrofit/REST دستی.

## ۰. کلاینت رسمی Convex (ترنسپورت اصلی)

نیازی به لایه HTTP دستی نیست. `ConvexClient` مستقیماً query/mutation/action بک‌اند را اجرا می‌کند و subscriptionها را به‌صورت **Flow** ری‌اکتیو می‌گیرد:

```kotlin
// build.gradle.kts
plugins { kotlin("plugin.serialization") version "1.9.0" }
dependencies {
    implementation("dev.convex:android-convexmobile:0.8.0@aar") { isTransitive = true }
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
}

// Application — یک instance برای کل عمر پروسه
class App : Application() {
    lateinit var convex: ConvexClient
    override fun onCreate() {
        super.onCreate()
        convex = ConvexClient("https://<deployment>.convex.cloud")
    }
}

// Subscription زنده (مثلاً roster راننده) — مثل وب reactive است:
scope.launch {
    convex.subscribe<Roster>("driverApp:serviceRoster",
        args = mapOf("serviceId" to serviceId)).collect { result ->
        result.onSuccess { ui.update(it) }
    }
}

// ثبت رویداد (idempotent):
val res = convex.mutation<RecordEventResult>("driverApp:recordEvent", args = mapOf(
    "serviceId" to serviceId, "studentId" to studentId,
    "eventType" to "PICKED_UP", "idempotencyKey" to key,
))
```

نکات:
- `duplicate: true` در پاسخ = retry تکراری بوده → مثل موفقیت رفتار کنید.
- خطاها: `ConvexError` / `ServerError` را بگیرید؛ `RATE_LIMITED` → backoff نمایی.
- URL deployment را با build flavor جدا کنید (debug/release).
- **احراز هویت**: `ConvexClientWithAuth` + پیاده‌سازی سفارشی `AuthProvider` برای Convex Auth (OTP) — Auth0/Clerk آماده‌اند ولی ما OTP خودمان را داریم؛ پل کوچک auth در بخش ۱.

## ۱. احراز هویت

- روش: **Email OTP** (Convex Auth) — توکن session به‌صورت خودکار توسط SDK مدیریت می‌شود.
- جریان:
  1. `auth/emailOtp:signIn` با `{ email }` → کد ۶ رقمی به ایمیل ارسال می‌شود.
  2. همان تابع با `{ email, code }` → session token.
- توکن را در **EncryptedSharedPreferences / Keystore** نگه دارید (هرگز plaintext).
- نقش‌ها: `school_admin | driver | parent | admin` — نقش کاربر از `bootstrap.myContext` خوانده می‌شود.
- **پل Auth برای اندروید**: `AuthProvider` سفارشی که توکن Convex Auth را بعد از OTP تأییدشده به `ConvexClientWithAuth` می‌دهد. اگر مسیر مستقیم OTP از SDK ممکن نشد، یک `httpAction` کوچک سمت بک‌اند اضافه می‌شود (تنها تغییر بک‌اندی احتمالی این فاز).

## ۲. اپ راننده (Driver App)

### ۲.۱ سرویس‌های امروز
`driverApp.myServices` (query) — args: `{}` (برای راننده واقعی؛ بدون آرگومان)
```json
[{ "_id": "...", "name": "سرویس صبح", "shift": "morning|return",
   "routeName": "مسیر سعادت‌آباد", "vehiclePlate": "12‌ب345 ایران 22", "studentCount": 14 }]
```

### ۲.۲ فهرست زنده دانش‌آموزان
`driverApp.serviceRoster` (query) — args: `{ serviceId }`
```json
{ "service": { "_id": "...", "name": "...", "shift": "morning" },
  "rows": [{ "studentId": "...", "name": "علی احمدی", "grade": "1",
             "status": "waiting|picked_up|dropped_off|absent",
             "isActive": true, "lastEventAt": 1724500000000 }] }
```
Query واکنشی است — با هر تغییر سرور، UI خودکار به‌روز می‌شود (نیازی به polling نیست).

### ۲.۳ ثبت رویداد — مسیر بحرانی (idempotent)
`driverApp.recordEvent` (mutation)
```json
// args
{ "serviceId": "...", "studentId": "...",
  "eventType": "PICKED_UP" | "DROPPED_OFF",
  "idempotencyKey": "uuid-v4-کلاینت",
  "clientTimestamp": 1724500000000,   // اختیاری
  "deviceId": "android-<device-id>" } // اختیاری

// response
{ "duplicate": false, "eventId": "..." }   // duplicate=true یعنی retry تکراری بود → موفق
```

**قرارداد Offline-first (اجباری برای کلاینت اندروید):**
1. کاربر دکمه را می‌زند → فوراً در Room (دیتابیس محلی) با `idempotencyKey = UUID.randomUUID()` ذخیره کن و وضعیت UI را optimistic آپدیت کن.
2. اگر آنلاین → mutation را بفرست؛ موفق → رکورد محلی را `SYNCED` کن.
3. اگر آفلاین یا خطا → رکورد را `PENDING` نگه دار؛ با WorkManager (backoff نمایی) retry کن.
4. `idempotencyKey` **هرگز** در retry عوض نشود — سرور با ایندکس اختصاصی dedupe می‌کند؛ retry هرگز duplicate نمی‌سازد.
5. پاسخ `duplicate: true` را مثل موفقیت处理 کن.

**محدودیت سرور:** حداکثر ۶۰۰ رویداد در دقیقه به‌ازای هر مدرسه (`RATE_LIMITED`) — با backoff نمایی retry کنید.

## ۳. اپ والد (Parent App)

### ۳.۱ فرزندان + وضعیت زنده امروز
`parentApp.myChildren` (query) — args: `{}` → آرایه‌ای از:
```json
{ "studentId": "...", "name": "علی احمدی", "grade": "1", "className": "2",
  "status": "waiting|picked_up|dropped_off|absent",
  "timeline": [{ "id": "...", "eventType": "PICKED_UP", "serverTimestamp": 1724500000000,
                 "serviceName": "سرویس صبح" }],
  "service": { "name": "...", "shift": "morning",
               "driverName": "...", "driverPhone": "...", "vehiclePlate": "...", "routeName": "..." } }
```

### ۳.۲ تاریخچه سرویس
`parentApp.childHistory` (query) — args: `{ studentId }` → ۶۰ رویداد آخر (نزولی).

### ۳.۳ تاریخچه اعلان‌ها
`notifications.listForParent` (query) — args: `{}` → ۵۰ اعلان آخر با `status: QUEUED|SENT|FAILED`.

### ۳.۴ ثبت توکن Push (FCM)
`notifications.registerDevice` (mutation)
```json
{ "token": "<FCM registration token>", "platform": "android" }
```
- بعد از هر login و هر چرخش توکن FCM صدا بزنید.
- پیام‌های ورودی: `{ title, body }` — متن فارسی، مثلاً «علی احمدی ساعت ۰۷:۱۲ سوار سرویس مدرسه شد.»

## ۴. کدهای خطا (استاندارد همه توابع)

| کد | معنی | رفتار پیشنهادی کلاینت |
|---|---|---|
| `UNAUTHENTICATED` | بدون session | ورود مجدد |
| `FORBIDDEN` | نقش/تننت مجاز نیست | پیام خطا — retry بی‌فایده |
| `RATE_LIMITED` | محدودیت نرخ | backoff نمایی |
| `STUDENT_NOT_FOUND` / `STUDENT_NOT_ON_SERVICE` / `SERVICE_NOT_FOUND` | داده نامعتبر | همگام‌سازی مجدد roster |
| `duplicate: true` | retry تکراری | مثل موفقیت |

## ۵. نکات امنیتی برای کلاینت

- توکن session و توکن FCM فقط در Encrypted Storage.
- هیچ `schoolId` از کلاینت ارسال/اعتماد نشود — سرور از session استخراج می‌کند.
- زمان مرجع همیشه سرور است (`serverTimestamp`)؛ `clientTimestamp` فقط برای audit.
- HTTPS/WSS اجباری (پیش‌فرض Convex).
