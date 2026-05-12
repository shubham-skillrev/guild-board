"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "gb_install_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    const ios = /iPad|iPhone|iPod/.test(window.navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    if (ios) setVisible(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (isStandalone || !visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-sm rounded-2xl border border-border-strong bg-sumi/95 p-4 shadow-xl backdrop-blur">
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" width={40} height={40} className="rounded-lg" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">Install GuildBoard</p>
          {isIOS ? (
            <p className="mt-1 text-xs text-ink-soft">
              Tap <span aria-label="share">⎋</span> Share, then “Add to Home Screen”.
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-soft">
              Get faster access and notifications by installing the app.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {!isIOS && deferred && (
              <button
                onClick={install}
                className="rounded-lg bg-saffron px-3 py-1.5 text-xs font-medium text-parchment hover:opacity-90"
              >
                Install
              </button>
            )}
            <button
              onClick={dismiss}
              className="rounded-lg border border-border-strong px-3 py-1.5 text-xs text-ink-soft hover:text-ink"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
