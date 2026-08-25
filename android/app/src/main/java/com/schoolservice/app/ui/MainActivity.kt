package com.schoolservice.app.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.schoolservice.app.SchoolServiceApp
import com.schoolservice.app.auth.AuthRepository
import com.schoolservice.app.driver.SyncWorker
import com.schoolservice.app.ui.driver.DriverScreen
import com.schoolservice.app.ui.parent.ParentScreen
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class MyContext(val role: String? = null, val name: String? = null)

/**
 * Entry: OTP login, then role-based routing —
 * driver → DriverScreen (one-tap roster) · parent → ParentScreen (timeline).
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as SchoolServiceApp
        val auth = AuthRepository(app.convex, app.session, app.authProvider)
        SyncWorker.schedule(this)

        // Register the auth callback with the client ONCE. If a cached session
        // exists it is pushed immediately; after an OTP verify the fresh token
        // is pushed through the same callback (see ConvexAuthProvider).
        lifecycleScope.launch {
            runCatching { app.convex.login(applicationContext) }
        }

        setContent {
            MaterialTheme {
                if (app.session.isSignedIn) {
                    RoleHome(app)
                } else {
                    OtpLoginScreen(
                        onRequest = { auth.requestOtp(it) },
                        onVerify = { email, code -> auth.verifyOtp(email, code) },
                        onSignedOut = {},
                    )
                }
            }
        }
    }
}

@Composable
fun RoleHome(app: SchoolServiceApp) {
    var role by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val json = Json { ignoreUnknownKeys = true }

    LaunchedEffect(Unit) {
        try {
            val result = app.convex.subscribe<String>("bootstrap:myContext", args = emptyMap())
            result.collect { r ->
                r.onSuccess { raw ->
                    role = json.decodeFromString(MyContext.serializer(), raw).role
                }.onFailure { error = it.message }
            }
        } catch (e: Exception) {
            error = e.message
        }
    }

    when (role) {
        "driver" -> DriverScreen(app.convex)
        "parent" -> ParentScreen(app.convex)
        else -> Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                error ?: "این اپ مخصوص راننده و والد است.\nنقش شما: ${role ?: "نامشخص"}",
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@Composable
fun OtpLoginScreen(
    onRequest: suspend (String) -> Boolean,
    onVerify: suspend (String, String) -> Boolean,
    onSignedOut: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var step by remember { mutableStateOf(0) }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Scaffold { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("ورود به سامانه سرویس مدرسه", style = MaterialTheme.typography.titleLarge)

            if (step == 0) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("ایمیل") },
                    singleLine = true,
                )
                Button(
                    enabled = !busy && email.contains("@"),
                    onClick = {
                        scope.launch {
                            busy = true
                            val ok = runCatching { onRequest(email) }.getOrDefault(false)
                            message = if (ok) "کد ارسال شد" else "ارسال ناموفق بود"
                            if (ok) step = 1
                            busy = false
                        }
                    },
                ) { Text("دریافت کد") }
            } else {
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it },
                    label = { Text("کد ۶ رقمی") },
                    singleLine = true,
                )
                Button(
                    enabled = !busy && code.length == 6,
                    onClick = {
                        scope.launch {
                            busy = true
                            val ok = runCatching { onVerify(email, code) }.getOrDefault(false)
                            message = if (ok) "خوش آمدید!" else "کد نامعتبر است"
                            busy = false
                        }
                    },
                ) { Text("ورود") }
            }
            message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}
