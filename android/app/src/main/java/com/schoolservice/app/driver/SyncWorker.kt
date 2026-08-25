package com.schoolservice.app.driver

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.schoolservice.app.SchoolServiceApp
import kotlinx.serialization.json.Json
import java.util.concurrent.TimeUnit

/**
 * Retries pending attendance events with exponential backoff (WorkManager
 * default policy). The idempotencyKey never changes, so retries are safe —
 * the server dedupes (duplicate=true is treated as success).
 */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun doWork(): Result {
        val convex = (applicationContext as? SchoolServiceApp)?.convex ?: return Result.failure()
        val queue = PendingEventQueue(applicationContext)
        var allSynced = true

        for (event in queue.snapshot()) {
            try {
                // recordEvent is a MUTATION (verified in src/convex/driverApp.ts)
                val raw = convex.mutation<String>(
                    "driverApp:recordEvent",
                    args = mapOf(
                        "serviceId" to event.serviceId,
                        "studentId" to event.studentId,
                        "eventType" to event.eventType,
                        "idempotencyKey" to event.idempotencyKey,
                        "clientTimestamp" to event.clientTimestamp,
                    ),
                )
                json.decodeFromString(RecordEventResult.serializer(), raw ?: "{}")
                queue.markSynced(event.idempotencyKey)
            } catch (err: Exception) {
                allSynced = false // keep PENDING; next run retries
            }
        }
        return if (allSynced) Result.success() else Result.retry()
    }

    companion object {
        /** Schedule once from SchoolServiceApp — runs when online, every 15 min. */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "pending-events-sync",
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }
}
