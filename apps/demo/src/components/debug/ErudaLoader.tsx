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
      return;
    }

    // Dynamic import to avoid bundling in production
    import("eruda")
      .then((eruda) => {
        eruda.default.init();
        console.log("[Debug] Eruda initialized for:", hostname);
      })
      .catch((err) => {
        console.error("[Debug] Failed to load Eruda:", err);
      });
  }, []);

  return null;
}
