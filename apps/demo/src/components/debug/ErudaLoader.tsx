"use client";

import { useEffect } from "react";

/**
 * Loads Eruda mobile console for debugging on preview/development environments.
 * Loads everywhere EXCEPT production (clara.betaskintech.com)
 */
export function ErudaLoader() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hostname = window.location.hostname;

    // Only block on production
    const isProduction = hostname === "clara.betaskintech.com";

    if (isProduction) {
      console.log("[Debug] Eruda disabled on production");
      return;
    }

    console.log("[Debug] Loading Eruda for hostname:", hostname);

    // Load Eruda from CDN
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    script.onerror = (e) => {
      console.error("[Debug] Failed to load Eruda:", e);
    };
    script.onload = () => {
      console.log("[Debug] Eruda script loaded");
      // @ts-expect-error - Eruda is loaded globally
      if (window.eruda) {
        // @ts-expect-error - Eruda is loaded globally
        window.eruda.init();
        console.log("[Debug] Eruda console initialized");
      } else {
        console.error("[Debug] Eruda not found on window");
      }
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}
