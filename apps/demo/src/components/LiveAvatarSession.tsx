"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  LiveAvatarContextProvider,
  useSession,
  useTextChat,
  useVoiceChat,
} from "../liveavatar";
import { SessionState } from "@liveavatar/js-sdk";
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
  onSessionStopped: () => void;
}> = ({ onSessionStopped }) => {
  const [message, setMessage] = useState("");
  const {
    sessionState,
    stream,
    startSession,
    stopSession,
    connectionQuality,
    keepAlive,
  } = useSession();
  const {
    isAvatarTalking,
    isUserTalking,
    isMuted,
    isActive,
    isLoading,
    start,
    stop,
    mute,
    unmute,
  } = useVoiceChat();
  const { interrupt, repeat, startListening, stopListening } =
    useAvatarActions();
  const { sendMessage } = useTextChat();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      onSessionStopped();
    }
  }, [sessionState, onSessionStopped]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current!.play();
      };
    }
  }, [videoRef, stream]);

  useEffect(() => {
    if (sessionState === SessionState.INACTIVE) {
      startSession();
    }
  }, [startSession, sessionState]);

  return (
    <div className="w-[1080px] max-w-full h-full flex flex-col items-center justify-center gap-4 py-4">
      <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />
        <button
          className="absolute bottom-4 right-4 bg-white text-black px-4 py-2 rounded-md"
          onClick={() => stopSession()}
        >
          Stop
        </button>
      </div>
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <p>Session state: {sessionState}</p>
        <p>Connection quality: {connectionQuality}</p>
        <p>User talking: {isUserTalking ? "true" : "false"}</p>
        <p>Avatar talking: {isAvatarTalking ? "true" : "false"}</p>
        <p>Voice Chat Active: {isActive ? "true" : "false"}</p>
        <p>Voice Chat Loading: {isLoading ? "true" : "false"}</p>
        {isActive && <p>Muted: {isMuted ? "true" : "false"}</p>}
        <Button
          onClick={() => {
            if (isActive) {
              stop();
            } else {
              start();
            }
          }}
          disabled={isLoading}
        >
          {isActive ? "Stop Voice Chat" : "Start Voice Chat"}
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
        <Button
          onClick={() => {
            keepAlive();
          }}
        >
          Keep Alive
        </Button>
        <div className="w-full h-full flex flex-row items-center justify-center gap-4">
          <Button
            onClick={() => {
              startListening();
            }}
          >
            Start Listening
          </Button>
          <Button
            onClick={() => {
              stopListening();
            }}
          >
            Stop Listening
          </Button>
          <Button
            onClick={() => {
              interrupt();
            }}
          >
            Interrupt
          </Button>
        </div>
        <div className="w-full h-full flex flex-row items-center justify-center gap-4">
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
          <Button
            onClick={() => {
              repeat(message);
              setMessage("");
            }}
          >
            Repeat
          </Button>
        </div>
      </div>
    </div>
  );
};

export const LiveAvatarSession: React.FC<{
  token: string;
  onSessionStopped: () => void;
}> = ({ token, onSessionStopped }) => {
  return (
    <LiveAvatarContextProvider
      sessionToken={token}
      config={{ voiceChat: true }}
    >
      <LiveAvatarSessionComponent onSessionStopped={onSessionStopped} />
    </LiveAvatarContextProvider>
  );
};
