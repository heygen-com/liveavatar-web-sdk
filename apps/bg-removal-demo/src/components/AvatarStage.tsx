"use client";

import { useEffect, useRef } from "react";
import { SessionState } from "@heygen/liveavatar-web-sdk";
import { useSession } from "@/liveavatar";
import { setupChromaKey } from "@/lib/chromaKey";
import { DEFAULT_CHROMA_KEY_OPTIONS, type BackgroundConfig } from "@/lib/types";

type AvatarStageProps = {
  background: BackgroundConfig;
  onSessionEnd: () => void;
};

export const AvatarStage = ({ background, onSessionEnd }: AvatarStageProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const {
    sessionState,
    isStreamReady,
    connectionQuality,
    isAvatarTalking,
    attachElement,
    startSession,
    stopSession,
  } = useSession();

  // Auto-start session on mount
  useEffect(() => {
    startSession().catch((err) => {
      console.error("Failed to start session:", err);
    });
  }, [startSession]);

  // Attach video stream when ready
  useEffect(() => {
    if (isStreamReady && videoRef.current) {
      attachElement(videoRef.current);
    }
  }, [isStreamReady, attachElement]);

  // Bubble up disconnects
  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      onSessionEnd();
    }
  }, [sessionState, onSessionEnd]);

  // Chroma key lifecycle — start when background isn't "none", stop otherwise
  const chromaEnabled = background.kind !== "none";

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const stop = () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };

    if (!chromaEnabled || !video || !canvas) {
      stop();
      return;
    }

    const startWhenReady = () => {
      if (!video || !canvas) return;
      if (video.readyState < 2) return;
      stop();
      cleanupRef.current = setupChromaKey(
        video,
        canvas,
        DEFAULT_CHROMA_KEY_OPTIONS,
      );
    };

    if (video.readyState >= 2) {
      startWhenReady();
    } else {
      video.addEventListener("loadedmetadata", startWhenReady);
      video.addEventListener("loadeddata", startWhenReady);
    }

    return () => {
      video.removeEventListener("loadedmetadata", startWhenReady);
      video.removeEventListener("loadeddata", startWhenReady);
      stop();
    };
  }, [chromaEnabled, isStreamReady]);

  // Final cleanup
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const isConnecting =
    sessionState === SessionState.INACTIVE ||
    sessionState === SessionState.CONNECTING;

  const stageBackgroundStyle: React.CSSProperties = (() => {
    if (background.kind === "color") {
      return { backgroundColor: background.value };
    }
    return { backgroundColor: "transparent" };
  })();

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 rounded-lg text-gray-100">
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              sessionState === SessionState.CONNECTED
                ? "bg-green-400"
                : isConnecting
                  ? "bg-yellow-400 animate-pulse"
                  : "bg-red-400"
            }`}
          />
          <span className="text-sm capitalize">{sessionState}</span>
          <span className="text-xs text-gray-400">· {connectionQuality}</span>
          {isAvatarTalking && (
            <span className="text-xs text-green-400 font-medium">
              Speaking…
            </span>
          )}
        </div>
        <button
          onClick={() => stopSession()}
          className="px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-500"
        >
          Stop
        </button>
      </div>

      <div className="flex gap-4">
        {/* Stage */}
        <div className="flex-1 relative aspect-video rounded-lg overflow-hidden bg-[#0f0f0f]">
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30 text-white">
              Connecting…
            </div>
          )}

          {/* Background layer */}
          <div className="absolute inset-0 z-0" style={stageBackgroundStyle}>
            {background.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={background.url}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
            {background.kind === "video" && (
              <video
                key={background.url}
                src={background.url}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Raw video — always playing so the canvas has a live source. */}
          {/* `visibility: hidden` keeps the decoder running; `display: none` would freeze it. */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-contain z-10"
            style={{ visibility: chromaEnabled ? "hidden" : "visible" }}
          />

          {/* Canvas — only visible when chroma key is on */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-contain z-20"
            style={{ visibility: chromaEnabled ? "visible" : "hidden" }}
          />
        </div>
      </div>
    </div>
  );
};
