package com.schoolservice.app.driver

import com.schoolservice.app.SchoolServiceApp
import dev.convex.android.ConvexClientWithAuth
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class RecordEventResult(val duplicate: Boolean? = null, val eventId: String? = null)

class DriverRepository(private val convex: ConvexClientWithAuth<String>) {

    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Live roster — reactive Flow, same as the web subscription. UI rebuilds
     * automatically whenever any student's status changes server-side.
     */
    fun roster(serviceId: String): Flow<String?> =
        convex.subscribe<String>(
            "driverApp:serviceRoster",
            args = mapOf("serviceId" to serviceId),
        ).map { it.getOrNull() }

    /**
     * Records an event through the offline queue. UI updates optimistically;
     * the queue + SyncWorker guarantee delivery with a stable idempotencyKey.
     */
    suspend fun recordEvent(serviceId: String, studentId: String, eventType: String) {
        val event = PendingEventQueue.newEvent(serviceId, studentId, eventType)
        queue.enqueue(event)
        trySend(event)
    }

    private suspend fun trySend(event: PendingEvent): Boolean {
        return try {
            // recordEvent is a MUTATION (verified in src/convex/driverApp.ts)
            val raw = convex.mutation<String>(
                "driverApp:recordEvent",
                args = mapOf(
                    "serviceId" to event.serviceId,
                    "studentId" to event.studentId,
                    "eventType" to event.eventType,
                    "idempotencyKey" to event.idempotencyKey,
                    "clientTimestamp" to event.clientTimestamp,
                    "deviceId" to deviceId,
                ),
            )
            val result = json.decodeFromString(RecordEventResult.serializer(), raw ?: "{}")
            // duplicate=true means a retry hit an already-recorded event — success.
            queue.markSynced(event.idempotencyKey)
            true
        } catch (err: Exception) {
            // Offline / network / RATE_LIMITED -> keep PENDING; SyncWorker retries.
            false
        }
    }

    private val queue by lazy { PendingEventQueue(appContext) }
    private val appContext get() = SchoolServiceApp.appContext
    private val deviceId: String get() = "android-${android.os.Build.FINGERPRINT.hashCode()}"
}
