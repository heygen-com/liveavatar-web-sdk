"use client";

import { useMemo, useState } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";
import { SessionInteractivityMode } from "@heygen/liveavatar-web-sdk";

export type SessionMode = "FULL" | "FULL_PTT" | "LITE";

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [mode, setMode] = useState<SessionMode>("FULL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualMode, setManualMode] = useState<SessionMode>("FULL");

  const handleStartFullSession = async (pushToTalk: boolean = false) => {
    setLoading(true);
    setError(null);
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
    } finally {
      setLoading(false);
    }
  };

  const handleStartLiteSession = async () => {
    setLoading(true);
    setError(null);
    try {
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
    } catch (error: unknown) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
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
    <div className="w-full h-full flex flex-col items-center justify-center">
      {!sessionToken ? (
        <div className="w-full max-w-lg flex flex-col items-center gap-6 p-8">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-semibold text-white mb-1">
              LiveAvatar Demo
            </h1>
            <p className="text-sm text-gray-400">
              Choose a session mode to get started
            </p>
          </div>

          {error && (
            <div className="w-full px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => handleStartFullSession(false)}
              disabled={loading}
              className="w-full px-6 py-2.5 rounded-lg bg-white/10 text-white font-medium text-base border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Starting..." : "Full Mode"}
            </button>
            <button
              onClick={() => handleStartFullSession(true)}
              disabled={loading}
              className="w-full px-6 py-2.5 rounded-lg bg-white/10 text-white font-medium text-base border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Starting..." : "Full Mode (Push to Talk)"}
            </button>
            <button
              onClick={handleStartLiteSession}
              disabled={loading}
              className="w-full px-6 py-2.5 rounded-lg bg-white/10 text-white font-medium text-base border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Starting..." : "Lite Mode"}
            </button>
          </div>

          <div className="w-full flex flex-col items-center gap-3 pt-6 border-t border-white/10">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              Or use an existing token
            </span>
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste session token"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 text-white text-sm border border-white/10 focus:outline-none focus:border-white/30 placeholder-gray-500 transition-colors"
            />
            <select
              value={manualMode}
              onChange={(e) => setManualMode(e.target.value as SessionMode)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 text-white text-sm border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
            >
              <option value="FULL">Full Mode</option>
              <option value="FULL_PTT">Full Mode (Push To Talk)</option>
              <option value="LITE">Lite Mode</option>
            </select>
            <button
              onClick={handleStartWithToken}
              className="w-full px-6 py-2.5 rounded-lg bg-white/10 text-white font-medium text-base border border-white/20 hover:bg-white/20 transition-colors"
            >
              Connect
            </button>
          </div>
        </div>
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
