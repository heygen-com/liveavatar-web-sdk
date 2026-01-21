"use client";

import { useMemo, useState } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";
import { SessionInteractivityMode } from "@heygen/liveavatar-web-sdk";

export type SessionMode = "FULL" | "FULL_PTT" | "CUSTOM";

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [mode, setMode] = useState<SessionMode>("FULL");
  const [error, setError] = useState<string | null>(null);

  const handleStartFullSession = async (pushToTalk: boolean = false) => {
    try {
      const res = await fetch("/api/start-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pushToTalk }),
      });
      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to start full session", error);
        setError(error.error);
        return;
      }
      const { session_token } = await res.json();
      setSessionToken(session_token);
      setMode(pushToTalk ? "FULL_PTT" : "FULL");
    } catch (error: unknown) {
      setError((error as Error).message);
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

  const voiceChatConfig = useMemo(() => {
    if (mode === "FULL_PTT") {
      return {
        mode: SessionInteractivityMode.PUSH_TO_TALK,
      };
    }
    return true;
  }, [mode]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      {!sessionToken ? (
        <>
          {error && (
            <div className="text-red-500">
              {"Error getting session token: " + error}
            </div>
          )}
          <button
            onClick={() => handleStartFullSession(false)}
            className="w-fit bg-white text-black px-4 py-2 rounded-md"
          >
            Start Full Avatar Session
          </button>

          <button
            onClick={() => handleStartFullSession(true)}
            className="w-fit bg-white text-black px-4 py-2 rounded-md"
          >
            Start Full Avatar Session (Push To Talk)
          </button>

          <button
            onClick={handleStartCustom}
            className="w-fit bg-white text-black px-4 py-2 rounded-md"
          >
            Start Custom Avatar Session
          </button>
        </>
      ) : (
        <LiveAvatarSession
          mode={mode}
          sessionAccessToken={sessionToken}
          voiceChatConfig={voiceChatConfig}
          onSessionStopped={onSessionStopped}
        />
      )}
    </div>
  );
};
