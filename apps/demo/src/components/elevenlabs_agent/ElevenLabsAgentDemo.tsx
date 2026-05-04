"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Setup } from "./Setup";
import { SessionView } from "./SessionView";
import { ElevenLabsAgentProvider } from "./context";

export const ElevenLabsAgentDemo = () => {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState("");

  const handleStop = () => {
    setSessionToken("");
  };

  if (!sessionToken) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <Setup
          onSessionStarted={setSessionToken}
          onBack={() => router.push("/")}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <ElevenLabsAgentProvider sessionAccessToken={sessionToken}>
        <SessionView onSessionStopped={handleStop} />
      </ElevenLabsAgentProvider>
    </div>
  );
};
