package com.schoolservice.app.driver

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val Context.eventDataStore by preferencesDataStore(name = "pending_events")

@Serializable
data class PendingEvent(
    val idempotencyKey: String,
    val serviceId: String,
    val studentId: String,
    val eventType: String, // PICKED_UP | DROPPED_OFF
    val clientTimestamp: Long,
    val attempts: Int = 0,
)

/**
 * Offline-first queue for attendance events. The idempotencyKey is generated
 * ONCE when the user taps the button and NEVER changes across retries — the
 * server dedupes on it, so retries can never create duplicates
 * (docs/MOBILE_API.md §2.3).
 */
class PendingEventQueue(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }
    private val key = stringPreferencesKey("events_json")

    val pending: Flow<List<PendingEvent>> = context.eventDataStore.data.map { prefs ->
        decode(prefs[key] ?: "[]")
    }

    suspend fun enqueue(event: PendingEvent) {
        context.eventDataStore.edit { prefs ->
            val list = decode(prefs[key] ?: "[]") + event
            prefs[key] = json.encodeToString(list)
        }
    }

    suspend fun markSynced(idempotencyKey: String) {
        context.eventDataStore.edit { prefs ->
            prefs[key] = json.encodeToString(
                decode(prefs[key] ?: "[]").filter { it.idempotencyKey != idempotencyKey },
            )
        }
    }

    suspend fun snapshot(): List<PendingEvent> =
        decode(context.eventDataStore.data.first()[key] ?: "[]")

    private fun decode(raw: String): List<PendingEvent> =
        runCatching { json.decodeFromString(raw) }.getOrDefault(emptyList())

    companion object {
        fun newEvent(serviceId: String, studentId: String, eventType: String): PendingEvent =
            PendingEvent(
                idempotencyKey = java.util.UUID.randomUUID().toString(),
                serviceId = serviceId,
                studentId = studentId,
                eventType = eventType,
                clientTimestamp = System.currentTimeMillis(),
            )
    }
}
