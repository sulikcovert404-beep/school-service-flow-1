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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.schoolservice.app.SchoolServiceApp
import com.schoolservice.app.auth.AuthRepository
import com.schoolservice.app.auth.SessionStore
import kotlinx.coroutines.launch

/**
 * Minimal entry: OTP login, then a role placeholder. Real screens (driver
 * roster with one-tap actions, parent timeline) build on DriverRepository /
 * ParentRepository — the data layer is already wired.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as SchoolServiceApp
        val auth = AuthRepository(app.convex, app.session, app.authProvider)
        AuthRepository.installRefreshBridge(auth)

        setContent {
            MaterialTheme {
                if (app.session.isSignedIn) {
                    HomePlaceholder()
                } else {
                    OtpLoginScreen(
                        onRequest = { auth.requestOtp(it) },
                        onVerify = { email, code -> auth.verifyOtp(email, code) },
                    )
                }
            }
        }
    }

}

@Composable
fun OtpLoginScreen(
    onRequest: suspend (String) -> Boolean,
    onVerify: suspend (String, String) -> Boolean,
) {
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var step by remember { mutableStateOf(0) }
    var message by remember { mutableStateOf<String?>(null) }
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
                Button(onClick = {
                    scope.launch {
                        message = if (onRequest(email)) "کد ارسال شد" else "ارسال ناموفق بود"
                        if (message == "کد ارسال شد") step = 1
                    }
                }) { Text("دریافت کد") }
            } else {
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it },
                    label = { Text("کد ۶ رقمی") },
                    singleLine = true,
                )
                Button(onClick = {
                    scope.launch {
                        message = if (onVerify(email, code)) "خوش آمدید!" else "کد نامعتبر است"
                    }
                }) { Text("ورود") }
            }
            message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}

@Composable
fun HomePlaceholder() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("وارد شدید ✅", style = MaterialTheme.typography.headlineSmall)
        Text(
            "صفحات راننده/والد روی DriverRepository و ParentRepository ساخته می‌شوند\n(docs/MOBILE_API.md)",
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}
