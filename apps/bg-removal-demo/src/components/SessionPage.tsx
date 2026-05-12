"use client";

import { useCallback, useState } from "react";
import { LiveAvatarContextProvider } from "@/liveavatar";
import { AvatarStage } from "./AvatarStage";
import { BackgroundPicker } from "./BackgroundPicker";
import { ConfigForm } from "./ConfigForm";
import type { BackgroundConfig, SessionFormConfig } from "@/lib/types";

type ActiveSession = {
  sessionToken: string;
  config: SessionFormConfig;
};

export const SessionPage = () => {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [background, setBackground] = useState<BackgroundConfig>({
    kind: "none",
  });

  const handleStart = async (config: SessionFormConfig) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar_id: config.avatar_id || undefined,
          voice_id: config.voice_id || undefined,
          context_id: config.context_id || undefined,
          language: config.language,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start session");
      }
      const { session_token } = await res.json();
      setActiveSession({ sessionToken: session_token, config });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionEnd = useCallback(() => {
    setActiveSession(null);
    setBackground({ kind: "none" });
  }, []);

  if (activeSession) {
    return (
      <LiveAvatarContextProvider
        sessionAccessToken={activeSession.sessionToken}
      >
        <div className="flex flex-col lg:flex-row gap-4 items-start p-4">
          <AvatarStage
            background={background}
            onSessionEnd={handleSessionEnd}
          />
          <BackgroundPicker value={background} onChange={setBackground} />
        </div>
      </LiveAvatarContextProvider>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <ConfigForm onStart={handleStart} isLoading={isLoading} />
      {error && (
        <p className="text-red-500 text-sm max-w-lg text-center">{error}</p>
      )}
    </div>
  );
};
