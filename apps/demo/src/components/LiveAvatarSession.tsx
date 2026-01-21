"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  LiveAvatarContextProvider,
  useSession,
  useTextChat,
  useVoiceChat,
} from "../liveavatar";
import { SessionState, VoiceChatConfig } from "@heygen/liveavatar-web-sdk";
import { useAvatarActions } from "../liveavatar/useAvatarActions";
import { SessionMode } from "./LiveAvatarDemo";

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
  mode: SessionMode;
  onSessionStopped: () => void;
}> = ({ mode, onSessionStopped }) => {
  const [message, setMessage] = useState("");
  const {
    sessionState,
    isStreamReady,
    startSession,
    stopSession,
    connectionQuality,
    keepAlive,
    attachElement,
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
    startPushToTalk,
    stopPushToTalk,
  } = useVoiceChat();

  // For useAvatarActions, treat FULL_PTT as FULL since they share the same API
  const avatarActionsMode = mode === "FULL_PTT" ? "FULL" : mode;
  const { interrupt, repeat, startListening, stopListening } =
    useAvatarActions(avatarActionsMode);

  // For useTextChat, treat FULL_PTT as FULL since they share the same API
  const textChatMode = mode === "FULL_PTT" ? "FULL" : mode;
  const { sendMessage } = useTextChat(textChatMode);
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

  const VoiceChatComponents = (
    <>
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
      <div className="flex flex-row items-center justify-center gap-4">
        <Button onClick={startListening}>Start Listening</Button>
        <Button onClick={stopListening}>Stop Listening</Button>
      </div>
    </>
  );

  const PushToTalkComponents = (
    <div className="flex flex-row items-center justify-center gap-4">
      <Button
        onClick={() => {
          startListening();
          startPushToTalk();
        }}
      >
        Start Push to Talk
      </Button>
      <Button
        onClick={() => {
          stopPushToTalk();
          stopListening();
        }}
      >
        Stop Push to Talk
      </Button>
    </div>
  );

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
        {(mode === "FULL" || mode === "FULL_PTT") && (
          <p>User talking: {isUserTalking ? "true" : "false"}</p>
        )}
        <p>Avatar talking: {isAvatarTalking ? "true" : "false"}</p>
        {mode === "FULL" && VoiceChatComponents}
        {mode === "FULL_PTT" && PushToTalkComponents}
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
  mode: SessionMode;
  sessionAccessToken: string;
  onSessionStopped: () => void;
  voiceChatConfig?: boolean | VoiceChatConfig;
}> = ({
  mode,
  sessionAccessToken,
  onSessionStopped,
  voiceChatConfig = true,
}) => {
  return (
    <LiveAvatarContextProvider
      sessionAccessToken={sessionAccessToken}
      voiceChatConfig={voiceChatConfig}
    >
      <LiveAvatarSessionComponent
        mode={mode}
        onSessionStopped={onSessionStopped}
      />
    </LiveAvatarContextProvider>
  );
};
