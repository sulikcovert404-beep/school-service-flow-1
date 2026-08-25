package com.schoolservice.app.auth

import android.content.Context
import dev.convex.android.AuthProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Bridges the stored Convex Auth session to ConvexClientWithAuth.
 *
 * Implements the OFFICIAL AuthProvider<String> interface (verified against the
 * convex-mobile repo, android-convexmobile 0.8.0):
 *
 *   interface AuthProvider<T> {
 *       suspend fun login(context: Context, onIdToken: (String?) -> Unit): Result<T>
 *       suspend fun loginFromCache(onIdToken: (String?) -> Unit): Result<T>
 *       suspend fun logout(context: Context): Result<Void?>
 *       fun extractIdToken(authResult: T): String
 *   }
 *
 * Our T is the Convex Auth access-token JWT. The OTP flow itself is driven by
 * AuthRepository (public auth:signIn action); after a successful verify/refresh
 * it calls [onTokensUpdated], which pushes the fresh JWT to the client through
 * the registered onIdToken callback.
 */
class ConvexAuthProvider(private val session: SessionStore) : AuthProvider<String> {

    private var onIdToken: ((String?) -> Unit)? = null

    override suspend fun login(context: Context, onIdToken: (String?) -> Unit): Result<String> =
        withContext(Dispatchers.IO) {
            this@ConvexAuthProvider.onIdToken = onIdToken
            val token = session.accessToken
            if (token != null) {
                onIdToken(token)
                Result.success(token)
            } else {
                // No session yet — the OTP UI flow will call onTokensUpdated later.
                Result.failure(IllegalStateException("OTP_LOGIN_PENDING"))
            }
        }

    override suspend fun loginFromCache(onIdToken: (String?) -> Unit): Result<String> =
        withContext(Dispatchers.IO) {
            this@ConvexAuthProvider.onIdToken = onIdToken
            val token = session.accessToken
            if (token != null) {
                onIdToken(token)
                Result.success(token)
            } else {
                Result.failure(IllegalStateException("NO_CACHED_SESSION"))
            }
        }

    override suspend fun logout(context: Context): Result<Void?> = withContext(Dispatchers.IO) {
        session.clear()
        onIdToken?.invoke(null)
        Result.success<Void?>(null)
    }

    override fun extractIdToken(authResult: String): String = authResult

    /**
     * Called by AuthRepository after a successful OTP verify or token refresh.
     * Pushes the fresh access token into the client (and persists it).
     */
    fun onTokensUpdated(accessToken: String, refreshToken: String?) {
        session.accessToken = accessToken
        if (refreshToken != null) session.refreshToken = refreshToken
        onIdToken?.invoke(accessToken)
    }
}
