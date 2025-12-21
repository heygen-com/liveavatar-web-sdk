"use client";

import { useState, useEffect } from "react";

interface FixedHeightResult {
  fixedHeight: number | null;
  isInIframe: boolean;
}

/**
 * Hook to handle fixed height in iframe contexts, especially for mobile Safari.
 * When in an iframe on mobile, this fixes the height to prevent layout jumps
 * caused by the URL bar showing/hiding.
 */
export const useFixedHeight = (): FixedHeightResult => {
  const [fixedHeight, setFixedHeight] = useState<number | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Check if we're in an iframe
    const inIframe =
      typeof window !== "undefined" && window.self !== window.top;
    setIsInIframe(inIframe);

    // Only fix height on mobile in iframe
    if (inIframe && typeof window !== "undefined" && window.innerWidth < 1024) {
      // Set fixed height to current viewport height
      setFixedHeight(window.innerHeight);

      // Prevent scrolling
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";

      // Cleanup
      return () => {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
      };
    }
  }, []);

  return { fixedHeight, isInIframe };
};
