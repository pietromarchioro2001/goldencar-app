"use client";

import { useEffect } from "react";

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
      return () => window.removeEventListener("load", register);
    }

    void register();
  }, []);

  return null;
}
