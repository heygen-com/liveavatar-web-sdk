"use client";

import { useMemo, useState } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";
import { SessionInteractivityMode } from "@heygen/liveavatar-web-sdk";

export type SessionMode = "FULL" | "FULL_PTT" | "LITE";

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [mode, setMode] = useState<SessionMode>("FULL");
  const [error, setError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [manualMode, setManualMode] = useState<SessionMode>("FULL");

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

  const handleStartLiteSession = async () => {
    const res = await fetch("/api/start-lite-session", {
      method: "POST",
    });
    if (!res.ok) {
      const error = await res.json();
      setError(error.error);
      return;
    }
    const { session_token } = await res.json();
    setSessionToken(session_token);
    setMode("LITE");
  };

  const handleStartWithToken = () => {
    const trimmed = manualToken.trim();
    if (!trimmed) {
      setError("Please enter a session token.");
      return;
    }
    setSessionToken(trimmed);
    setMode(manualMode);
  };

  const onSessionStopped = () => {
    setSessionToken("");
    setManualToken("");
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
            Start Full Mode Avatar Session
          </button>

          <button
            onClick={() => handleStartFullSession(true)}
            className="w-fit bg-white text-black px-4 py-2 rounded-md"
          >
            Start Full Mode Avatar Session (Push To Talk)
          </button>

          <button
            onClick={handleStartLiteSession}
            className="w-fit bg-white text-black px-4 py-2 rounded-md"
          >
            Start Lite Mode Avatar Session
          </button>

          <div className="w-full max-w-md flex flex-col items-center gap-2 mt-6 pt-6 border-t border-gray-600">
            <span className="text-sm text-gray-400">
              Or start with an existing session token
            </span>
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste session token"
              className="w-full px-3 py-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-white"
            />
            <select
              value={manualMode}
              onChange={(e) => setManualMode(e.target.value as SessionMode)}
              className="w-full px-3 py-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-white"
            >
              <option value="FULL">Full Mode</option>
              <option value="FULL_PTT">Full Mode (Push To Talk)</option>
              <option value="LITE">Lite Mode</option>
            </select>
            <button
              onClick={handleStartWithToken}
              className="w-fit bg-white text-black px-4 py-2 rounded-md"
            >
              Start Session with Token
            </button>
          </div>
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
