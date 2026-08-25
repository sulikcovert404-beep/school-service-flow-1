package com.schoolservice.app.auth

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import dev.convex.android.ConvexClientWithAuth

@Serializable
data class AuthTokens(val token: String? = null, val refreshToken: String? = null)

@Serializable
data class SignInResult(
    val started: Boolean? = null,
    val tokens: AuthTokens? = null,
)

/**
 * Email OTP sign-in — calls the PUBLIC auth:signIn action (same protocol the
 * web client uses; verified against @convex-dev/auth server source).
 *
 *   1. requestOtp(email)          -> { started: true }  (code sent by email)
 *   2. verifyOtp(email, code)     -> { tokens }         (session created)
 *   3. refresh()                  -> new tokens
 *   4. signOut()
 */
class AuthRepository(
    private val convex: ConvexClientWithAuth<String>,
    private val session: SessionStore,
    private val provider: ConvexAuthProvider,
) {
    private val json = Json { ignoreUnknownKeys = true }

    /** Step 1 — send the 6-digit code to the email. */
    suspend fun requestOtp(email: String): Boolean = withContext(Dispatchers.IO) {
        val raw = convex.action<String>(
            "auth:signIn",
            args = mapOf(
                "provider" to "email-otp",
                "params" to mapOf("email" to email),
            ),
        )
        val result = json.decodeFromString(SignInResult.serializer(), raw ?: "{}")
        result.started == true
    }

    /** Step 2 — verify the code; stores tokens and returns success. */
    suspend fun verifyOtp(email: String, code: String): Boolean = withContext(Dispatchers.IO) {
        val raw = convex.action<String>(
            "auth:signIn",
            args = mapOf(
                "provider" to "email-otp",
                "params" to mapOf("email" to email, "code" to code),
            ),
        )
        val result = json.decodeFromString(SignInResult.serializer(), raw ?: "{}")
        val tokens = result.tokens ?: return@withContext false
        applyTokens(tokens)
        true
    }

    /** Step 3 — session refresh (also used by ConvexAuthProvider). */
    suspend fun refresh(refreshToken: String): String? = withContext(Dispatchers.IO) {
        val raw = convex.action<String>(
            "auth:signIn",
            args = mapOf("refreshToken" to refreshToken),
        )
        val result = json.decodeFromString(SignInResult.serializer(), raw ?: "{}")
        val tokens = result.tokens ?: return@withContext null
        applyTokens(tokens)
        tokens.token
    }

    /** Step 4 — invalidate the session. */
    suspend fun signOut() = withContext(Dispatchers.IO) {
        runCatching { convex.action<Unit>("auth:signOut", args = emptyMap()) }
        session.clear()
    }

    private fun applyTokens(tokens: AuthTokens) {
        val access = tokens.token ?: return
        provider.onTokensUpdated(access, tokens.refreshToken)
    }
}
