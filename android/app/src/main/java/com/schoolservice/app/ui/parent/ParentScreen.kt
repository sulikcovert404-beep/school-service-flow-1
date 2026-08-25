package com.schoolservice.app.ui.parent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.schoolservice.app.parent.ParentRepository
import dev.convex.android.ConvexClientWithAuth
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Serializable
data class TimelineEntry(
    val id: String,
    val eventType: String,
    val serverTimestamp: Long,
    val serviceName: String? = null,
)

@Serializable
data class ChildServiceInfo(
    val name: String,
    val shift: String? = null,
    val driverName: String? = null,
    val driverPhone: String? = null,
    val vehiclePlate: String? = null,
    val routeName: String? = null,
)

@Serializable
data class Child(
    val studentId: String,
    val name: String,
    val grade: String? = null,
    val className: String? = null,
    val status: String = "waiting",
    val lastEventAt: Long? = null,
    val timeline: List<TimelineEntry> = emptyList(),
    val service: ChildServiceInfo? = null,
)

private val faTime = SimpleDateFormat("HH:mm", Locale("fa"))

/**
 * Parent portal — live today-status of all children, per-child timeline
 * («علی احمدی ساعت ۰۷:۱۲ سوار سرویس مدرسه شد»), driver/vehicle info.
 * Everything is a reactive subscription — updates arrive automatically.
 */
@Composable
fun ParentScreen(convex: ConvexClientWithAuth<String>, modifier: Modifier = Modifier) {
    val repo = remember { ParentRepository(convex) }
    val json = Json { ignoreUnknownKeys = true }
    var children by remember { mutableStateOf<List<Child>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            convex.subscribe<String>("parentApp:myChildren", args = emptyMap()).collect { result ->
                result.onSuccess { raw ->
                    children = json.decodeFromString<List<Child>>(raw)
                }
            }
        } catch (e: Exception) {
            error = e.message
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Text("وضعیت امروز", style = MaterialTheme.typography.titleLarge) }
        error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        if (children.isEmpty() && error == null) {
            item { Text("فرزندی به این حساب متصل نیست یا در حال بارگذاری است…") }
        }
        items(children, key = { it.studentId }) { child ->
            ChildCard(child)
        }
    }
}

@Composable
private fun ChildCard(child: Child) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(child.name, style = MaterialTheme.typography.titleMedium)
                Text(
                    when (child.status) {
                        "picked_up" -> "سوار شده"
                        "dropped_off" -> "پیاده شده"
                        "absent" -> "غایب"
                        else -> "در انتظار"
                    },
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            child.service?.let { s ->
                Text(
                    buildString {
                        append(s.name)
                        s.routeName?.let { append(" · $it") }
                        s.driverName?.let { append("\nراننده: $it") }
                        s.driverPhone?.let { append(" · $it") }
                        s.vehiclePlate?.let { append("\nخودرو: $it") }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Timeline — chronological, same wording as the web portal.
            if (child.timeline.isNotEmpty()) {
                Text("تایم‌لاین امروز", style = MaterialTheme.typography.labelLarge)
                child.timeline.forEach { e ->
                    val time = faTime.format(Date(e.serverTimestamp))
                    val verb = when (e.eventType) {
                        "PICKED_UP" -> "سوار سرویس مدرسه شد"
                        "DROPPED_OFF" -> "از سرویس پیاده شد و به مقصد رسید"
                        "ABSENT" -> "غایب ثبت شد"
                        else -> e.eventType
                    }
                    Text(
                        "${child.name} ساعت $time $verb",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}
