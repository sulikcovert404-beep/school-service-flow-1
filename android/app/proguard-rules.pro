# Convex Android SDK
-keep class dev.convex.** { *; }
# kotlinx.serialization models
-keepclassmembers class com.schoolservice.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.schoolservice.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}
