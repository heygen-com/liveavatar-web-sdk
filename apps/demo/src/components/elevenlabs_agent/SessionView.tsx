"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SessionState } from "@heygen/liveavatar-web-sdk";
import { useElevenLabsAgentContext } from "./context";

const Btn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
  children: React.ReactNode;
}> = ({ onClick, disabled, variant = "secondary", size = "md", children }) => {
  const sizes = { sm: "px-4 py-2 text-sm", md: "px-5 py-2.5 text-sm" };
  const variants = {
    primary: "bg-white text-black hover:bg-gray-100 active:bg-gray-200",
    secondary:
      "bg-white/10 text-white border border-white/10 hover:bg-white/15 active:bg-white/20",
    danger:
      "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]}`}
    >
      {children}
    </button>
  );
};

type Props = { onSessionStopped: () => void };

export const SessionView: React.FC<Props> = ({ onSessionStopped }) => {
  const {
    sessionRef,
    sessionState,
    isStreamReady,
    connectionQuality,
    isUserTalking,
    isAvatarTalking,
    inboundEvents,
  } = useElevenLabsAgentContext();

  const videoRef = useRef<HTMLVideoElement>(null);
  const eventLogEndRef = useRef<HTMLDivElement>(null);

  const [userText, setUserText] = useState("");
  const [contextText, setContextText] = useState("");
  const [activityPing, setActivityPing] = useState(false);

  // Lifecycle: start once on mount, react to disconnect
  useEffect(() => {
    if (sessionState === SessionState.INACTIVE) {
      sessionRef.current.start();
    }
  }, [sessionRef, sessionState]);

  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      onSessionStopped();
    }
  }, [sessionState, onSessionStopped]);

  useEffect(() => {
    if (isStreamReady && videoRef.current) {
      sessionRef.current.attach(videoRef.current);
    }
  }, [isStreamReady, sessionRef]);

  useEffect(() => {
    eventLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [inboundEvents]);

  const stop = useCallback(() => sessionRef.current.stop(), [sessionRef]);

  const handleSendUserMessage = useCallback(() => {
    const trimmed = userText.trim();
    if (!trimmed) return;
    sessionRef.current.sendUserMessage(trimmed);
    setUserText("");
  }, [sessionRef, userText]);

  const handleSendContextualUpdate = useCallback(() => {
    const trimmed = contextText.trim();
    if (!trimmed) return;
    sessionRef.current.sendContextualUpdate(trimmed);
    setContextText("");
  }, [sessionRef, contextText]);

  const handleUserActivity = useCallback(() => {
    sessionRef.current.sendUserActivity();
    setActivityPing(true);
    setTimeout(() => setActivityPing(false), 600);
  }, [sessionRef]);

  const qualityColor =
    connectionQuality === "GOOD"
      ? "text-green-400"
      : connectionQuality === "BAD"
        ? "text-red-400"
        : "text-gray-500";

  return (
    <div className="w-full max-w-[1400px] h-full flex flex-col gap-4 py-4">
      <div className="w-full flex flex-row items-start justify-center gap-4">
        {/* Video */}
        <div className="relative overflow-hidden rounded-lg flex flex-col items-center justify-center bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-contain transition-opacity ${
              sessionState === SessionState.CONNECTED
                ? "opacity-100"
                : "opacity-0"
            }`}
          />
          {sessionState !== SessionState.CONNECTED && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
              Waiting for avatar and ElevenLabs agent…
            </div>
          )}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
              <div
                className={`w-2 h-2 rounded-full ${
                  sessionState === SessionState.CONNECTED
                    ? "bg-green-400"
                    : sessionState === SessionState.CONNECTING
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-gray-500"
                }`}
              />
              <span className="text-xs text-white/70 font-medium uppercase tracking-wider">
                {sessionState}
              </span>
            </div>
            <span
              className={`text-xs font-medium uppercase tracking-wider px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm ${qualityColor}`}
            >
              {connectionQuality}
            </span>
          </div>
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors ${
                isUserTalking
                  ? "bg-blue-500/30 border border-blue-400/30"
                  : "bg-black/40"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full transition-colors ${isUserTalking ? "bg-blue-400 animate-pulse" : "bg-gray-500"}`}
              />
              <span className="text-xs text-white/70 font-medium">You</span>
            </div>
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors ${
                isAvatarTalking
                  ? "bg-purple-500/30 border border-purple-400/30"
                  : "bg-black/40"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full transition-colors ${isAvatarTalking ? "bg-purple-400 animate-pulse" : "bg-gray-500"}`}
              />
              <span className="text-xs text-white/70 font-medium">Avatar</span>
            </div>
          </div>
          <button
            className="absolute bottom-3 right-3 px-4 py-2 text-sm font-medium rounded-lg bg-red-500/80 text-white hover:bg-red-500 backdrop-blur-sm transition-colors"
            onClick={stop}
          >
            End Session
          </button>
        </div>

        {/* ElevenLabs control panel */}
        <div className="w-[400px] shrink-0 overflow-hidden border border-white/10 rounded-lg bg-white/5 flex flex-col h-[600px]">
          <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-center justify-between">
            <p className="font-medium text-sm text-white">ElevenLabs Agent</p>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              agent-control
            </span>
          </div>

          <div
            className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 font-mono text-[11px]"
            style={{ scrollbarWidth: "none" }}
          >
            {inboundEvents.length === 0 && (
              <p className="text-gray-500 text-center mt-8">
                Inbound elevenlabs_agent_event payloads will stream here
              </p>
            )}
            {inboundEvents.map((evt, idx) => (
              <div
                key={`${evt.event_id}-${evt.receivedAt}-${idx}`}
                className="px-2 py-1.5 rounded bg-black/40 border border-white/5 text-gray-300"
              >
                <div className="text-purple-300 font-semibold">
                  {evt.elevenlabs_event_type}
                </div>
                <pre className="whitespace-pre-wrap break-all text-gray-400 mt-0.5">
                  {JSON.stringify(evt.data, null, 2)}
                </pre>
              </div>
            ))}
            <div ref={eventLogEndRef} />
          </div>

          <div className="shrink-0 px-3 py-3 border-t border-white/10 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-wider text-gray-500">
                user_message
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userText}
                  onChange={(e) => setUserText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendUserMessage();
                  }}
                  placeholder="Type a message to the agent..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 text-white text-xs border border-white/10 focus:outline-none focus:border-white/30"
                />
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={handleSendUserMessage}
                >
                  Send
                </Btn>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-wider text-gray-500">
                contextual_update
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contextText}
                  onChange={(e) => setContextText(e.target.value)}
                  placeholder="e.g. User navigated to pricing page"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 text-white text-xs border border-white/10 focus:outline-none focus:border-white/30"
                />
                <Btn size="sm" onClick={handleSendContextualUpdate}>
                  Update
                </Btn>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-gray-500">
                user_activity (keepalive)
              </span>
              <Btn size="sm" onClick={handleUserActivity}>
                {activityPing ? "Pinged" : "Ping"}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
