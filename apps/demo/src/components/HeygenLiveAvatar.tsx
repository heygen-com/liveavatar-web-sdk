"use client";

import { useEffect, useRef, useState } from "react";

interface HeygenLiveAvatarProps {
  avatarId?: string;
  className?: string;
}

export function HeygenLiveAvatar({
  avatarId,
  className,
}: HeygenLiveAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarInstanceRef = useRef<{
    destroy?: () => void;
    disconnect?: () => void;
    stop?: () => void;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;

    async function initialize() {
      try {
        if (!mounted) return;

        // Step 1: Fetch token from our API
        const tokenResponse = await fetch("/api/heygen/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ avatarId }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(
            errorData.error || "Failed to fetch token from server",
          );
        }

        const { token } = await tokenResponse.json();

        if (!token) {
          throw new Error("No token received from server");
        }

        if (!mounted) return;

        // Step 2: Load SDK - try dynamic import first, fallback to CDN
        let SDK: unknown = null;
        let usedCDN = false;

        try {
          SDK = await import("@heygen/liveavatar-web-sdk");
        } catch (importError) {
          console.warn(
            "Failed to import SDK from npm package, falling back to CDN:",
            importError,
          );

          // Load from CDN as fallback
          await loadSDKFromCDN();
          SDK =
            (window as Window & { HeyGenSDK?: unknown; HeyGen?: unknown })
              .HeyGenSDK ||
            (window as Window & { HeyGenSDK?: unknown; HeyGen?: unknown })
              .HeyGen;
          usedCDN = true;
        }

        if (!SDK) {
          throw new Error("Failed to load HeyGen SDK");
        }

        if (!mounted || !containerRef.current) return;

        // Step 3: Initialize SDK with token
        let instance: unknown = null;

        if (usedCDN) {
          // For CDN version, try various initialization patterns
          const config = {
            token,
            container: containerRef.current,
          };

          if (typeof SDK === "object" && SDK !== null) {
            const sdkObj = SDK as Record<string, unknown>;
            if (typeof sdkObj.create === "function") {
              instance = await sdkObj.create(config);
            } else if (typeof sdkObj.init === "function") {
              instance = await sdkObj.init(config);
            } else if (
              sdkObj.LiveAvatar &&
              typeof sdkObj.LiveAvatar === "object"
            ) {
              const liveAvatar = sdkObj.LiveAvatar as Record<string, unknown>;
              if (typeof liveAvatar.create === "function") {
                instance = await liveAvatar.create(config);
              } else if (typeof liveAvatar.init === "function") {
                instance = await liveAvatar.init(config);
              }
            }
          } else if (typeof SDK === "function") {
            instance = await (SDK as (config: unknown) => Promise<unknown>)(
              config,
            );
          }
        } else {
          // For npm package, use LiveAvatarSession constructor
          const SDKModule = SDK as {
            LiveAvatarSession?: new (
              token: string,
              config?: unknown,
            ) => unknown;
          };
          if (SDKModule.LiveAvatarSession) {
            instance = new SDKModule.LiveAvatarSession(token, {
              container: containerRef.current,
            });

            // Start the session if it has a start method
            if (
              instance &&
              typeof instance === "object" &&
              "start" in instance
            ) {
              const startMethod = (
                instance as { start: () => Promise<unknown> }
              ).start;
              if (typeof startMethod === "function") {
                await startMethod.call(instance);
              }
            }
          }
        }

        if (!instance) {
          throw new Error(
            "Failed to initialize HeyGen SDK - no valid initialization method found",
          );
        }

        if (!mounted) {
          // Clean up if component unmounted during initialization
          cleanupInstance(instance);
          return;
        }

        avatarInstanceRef.current = instance as {
          destroy?: () => void;
          disconnect?: () => void;
          stop?: () => void;
        };

        // Set up cleanup function
        cleanup = () => {
          cleanupInstance(avatarInstanceRef.current);
          avatarInstanceRef.current = null;
        };

        setLoading(false);
      } catch (err) {
        console.error("Error initializing HeyGen Live Avatar:", err);
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to initialize avatar",
          );
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, [avatarId]);

  // Helper function to clean up instance
  function cleanupInstance(instance: unknown) {
    if (!instance || typeof instance !== "object") return;

    const inst = instance as Record<string, unknown>;
    try {
      if (typeof inst.destroy === "function") {
        inst.destroy();
      } else if (typeof inst.disconnect === "function") {
        inst.disconnect();
      } else if (typeof inst.stop === "function") {
        inst.stop();
      }
    } catch (cleanupError) {
      console.error("Error during avatar cleanup:", cleanupError);
    }
  }

  // Function to load SDK from CDN
  function loadSDKFromCDN(): Promise<void> {
    return new Promise((resolve, reject) => {
      const scriptUrl =
        "https://cdn.heygen.com/live-avatar/websdk/heygen-liveavatar.min.js";
      const scriptId = "heygen-sdk-script";

      // Check if script is already loaded
      if (document.querySelector(`script[data-heygen-sdk]`)) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = scriptId;
      script.src = scriptUrl;
      script.setAttribute("data-heygen-sdk", "true");

      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load HeyGen SDK from CDN"));

      document.head.appendChild(script);
    });
  }

  return (
    <div className={className}>
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Loading HeyGen Live Avatar...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="p-8 bg-red-900/50 rounded-lg">
          <h3 className="text-red-200 font-bold mb-2">Error</h3>
          <p className="text-red-100">{error}</p>
        </div>
      )}
      <div
        ref={containerRef}
        className={`w-full h-full ${loading || error ? "hidden" : ""}`}
      />
    </div>
  );
}
