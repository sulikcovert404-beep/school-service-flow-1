package com.schoolservice.app

import android.app.Application
import com.schoolservice.app.auth.ConvexAuthProvider
import com.schoolservice.app.auth.SessionStore
import dev.convex.android.ConvexClientWithAuth

/**
 * One ConvexClient for the whole process lifetime (per official guidance).
 * The URL comes from the resValue "convex_url" in app/build.gradle.kts.
 */
class SchoolServiceApp : Application() {

    lateinit var convex: ConvexClientWithAuth<String>
        private set

    lateinit var session: SessionStore
        private set

    lateinit var authProvider: ConvexAuthProvider
        private set

    override fun onCreate() {
        super.onCreate()
        appContext = applicationContext
        session = SessionStore(this)
        // AuthProvider feeds the stored Convex Auth token to the client and
        // refreshes it via auth:signIn({ refreshToken }) when needed.
        authProvider = ConvexAuthProvider(session)
        convex = ConvexClientWithAuth(
            applicationContext.getString(R.string.convex_url),
            authProvider,
        )
    }

    companion object {
        @Volatile
        lateinit var appContext: android.content.Context
            private set
    }
}
