import "server-only";
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) {
    throw new Error("VAPID keys missing — set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY");
  }
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
};

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function toWebPushSub(row: SubRow): WebPushSubscription {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureVapid();
  const admin = createAdminClient();

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    console.error("push: failed to load subs", error);
    return { sent: 0, removed: 0 };
  }
  if (!subs || subs.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(toWebPushSub(row), body, { TTL: 60 * 60 * 24 });
        sent += 1;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          staleIds.push(row.id);
        } else {
          console.warn("push: send failed", code, (err as Error).message);
        }
      }
    })
  );

  if (staleIds.length) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { sent, removed: staleIds.length };
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  const unique = Array.from(new Set(userIds));
  const results = await Promise.all(unique.map((id) => sendPushToUser(id, payload)));
  return results.reduce(
    (acc, r) => ({ sent: acc.sent + r.sent, removed: acc.removed + r.removed }),
    { sent: 0, removed: 0 }
  );
}
