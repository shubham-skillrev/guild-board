"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribePush, unsubscribePush } from "@/app/actions/push";

const DISMISS_KEY = "gb_push_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushOptIn() {
  const { supabaseUser, isLoading } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [hasSub, setHasSub] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (ts && Date.now() - ts < DISMISS_TTL_MS) setDismissed(true);

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setHasSub(!!sub);
      } catch {
        setHasSub(false);
      }
    })();
  }, []);

  const subscribe = useCallback(async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ),
        }));

      const json = sub.toJSON() as {
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      const res = await subscribePush(
        { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
        navigator.userAgent
      );
      if (res.ok) setHasSub(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await unsubscribePush(endpoint);
      }
      setHasSub(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  if (isLoading || !supabaseUser || !supported) return null;
  if (hasSub) return null;
  if (permission === "denied") return null;
  if (dismissed) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-sm rounded-2xl border border-border-strong bg-sumi/95 p-4 shadow-xl backdrop-blur sm:left-auto sm:right-3">
      <p className="text-sm font-semibold text-ink">Stay in the loop</p>
      <p className="mt-1 text-xs text-ink-soft">
        Enable notifications for replies, reactions, and reminders.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          disabled={busy}
          onClick={subscribe}
          className="rounded-lg bg-saffron px-3 py-1.5 text-xs font-medium text-parchment hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Enabling…" : "Enable"}
        </button>
        <button
          disabled={busy}
          onClick={dismiss}
          className="rounded-lg border border-border-strong px-3 py-1.5 text-xs text-ink-soft hover:text-ink"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

export function PushToggleButton() {
  const { supabaseUser } = useAuth();
  const [supported, setSupported] = useState(false);
  const [hasSub, setHasSub] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    (async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setHasSub(!!sub);
    })();
  }, []);

  if (!supabaseUser || !supported) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        const endpoint = existing.endpoint;
        await existing.unsubscribe();
        await unsubscribePush(endpoint);
        setHasSub(false);
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ),
        });
        const json = sub.toJSON() as {
          endpoint: string;
          keys?: { p256dh?: string; auth?: string };
        };
        if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
          await subscribePush(
            { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
            navigator.userAgent
          );
          setHasSub(true);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="rounded-lg border border-border-strong px-3 py-1.5 text-xs text-ink-soft hover:text-ink disabled:opacity-50"
    >
      {hasSub ? "Disable notifications" : "Enable notifications"}
    </button>
  );
}
