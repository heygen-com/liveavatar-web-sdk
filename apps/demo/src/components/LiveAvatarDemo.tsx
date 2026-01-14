import { useState } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";

type StartSessionResponse =
  | { sessionAccessToken: string; sessionId: string }
  | { session_token: string; session_id?: string }; // fallback if any route still uses old keys

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [mode, setMode] = useState<"FULL" | "CUSTOM">("FULL");
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    try {
      setError(null);

      const res = await fetch("/api/start-session", { method: "POST" });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || "Failed to start session");
        return;
      }

      const data = (await res.json()) as StartSessionResponse;

      const token =
        "sessionAccessToken" in data ? data.sessionAccessToken : data.session_token;

      if (!token) {
        setError("Missing session token in response");
        return;
      }

      setSessionToken(token);
      setMode("FULL");
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    }
  };

  const handleStartCustom = async () => {
    try {
      setError(null);

      const res = await fetch("/api/start-custom-session", { method: "POST" });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || "Failed to start custom session");
        return;
      }

      const data = (await res.json()) as StartSessionResponse;

      const token =
        "sessionAccessToken" in data ? data.sessionAccessToken : data.session_token;

      if (!token) {
        setError("Missing session token in response");
        return;
      }

      setSessionToken(token);
      setMode("CUSTOM");
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    }
  };

  const onSessionStopped = () => {
    setSessionToken("");
  };

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
            onClick={handleStart}
            className="w-fit bg-white text-black px-4 py-2 rounded-md"
          >
            Start Full Avatar Session
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
          onSessionStopped={onSessionStopped}
        />
      )}
    </div>
  );
};
