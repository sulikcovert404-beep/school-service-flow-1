"use node";

/**
 * Web Push (browser push) channel — complements FCM for parents using the
 * installed PWA in a browser. Uses the standard Web Push protocol (VAPID).
 *
 * Keys come from environment variables (Keys/API keys tab):
 *   WEB_PUSH_PUBLIC_KEY  — public VAPID key (safe to expose to clients)
 *   WEB_PUSH_PRIVATE_KEY — private VAPID key (server only)
 *
 * When unset, subscription is simply not offered in the UI.
 */

import * as webpush from "web-push";

type PushSubscriptionJson = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Send one Web Push message to a stored subscription JSON. */
export async function sendWebPush(
  payload: { title: string; body: string },
  subscriptionJson: string,
): Promise<void> {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("WEB_PUSH keys not configured");
  }

  let subscription: PushSubscriptionJson;
  try {
    subscription = JSON.parse(subscriptionJson) as PushSubscriptionJson;
  } catch {
    throw new Error("INVALID_SUBSCRIPTION_JSON");
  }
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw new Error("INVALID_SUBSCRIPTION");
  }

  webpush.setVapidDetails("mailto:admin@school-service.local", publicKey, privateKey);
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}

/** True when the provider says the subscription is gone (404/410). */
export function isGoneSubscription(err: unknown): boolean {
  const statusCode = (err as { statusCode?: number } | null)?.statusCode;
  return statusCode === 404 || statusCode === 410;
}
