package com.schoolservice.app.auth

import dev.convex.android.AuthProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Bridges the stored Convex Auth session to ConvexClientWithAuth.
 *
 * NOTE (skeleton): the exact AuthProvider override signatures must be checked
 * against dev.convex:android-convexmobile:0.8.0 — the contract here follows the
 * documented pattern (getToken / refreshToken). The refresh path re-runs
 * auth:signIn with the stored refreshToken, which is the same protocol the web
 * client uses (verified against @convex-dev/auth server source).
 */
class ConvexAuthProvider(private val session: SessionStore) : AuthProvider {

    override suspend fun getToken(): String? = session.accessToken

    override suspend fun refreshToken(token: String?): String? = withContext(Dispatchers.IO) {
        val refresh = token ?: session.refreshToken ?: return@withContext null
        // auth:signIn({ refreshToken }) -> { tokens: { token, refreshToken } }
        // Implemented in AuthRepository.refresh(); kept decoupled to avoid a
        // circular dependency between client and repository.
        AuthBridge.onRefreshRequested(refresh)
    }

    fun onTokensUpdated(accessToken: String, refreshToken: String) {
        session.accessToken = accessToken
        session.refreshToken = refreshToken
    }
}

/**
 * Lightweight hook the app wires at startup so the provider can refresh
 * without depending on the repository directly.
 */
object AuthBridge {
    @Volatile
    var onRefreshRequested: suspend (refreshToken: String) -> String? = { null }
}
