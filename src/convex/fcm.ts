"use node";

/**
 * FCM (Firebase Cloud Messaging) integration — FCM HTTP v1 API.
 *
 * Credentials come from environment variables (Keys/API keys tab):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * When the variables are missing the worker falls back to simulated delivery
 * so the demo keeps working; the outbox contract never changes.
 */

import { createSign } from "node:crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SEND_URL = "https://fcm.googleapis.com/v1/projects";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const MAX_ATTEMPTS = 3;

type FcmCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export function readCredentials(): FcmCredentials | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Sign a service-account JWT (RS256) and exchange it for an OAuth2 token. */
async function getAccessToken(creds: FcmCredentials): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: creds.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${signer.sign(creds.privateKey).toString("base64url")}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function sendFcm(
  creds: FcmCredentials,
  message: Record<string, unknown>,
  dryRun = false,
) {
  const accessToken = await getAccessToken(creds);
  const res = await fetch(
    `${FCM_SEND_URL}/${creds.projectId}/messages:send${dryRun ? "?dryRun=true" : ""}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    },
  );
  if (!res.ok) {
    throw new Error(`FCM send failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as { name?: string };
}

/**
 * Connection test: validates the service-account credentials with a dry-run
 * message to a test topic (nothing is actually delivered to any device).
 */
export const testConnection = action({
  args: {},
  handler: async (ctx) => {
    const me = await ctx.runQuery(internal.notifications.fcmGuardSession, {});
    if (!me || (me.role !== "school_admin" && me.role !== "admin")) {
      throw new Error("FORBIDDEN");
    }
    const creds = readCredentials();
    if (!creds) {
      return {
        ok: false as const,
        message:
          "متغیرهای FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY تنظیم نشده‌اند.",
      };
    }
    try {
      // Real API round-trip: topic messages need no device tokens, so this
      // validates credentials end-to-end without touching any user device.
      await sendFcm(creds, {
        topic: "fcm-connection-test",
        notification: { title: "تست اتصال", body: "اتصال FCM سرویس مدرسه" },
      });
      return { ok: true as const, message: `اتصال FCM موفق بود (پروژه: ${creds.projectId})` };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "خطای ناشناخته در اتصال FCM",
      };
    }
  },
});

/**
 * Notification Worker (called by cron): drains the QUEUED outbox and delivers
 * each message to the parent's registered FCM tokens. Parents without a
 * registered device are marked SENT with a NO_DEVICE_REGISTERED note so the
 * queue never stalls; real provider failures retry up to MAX_ATTEMPTS.
 */
export const deliverOutbox = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ picked: number; sent: number; failed: number; simulated: number }> => {
    const creds = readCredentials();
    const queued = await ctx.runQuery(internal.notifications.listQueuedInternal, {});

    let sent = 0;
    let failed = 0;
    let simulated = 0;

    for (const n of queued) {
      // No credentials configured → simulated delivery (demo mode).
      if (!creds) {
        await ctx.runMutation(internal.notifications.markResultInternal, {
          id: n._id,
          ok: true,
          error: "SIMULATED (FCM credentials not configured)",
        });
        simulated++;
        continue;
      }

      try {
        const devices = await ctx.runQuery(internal.notifications.listParentTokensInternal, {
          parentId: n.parentId,
        });

        if (devices.length === 0) {
          await ctx.runMutation(internal.notifications.markResultInternal, {
            id: n._id,
            ok: true,
            error: "NO_DEVICE_REGISTERED",
          });
          sent++;
          continue;
        }

        let anySuccess = false;
        let lastError: string | undefined;
        for (const device of devices) {
          try {
            if (device.platform === "web") {
              // Browser push subscription (Web Push / VAPID protocol).
              const { sendWebPush, isGoneSubscription } = await import("./webPush");
              try {
                await sendWebPush({ title: n.title, body: n.body }, device.token);
              } catch (err) {
                if (isGoneSubscription(err)) {
                  // Subscription expired → drop the device so it doesn't retry forever.
                  await ctx.runMutation(internal.notifications.deleteDeviceInternal, {
                    id: device.id,
                  });
                }
                throw err;
              }
            } else {
              // Android FCM registration token.
              await sendFcm(creds, {
                token: device.token,
                notification: { title: n.title, body: n.body },
              });
            }
            anySuccess = true;
          } catch (err) {
            lastError = err instanceof Error ? err.message : "unknown push error";
          }
        }

        await ctx.runMutation(internal.notifications.markResultInternal, {
          id: n._id,
          ok: anySuccess,
          error: anySuccess ? undefined : lastError,
        });
        if (anySuccess) sent++;
        else if (n.attempts + 1 >= MAX_ATTEMPTS) failed++;
      } catch (err) {
        await ctx.runMutation(internal.notifications.markResultInternal, {
          id: n._id,
          ok: false,
          error: err instanceof Error ? err.message : "unknown error",
        });
        failed++;
      }
    }

    return { picked: queued.length, sent, failed, simulated };
  },
});
