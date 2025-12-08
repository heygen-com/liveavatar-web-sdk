"use client";

import { useState } from "react";
import Image from "next/image";
import { LiveAvatarSession } from "./LiveAvatarSession";

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    try {
      const res = await fetch("/api/start-session", {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        setError(error.error);
        return;
      }
      const { session_token } = await res.json();
      setSessionToken(session_token);
    } catch (error: unknown) {
      setError((error as Error).message);
    }
  };

  const onSessionStopped = () => {
    // Reset the FE state
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
            className="relative w-[800px] h-[800px] overflow-hidden border-0 p-0 cursor-pointer"
          >
            <Image
              src="https://i.postimg.cc/dtzVr981/IMG-6934.jpg"
              alt="Start Avatar Session"
              fill
              className="object-contain"
            />
          </button>
        </>
      ) : (
        <LiveAvatarSession
          mode="FULL"
          sessionAccessToken={sessionToken}
          onSessionStopped={onSessionStopped}
        />
      )}
    </div>
  );
};
