"use client";

import { useEffect } from "react";

/**
 * Loads Eruda mobile console for debugging on preview/development environments.
 * Only loads on:
 * - localhost
 * - testers.betaskintech.com (preview)
 * Never loads on production (clara.betaskintech.com)
 */
export function ErudaLoader() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hostname = window.location.hostname;
    const isDebugEnv =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.includes("testers.betaskintech") ||
      hostname.includes("vercel.app"); // Preview deployments

    if (!isDebugEnv) return;

    // Load Eruda from CDN
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    script.onload = () => {
      // @ts-expect-error - Eruda is loaded globally
      if (window.eruda) {
        // @ts-expect-error - Eruda is loaded globally
        window.eruda.init();
        console.log("[Debug] Eruda console initialized");
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount (unlikely but good practice)
      script.remove();
    };
  }, []);

  return null;
}
