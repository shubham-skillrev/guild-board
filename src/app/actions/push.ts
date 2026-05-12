"use server";

import { createClient } from "@/lib/supabase/server";

export type SerializedPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function subscribePush(sub: SerializedPushSubscription, userAgent?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function unsubscribePush(endpoint: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
