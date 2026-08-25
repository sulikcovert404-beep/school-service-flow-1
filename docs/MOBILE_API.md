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
- **احراز هویت**: `ConvexClientWithAuth` + `AuthProvider` سفارشی — پروتکل تأییدشده از سورس `@convex-dev/auth` (بخش ۱).

## ۱. احراز هویت

- روش: **Email OTP** (Convex Auth) — توکن session به‌صورت خودکار توسط SDK مدیریت می‌شود.
- جریان:
  1. `auth/emailOtp:signIn` با `{ email }` → کد ۶ رقمی به ایمیل ارسال می‌شود.
  2. همان تابع با `{ email, code }` → session token.
- توکن را در **EncryptedSharedPreferences / Keystore** نگه دارید (هرگز plaintext).
- نقش‌ها: `school_admin | driver | parent | admin` — نقش کاربر از `bootstrap.myContext` خوانده می‌شود.
- **پل Auth برای اندروید — بدون تغییر بک‌اند (تأییدشده از سورس):** `signIn` یک action عمومی Convex است و از خود `ConvexClient` اندروید فراخوانی می‌شود:

```kotlin
// ۱) ارسال کد به ایمیل → { started: true }
convex.action("auth:signIn", mapOf(
    "provider" to "email-otp",
    "params" to mapOf("email" to email),
))

// ۲) تأیید کد → { tokens: { token, refreshToken } }
val res = convex.action<SignInResult>("auth:signIn", mapOf(
    "provider" to "email-otp",
    "params" to mapOf("email" to email, "code" to code),
))
// res.tokens!!.token / refreshToken را در EncryptedSharedPreferences ذخیره کن

// ۳) تازه‌سازی session (وقتی access token نزدیک انقضا بود)
convex.action<SignInResult>("auth:signIn", mapOf("refreshToken" to savedRefreshToken))

// ۴) خروج
convex.action("auth:signOut", emptyMap())
```

سپس `ConvexClientWithAuth<String>` را با یک `AuthProvider<String>` سفارشی بسازید — اینترفیس **رسمی** SDK (تأییدشده از سورس convex-mobile، نسخه 0.8.0):

```kotlin
interface AuthProvider<T> {
    suspend fun login(context: Context, onIdToken: (String?) -> Unit): Result<T>
    suspend fun loginFromCache(onIdToken: (String?) -> Unit): Result<T>  // پیش‌فرض: NotImplementedError
    suspend fun logout(context: Context): Result<Void?>
    fun extractIdToken(authResult: T): String
}
```

الگوی پیاده‌سازی (در `android/app/.../ConvexAuthProvider.kt` همین ریپو، مرجع کامل):
- callback `onIdToken` را ذخیره کنید؛ اگر توکن کش‌شده دارید همان‌جا `onIdToken(token)` صدا بزنید
- بعد از verify/refresh موفق، `onTokensUpdated` توکن تازه را از طریق همان callback به کلاینت push می‌کند
- یک‌بار در شروع Activity: `convex.login(context)` (callback را ثبت می‌کند؛ بدون سشن fail بی‌ضرر است)

⚠️ `subscribe` برمی‌گرداند `Flow<Result<T>>` — با `result.onSuccess { }` جمع کنید (نه مستقیم T).
⚠️ `ConvexClientWithAuth` بدون type parameter استفاده نکنید — همیشه `ConvexClientWithAuth<String>`.

(این همان پروتکلی است که کلاینت وب React هم استفاده می‌کند — هیچ endpoint اضافه‌ای لازم نیست.)

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
