"use client";

import { useState } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [mode, setMode] = useState<"FULL" | "CUSTOM">("FULL");

  const handleStart = async () => {
    const res = await fetch("/api/start-session", {
      method: "POST",
    });
    const { session_token } = await res.json();

    setSessionToken(session_token);
    setMode("FULL");
  };

  const handleStartCustom = async () => {
    const res = await fetch("/api/start-custom-session", {
      method: "POST",
    });
    const { session_token } = await res.json();
    setSessionToken(session_token);
    setMode("CUSTOM");
  };

  const onSessionStopped = () => {
    // Reset the FE state
    setSessionToken("");
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      {!sessionToken ? (
        <>
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
