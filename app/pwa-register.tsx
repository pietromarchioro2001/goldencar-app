"use client";

import { useEffect } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("Goldencar PWA service worker:", error);
      }
    };

    if (document.readyState === "loading") {
      window.addEventListener("load", register, { once: true });
    } else {
      void register();
    }

    let deferredPrompt: BeforeInstallPromptEvent | null = null;
    let promptedThisSession = false;

    const isStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      if (isStandalone()) return;

      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
    };

    const handleFirstInteraction = () => {
      if (!deferredPrompt || promptedThisSession || isStandalone()) return;

      promptedThisSession = true;
      const promptEvent = deferredPrompt;
      deferredPrompt = null;

      void promptEvent.prompt().catch((error) => {
        console.debug("Goldencar install prompt non disponibile:", error);
      });

      void promptEvent.userChoice
        .then((choice) => {
          if (choice.outcome === "accepted") {
            console.info("Goldencar PWA installata.");
          }
        })
        .catch(() => undefined);
    };

    const handleInstalled = () => {
      deferredPrompt = null;
      promptedThisSession = true;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("pointerdown", handleFirstInteraction, {
      capture: true,
      once: true,
    });

    return () => {
      window.removeEventListener("load", register);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("pointerdown", handleFirstInteraction, true);
    };
  }, []);

  return null;
}
