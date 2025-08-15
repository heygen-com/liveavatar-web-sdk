"use client";

import { useState } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");

  const handleStart = async () => {
    const res = await fetch("/api/get-access-token", {
      method: "POST",
    });
    const token = await res.text();
    console.log("Token:", token);
    setSessionToken(token);
  };

  const onSessionStopped = () => {
    setSessionToken("");
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {sessionToken ? (
        <button
          onClick={handleStart}
          className="w-fit bg-white text-black px-4 py-2 rounded-md"
        >
          Start
        </button>
      ) : (
        <LiveAvatarSession
          token={sessionToken}
          onSessionStopped={onSessionStopped}
        />
      )}
    </div>
  );
};
