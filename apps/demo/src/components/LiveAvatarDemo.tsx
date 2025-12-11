"use client";

import { useState } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";
import { Header } from "./Header";
import { Loading } from "./Loading";

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [mode, setMode] = useState<"FULL" | "CUSTOM">("FULL");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  const handleStart = async () => {
    setIsLoadingToken(true);
    setError(null);
    try {
      const res = await fetch("/api/start-session", {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        setError(error.error);
        setIsLoadingToken(false);
        return;
      }
      const { session_token } = await res.json();
      setSessionToken(session_token);
      setMode("FULL");
      setIsLoadingToken(false);
    } catch (error: unknown) {
      setError((error as Error).message);
      setIsLoadingToken(false);
    }
  };

  const handleStartCustom = async () => {
    const res = await fetch("/api/start-custom-session", {
      method: "POST",
    });
    if (!res.ok) {
      const error = await res.json();
      setError(error.error);
      return;
    }
    const { session_token } = await res.json();
    setSessionToken(session_token);
    setMode("CUSTOM");
  };

  const onSessionStopped = () => {
    // Reset the FE state
    setSessionToken("");
  };

  return (
    <div className="app-container">
      {!sessionToken && !isLoadingToken ? (
        <div className="idle-screen screen-transition">
          <Header />
          <div className="idle-background"></div>
          {error && (
            <div className="error-message">
              {"Error getting session token: " + error}
            </div>
          )}
          <button
            onClick={handleStart}
            className="start-conversation-button"
          >
            Iniciar conversa
          </button>
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
            onSessionStopped={onSessionStopped}
          />
        </div>
      )}
    </div>
  );
};
