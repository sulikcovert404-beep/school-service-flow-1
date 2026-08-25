package com.schoolservice.app.ui.driver

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.schoolservice.app.driver.DriverRepository
import com.schoolservice.app.driver.PendingEventQueue
import dev.convex.android.ConvexClientWithAuth
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class ServiceItem(
    val _id: String,
    val name: String,
    val shift: String? = null,
    val routeName: String? = null,
    val vehiclePlate: String? = null,
    val studentCount: Int = 0,
)

@Serializable
data class RosterRow(
    val studentId: String,
    val name: String,
    val grade: String? = null,
    val status: String = "waiting",
    val isActive: Boolean = true,
    val lastEventAt: Long? = null,
)

@Serializable
data class RosterService(val _id: String, val name: String, val shift: String? = null)

@Serializable
data class RosterResponse(val service: RosterService, val rows: List<RosterRow> = emptyList())

/**
 * Driver console — one-tap PICKED_UP / DROPPED_OFF per student, live roster
 * (reactive subscription), offline queue indicator. Touch targets are large;
 * the primary action is a single tap (MVP UX principle).
 */
@Composable
fun DriverScreen(convex: ConvexClientWithAuth, modifier: Modifier = Modifier) {
    val json = Json { ignoreUnknownKeys = true }
    val scope = rememberCoroutineScope()
    val repo = remember { DriverRepository(convex) }

    var services by remember { mutableStateOf<List<ServiceItem>>(emptyList()) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var roster by remember { mutableStateOf<RosterResponse?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val pending = remember { mutableStateListOf<PendingEvent>() }
    var pendingCount by remember { mutableIntStateOf(0) }

    // Services — one-shot read of the reactive subscription.
    LaunchedEffect(Unit) {
        try {
            val raw = convex.subscribe<String>("driverApp:myServices", args = emptyMap()).first { it.isSuccess }
            services = json.decodeFromString<List<ServiceItem>>(raw.getOrThrow())
            if (selectedId == null) selectedId = services.firstOrNull()?._id
        } catch (e: Exception) {
            error = "خطا در دریافت سرویس‌ها: ${e.message}"
        }
    }

    // Live roster — rebuilds automatically on every server change.
    LaunchedEffect(selectedId) {
        selectedId ?: return@LaunchedEffect
        try {
            convex.subscribe<String>(
                "driverApp:serviceRoster",
                args = mapOf("serviceId" to selectedId!!),
            ).collect { result ->
                result.onSuccess { raw ->
                    roster = json.decodeFromString(RosterResponse.serializer(), raw)
                }
            }
        } catch (e: Exception) {
            error = e.message
        }
    }

    // Pending sync badge.
    LaunchedEffect(Unit) {
        PendingEventQueue(convexAppContext()).pending.collect { list ->
            pending.clear(); pending.addAll(list); pendingCount = list.size
        }
    }

    Column(modifier = modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("سرویس‌های امروز", style = MaterialTheme.typography.titleMedium)
            if (pendingCount > 0) {
                Badge { Text("در انتظار همگام‌سازی: $pendingCount") }
            }
        }

        // Service picker chips.
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            services.forEach { s ->
                val selected = s._id == selectedId
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = androidx.compose.material3.CardDefaults.cardColors(
                        containerColor = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                    ),
                    onClick = { selectedId = s._id },
                ) {
                    Text(
                        "${s.name} (${s.studentCount})",
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }

        roster?.service?.let {
            Text(
                "${it.name} — شیفت ${if (it.shift == "morning") "صبح" else "برگشت"}",
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        // Student list — one big action button per student.
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(roster?.rows ?: emptyList(), key = { it.studentId }) { row ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text(row.name, style = MaterialTheme.typography.titleSmall)
                            Text(
                                when (row.status) {
                                    "picked_up" -> "سوار شده"
                                    "dropped_off" -> "پیاده شده"
                                    "absent" -> "غایب"
                                    else -> "در انتظار"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        val (label, eventType) = when (row.status) {
                            "waiting" -> "ثبت سوار شدن" to "PICKED_UP"
                            "picked_up" -> "ثبت پیاده شدن" to "DROPPED_OFF"
                            else -> null to null
                        }
                        if (label != null && eventType != null && selectedId != null) {
                            Button(
                                onClick = {
                                    scope.launch {
                                        try {
                                            repo.recordEvent(selectedId!!, row.studentId, eventType)
                                        } catch (e: Exception) {
                                            error = e.message
                                        }
                                    }
                                },
                                modifier = Modifier.padding(start = 8.dp),
                            ) { Text(label) }
                        } else {
                            Text(
                                "—",
                                modifier = Modifier.padding(horizontal = 12.dp),
                                color = Color.Gray,
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun convexAppContext() = com.schoolservice.app.SchoolServiceApp.appContext
