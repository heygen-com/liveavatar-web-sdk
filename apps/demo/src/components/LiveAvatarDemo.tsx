"use client";

import { useMemo, useState } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";
import { Header } from "./Header";
import { Loading } from "./Loading";
import { SessionInteractivityMode } from "@heygen/liveavatar-web-sdk";

export type SessionMode = "FULL" | "FULL_PTT" | "LITE";

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [mode, setMode] = useState<SessionMode>("FULL");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  const handleStartFullSession = async (pushToTalk: boolean = false) => {
    setIsLoadingToken(true);
    setError(null);

    try {
      const res = await fetch("/api/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushToTalk }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Failed to start full session", err);
        setError(err?.error ?? "Unknown error");
        setIsLoadingToken(false);
        return;
      }

      const { session_token } = await res.json();
      setSessionToken(session_token);
      setMode(pushToTalk ? "FULL_PTT" : "FULL");
      setIsLoadingToken(false);
    } catch (e: unknown) {
      setError((e as Error).message);
      setIsLoadingToken(false);
    }
  };

  const handleStartLiteSession = async () => {
    setIsLoadingToken(true);
    setError(null);

    try {
      const res = await fetch("/api/start-lite-session", { method: "POST" });

      if (!res.ok) {
        const err = await res.json();
        setError(err?.error ?? "Unknown error");
        setIsLoadingToken(false);
        return;
      }

      const { session_token } = await res.json();
      setSessionToken(session_token);
      setMode("LITE");
      setIsLoadingToken(false);
    } catch (e: unknown) {
      setError((e as Error).message);
      setIsLoadingToken(false);
    }
  };

  const onSessionStopped = () => {
    setSessionToken("");
  };

  const voiceChatConfig = useMemo(() => {
    // In LITE, avoid initializing voice chat at all (safer)
    if (mode === "LITE") return false;

    if (mode === "FULL_PTT") {
      return { mode: SessionInteractivityMode.PUSH_TO_TALK };
    }

    return true;
  }, [mode]);

  return (
    <div className="app-container">
      {!sessionToken && !isLoadingToken ? (
        <div className="idle-screen screen-transition">
          <Header />
          <div className="idle-background" />

          {error && (
            <div className="error-message">
              {"Error getting session token: " + error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleStartFullSession(false)}
              className="start-conversation-button"
            >
              Iniciar conversa
            </button>

            <button
              onClick={() => handleStartFullSession(true)}
              className="start-conversation-button"
            >
              Iniciar conversa (Push to Talk)
            </button>

            <button
              onClick={handleStartLiteSession}
              className="start-conversation-button"
            >
              Iniciar conversa (Lite)
            </button>
          </div>
        </div>
      ) : isLoadingToken ? (
        <div className="loading-transition">
          <Loading />
        </div>
      ) : (
        <div className="conversation-transition">
          <LiveAvatarSession
            mode={mode}
            sessionAccessToken={sessionToken}
            voiceChatConfig={voiceChatConfig}
            onSessionStopped={onSessionStopped}
          />
        </div>
      )}
    </div>
  );
};