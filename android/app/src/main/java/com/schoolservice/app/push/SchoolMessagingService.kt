package com.schoolservice.app.push

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.schoolservice.app.SchoolServiceApp
import com.schoolservice.app.parent.ParentRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Receives FCM pushes ("علی احمدی ساعت ۰۷:۱۲ سوار سرویس مدرسه شد") and keeps
 * the device token registered in the backend (devices table, platform=android).
 */
class SchoolMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        // The backend sends notification title/body; system tray handles
        // display when the app is backgrounded (default FCM behavior).
        // Foreground handling (in-app banner) can be added later.
    }

    override fun onNewToken(token: String) {
        val app = applicationContext as? SchoolServiceApp ?: return
        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                ParentRepository(app.convex).registerPushToken(token)
            }
        }
    }
}
