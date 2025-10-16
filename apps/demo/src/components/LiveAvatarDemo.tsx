"use client";

import { useState } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");

  const handleStart = async () => {
    const res = await fetch("/api/start-session", {
      method: "POST",
    });
    const { session_token } = await res.json();

    setSessionToken(session_token);
  };

  const onSessionStopped = () => {
    // Reset the FE state
    setSessionToken("");
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
          sessionAccessToken={sessionToken}
          onSessionStopped={onSessionStopped}
        />
      )}
    </div>
  );
};
