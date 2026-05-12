"use client";

import { useEffect, useState } from "react";
import { Portal } from "@/components/ui/Portal";
import { track } from "@vercel/analytics";

type InstallEvent = "prompt_accepted" | "prompt_dismissed" | "app_installed";

function reportInstallEvent(event: InstallEvent, platform: Platform) {
  try { track(`pwa_${event}`, { platform }); } catch {}
  void fetch("/api/pwa/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, platform }),
    keepalive: true,
  }).catch(() => {});
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "android-chrome" | "desktop-chrome" | "ios-safari" | "macos-safari" | "other";

const DISMISS_KEY = "gb_install_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
  if (isIOS) return "ios-safari";
  const isAndroid = /Android/.test(ua);
  const isChromium = /Chrome|Chromium|Edg|Brave/.test(ua) && !/OPR\//.test(ua);
  if (isAndroid && isChromium) return "android-chrome";
  if (isChromium) return "desktop-chrome";
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  if (isSafari) return "macos-safari";
  return "other";
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("other");
  const [standalone, setStandalone] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const std = isStandaloneMode();
    setStandalone(std);
    if (std) return;

    setPlatform(detectPlatform());

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      reportInstallEvent("app_installed", detectPlatform());
      setVisible(false);
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // Show toast after a short delay so it doesn't fight first paint.
    const t = setTimeout(() => setVisible(true), 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const installNative = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "dismissed") {
      reportInstallEvent("prompt_dismissed", platform);
    }
    // accepted -> wait for `appinstalled` event to log single row
    setDeferred(null);
    if (choice.outcome === "accepted") setVisible(false);
  };

  if (standalone || !visible) return null;

  const instructions: Record<Platform, { title: string; steps: string[] }> = {
    "android-chrome": {
      title: "Add to your Home Screen",
      steps: [
        "Tap the menu (⋮) in Chrome",
        "Select \"Install app\" or \"Add to Home screen\"",
        "Tap \"Install\" to confirm",
      ],
    },
    "desktop-chrome": {
      title: "Install GuildBoard",
      steps: [
        "Click the install icon in the address bar",
        "Or open menu (⋮) → \"Install GuildBoard…\"",
        "Confirm to add to your apps",
      ],
    },
    "ios-safari": {
      title: "Add to Home Screen",
      steps: [
        "Tap the Share button at the bottom",
        "Scroll down and tap \"Add to Home Screen\"",
        "Tap \"Add\" in the top right",
      ],
    },
    "macos-safari": {
      title: "Add to Dock",
      steps: [
        "Click the Share button in Safari",
        "Choose \"Add to Dock\"",
        "Confirm to add",
      ],
    },
    other: {
      title: "Install as App",
      steps: [
        "Open your browser menu",
        "Look for \"Install\" or \"Add to Home screen\"",
        "Follow the prompts",
      ],
    },
  };

  const guide = instructions[platform];

  return (
    <Portal>
      <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-sm rounded-2xl border border-saffron/30 bg-sumi/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur sm:left-auto sm:right-4 sm:bottom-4">
        {!showHow ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" width={44} height={44} className="rounded-xl" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">Install GuildBoard</p>
              <p className="mt-1 text-xs text-ink-soft">
                Add the app to never miss a notification. Faster, full-screen, just one tap away.
              </p>
              <div className="mt-3 flex gap-2">
                {deferred ? (
                  <button
                    onClick={installNative}
                    className="rounded-lg bg-saffron px-3 py-1.5 text-xs font-semibold text-parchment hover:opacity-90"
                  >
                    Install
                  </button>
                ) : (
                  <button
                    onClick={() => setShowHow(true)}
                    className="rounded-lg bg-saffron px-3 py-1.5 text-xs font-semibold text-parchment hover:opacity-90"
                  >
                    How to install
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
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{guide.title}</p>
              <button
                onClick={() => setShowHow(false)}
                className="text-xs text-ink-soft hover:text-ink"
              >
                Back
              </button>
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-ink-soft">
              {guide.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="mt-3 flex justify-end">
              <button
                onClick={dismiss}
                className="rounded-lg border border-border-strong px-3 py-1.5 text-xs text-ink-soft hover:text-ink"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    </Portal>
  );
}
