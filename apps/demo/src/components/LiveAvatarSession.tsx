"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  LiveAvatarContextProvider,
  useSession,
  useTextChat,
  useVoiceChat,
} from "../liveavatar";
import { SessionState } from "@heygen/liveavatar-web-sdk";
import { useAvatarActions } from "../liveavatar/useAvatarActions";

const Button: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, children }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-white text-black px-4 py-2 rounded-md"
    >
      {children}
    </button>
  );
};

const LiveAvatarSessionComponent: React.FC<{
  mode: "FULL" | "CUSTOM";
  onSessionStopped: () => void;
}> = ({ mode, onSessionStopped }) => {
  const [message, setMessage] = useState("");
  const { sessionState, isStreamReady, startSession, attachElement } =
    useSession();
  const { isMuted, isActive, mute, unmute } = useVoiceChat();

  const { interrupt } = useAvatarActions(mode);

  const { sendMessage } = useTextChat(mode);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      onSessionStopped();
    }
  }, [sessionState, onSessionStopped]);

  useEffect(() => {
    if (isStreamReady && videoRef.current) {
      attachElement(videoRef.current);
    }
  }, [attachElement, isStreamReady]);

  useEffect(() => {
    if (sessionState === SessionState.INACTIVE) {
      startSession();
    }
  }, [startSession, sessionState]);

  // Hide authenticating screen - only show when stream is ready
  if (!isStreamReady) {
    return null;
  }

  return (
    <div className="relative w-screen h-screen bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-screen h-screen object-cover"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="flex flex-row items-center justify-center gap-4">
            <Button
              onClick={() => {
                interrupt();
              }}
            >
              Interrupt
            </Button>
            {isActive && (
              <Button
                onClick={() => {
                  if (isMuted) {
                    unmute();
                  } else {
                    mute();
                  }
                }}
              >
                {isMuted ? "Unmute" : "Mute"}
              </Button>
            )}
          </div>
          <div className="flex flex-row items-center justify-center gap-4">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-[400px] bg-white text-black px-4 py-2 rounded-md"
            />
            <Button
              onClick={() => {
                sendMessage(message);
                setMessage("");
              }}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LiveAvatarSession: React.FC<{
  mode: "FULL" | "CUSTOM";
  sessionAccessToken: string;
  onSessionStopped: () => void;
}> = ({ mode, sessionAccessToken, onSessionStopped }) => {
  return (
    <LiveAvatarContextProvider sessionAccessToken={sessionAccessToken}>
      <LiveAvatarSessionComponent
        mode={mode}
        onSessionStopped={onSessionStopped}
      />
    </LiveAvatarContextProvider>
  );
};
