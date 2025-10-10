"use client";

import { useState } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [sessionId, setSessionId] = useState("");

  const handleStart = async () => {
    const res = await fetch("/api/start-session", {
      method: "POST",
    });
    const { session_token, session_id } = await res.json();

    setSessionToken(session_token);
    setSessionId(session_id);
  };

  const onSessionStopped = () => {
    // Reset the FE state
    setSessionToken("");
    setSessionId("");
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {!sessionToken ? (
        <button
          onClick={handleStart}
          className="w-fit bg-white text-black px-4 py-2 rounded-md"
        >
          Start
        </button>
      ) : (
        <LiveAvatarSession
          sessionId={sessionId}
          sessionAccessToken={sessionToken}
          onSessionStopped={onSessionStopped}
        />
      )}
    </div>
  );
};
