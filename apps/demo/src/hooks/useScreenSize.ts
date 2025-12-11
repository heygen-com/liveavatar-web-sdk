"use client";

import { useState, useEffect } from "react";

interface ScreenSize {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const MOBILE_BREAKPOINT = 640;
const TABLET_BREAKPOINT = 1024;

export const useScreenSize = (): ScreenSize => {
  const [screenSize, setScreenSize] = useState<ScreenSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    isMobile:
      typeof window !== "undefined"
        ? window.innerWidth < MOBILE_BREAKPOINT
        : false,
    isTablet:
      typeof window !== "undefined"
        ? window.innerWidth >= MOBILE_BREAKPOINT &&
          window.innerWidth < TABLET_BREAKPOINT
        : false,
    isDesktop:
      typeof window !== "undefined"
        ? window.innerWidth >= TABLET_BREAKPOINT
        : true,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setScreenSize({
        width,
        height,
        isMobile: width < MOBILE_BREAKPOINT,
        isTablet: width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT,
        isDesktop: width >= TABLET_BREAKPOINT,
      });
    };

    // Set initial values
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return screenSize;
};
