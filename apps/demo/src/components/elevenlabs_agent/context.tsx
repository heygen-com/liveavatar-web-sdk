"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  AgentEventsEnum,
  ConnectionQuality,
  ElevenLabsAgentSession,
  SessionEvent,
  SessionState,
  VoiceChatEvent,
  VoiceChatState,
  VoiceChatConfig,
} from "@heygen/liveavatar-web-sdk";

// Client component: only NEXT_PUBLIC_* env vars reach the browser bundle.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.liveavatar.com";

export type ElevenLabsInboundEvent = {
  event_id: string;
  elevenlabs_event_type: string;
  data: Record<string, unknown>;
  receivedAt: number;
};

type ContextValue = {
  sessionRef: React.RefObject<ElevenLabsAgentSession>;
  sessionState: SessionState;
  isStreamReady: boolean;
  connectionQuality: ConnectionQuality;
  isMuted: boolean;
  voiceChatState: VoiceChatState;
  isUserTalking: boolean;
  isAvatarTalking: boolean;
  inboundEvents: ElevenLabsInboundEvent[];
};

const ElevenLabsAgentContext = createContext<ContextValue>({
  sessionRef: {
    current: null,
  } as unknown as React.RefObject<ElevenLabsAgentSession>,
  sessionState: SessionState.INACTIVE,
  isStreamReady: false,
  connectionQuality: ConnectionQuality.UNKNOWN,
  isMuted: true,
  voiceChatState: VoiceChatState.INACTIVE,
  isUserTalking: false,
  isAvatarTalking: false,
  inboundEvents: [],
});

type ProviderProps = {
  children: React.ReactNode;
  sessionAccessToken: string;
  voiceChatConfig?: boolean | VoiceChatConfig;
};

export const ElevenLabsAgentProvider = ({
  children,
  sessionAccessToken,
  voiceChatConfig = true,
}: ProviderProps) => {
  const sessionRef = useRef<ElevenLabsAgentSession>(
    new ElevenLabsAgentSession(sessionAccessToken, {
      voiceChat: voiceChatConfig,
      apiUrl: API_URL,
    }),
  );

  const [sessionState, setSessionState] = useState<SessionState>(
    SessionState.INACTIVE,
  );
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    ConnectionQuality.UNKNOWN,
  );
  const [isMuted, setIsMuted] = useState(true);
  const [voiceChatState, setVoiceChatState] = useState<VoiceChatState>(
    VoiceChatState.INACTIVE,
  );
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [inboundEvents, setInboundEvents] = useState<ElevenLabsInboundEvent[]>(
    [],
  );

  useEffect(() => {
    const session = sessionRef.current;

    // Bind named handlers so we can detach them on cleanup. React Strict Mode
    // mounts every effect twice in dev — without cleanup, every listener was
    // registered twice and every inbound event fired twice (which is what was
    // causing the duplicate `agent_response` rows).
    const onStateChanged = (state: SessionState) => {
      setSessionState(state);
      if (state === SessionState.DISCONNECTED) {
        setIsStreamReady(false);
      }
    };
    const onStreamReady = () => setIsStreamReady(true);
    const onUserSpeakStarted = () => setIsUserTalking(true);
    const onUserSpeakEnded = () => setIsUserTalking(false);
    const onAvatarSpeakStarted = () => setIsAvatarTalking(true);
    const onAvatarSpeakEnded = () => setIsAvatarTalking(false);
    const onMuted = () => setIsMuted(true);
    const onUnmuted = () => setIsMuted(false);
    const onElevenLabsEvent = (event: {
      event_id: string;
      elevenlabs_event_type: string;
      data: Record<string, unknown>;
    }) => {
      setInboundEvents((prev) => [
        ...prev,
        {
          event_id: event.event_id,
          elevenlabs_event_type: event.elevenlabs_event_type,
          data: event.data,
          receivedAt: Date.now(),
        },
      ]);
    };

    session.on(SessionEvent.SESSION_STATE_CHANGED, onStateChanged);
    session.on(SessionEvent.SESSION_STREAM_READY, onStreamReady);
    session.on(
      SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED,
      setConnectionQuality,
    );
    session.voiceChat.on(VoiceChatEvent.MUTED, onMuted);
    session.voiceChat.on(VoiceChatEvent.UNMUTED, onUnmuted);
    session.voiceChat.on(VoiceChatEvent.STATE_CHANGED, setVoiceChatState);
    session.on(AgentEventsEnum.USER_SPEAK_STARTED, onUserSpeakStarted);
    session.on(AgentEventsEnum.USER_SPEAK_ENDED, onUserSpeakEnded);
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, onAvatarSpeakStarted);
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, onAvatarSpeakEnded);
    session.on(AgentEventsEnum.ELEVENLABS_AGENT_EVENT, onElevenLabsEvent);

    return () => {
      session.off(SessionEvent.SESSION_STATE_CHANGED, onStateChanged);
      session.off(SessionEvent.SESSION_STREAM_READY, onStreamReady);
      session.off(
        SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED,
        setConnectionQuality,
      );
      session.voiceChat.off(VoiceChatEvent.MUTED, onMuted);
      session.voiceChat.off(VoiceChatEvent.UNMUTED, onUnmuted);
      session.voiceChat.off(VoiceChatEvent.STATE_CHANGED, setVoiceChatState);
      session.off(AgentEventsEnum.USER_SPEAK_STARTED, onUserSpeakStarted);
      session.off(AgentEventsEnum.USER_SPEAK_ENDED, onUserSpeakEnded);
      session.off(AgentEventsEnum.AVATAR_SPEAK_STARTED, onAvatarSpeakStarted);
      session.off(AgentEventsEnum.AVATAR_SPEAK_ENDED, onAvatarSpeakEnded);
      session.off(AgentEventsEnum.ELEVENLABS_AGENT_EVENT, onElevenLabsEvent);
    };
  }, []);

  return (
    <ElevenLabsAgentContext.Provider
      value={{
        sessionRef,
        sessionState,
        isStreamReady,
        connectionQuality,
        isMuted,
        voiceChatState,
        isUserTalking,
        isAvatarTalking,
        inboundEvents,
      }}
    >
      {children}
    </ElevenLabsAgentContext.Provider>
  );
};

export const useElevenLabsAgentContext = () =>
  useContext(ElevenLabsAgentContext);
