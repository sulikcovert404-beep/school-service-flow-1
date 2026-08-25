package com.schoolservice.app.parent

import dev.convex.android.ConvexClientWithAuth
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Parent app data — everything is a reactive Convex subscription, exactly like
 * the web Parent Portal. No polling anywhere.
 */
class ParentRepository(private val convex: ConvexClientWithAuth<String>) {

    /** Live today-status of all children (Today Status + Timeline source). */
    fun myChildren(): Flow<String?> =
        convex.subscribe<String>("parentApp:myChildren", args = emptyMap())
            .map { it.getOrNull() }

    /** Notification history (verified: notifications.listForParent). */
    fun notifications(): Flow<String?> =
        convex.subscribe<String>("notifications:listForParent", args = emptyMap())
            .map { it.getOrNull() }

    /**
     * Registers this device's FCM token so the notification worker can target
     * it (platform="android"). Server: notifications.registerDevice — guarded,
     * parent-role only.
     */
    suspend fun registerPushToken(token: String) {
        // registerDevice is a MUTATION (verified in src/convex/notifications.ts)
        convex.mutation<Unit>(
            "notifications:registerDevice",
            args = mapOf("token" to token, "platform" to "android"),
        )
    }
}
