import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  ConnectionQuality,
  LiveAvatarSession,
  SessionState,
  SessionEvent,
  VoiceChatEvent,
  VoiceChatState,
  AgentEventsEnum,
  VoiceChatConfig,
} from "@heygen/liveavatar-web-sdk";
import { LiveAvatarSessionMessage, MessageSender } from "./types";
import { API_URL } from "../../app/api/secrets";

type LiveAvatarContextProps = {
  sessionRef: React.RefObject<LiveAvatarSession>;

  isMuted: boolean;
  voiceChatState: VoiceChatState;

  sessionState: SessionState;
  isStreamReady: boolean;
  connectionQuality: ConnectionQuality;

  isUserTalking: boolean;
  isAvatarTalking: boolean;

  messages: LiveAvatarSessionMessage[];
};

export const LiveAvatarContext = createContext<LiveAvatarContextProps>({
  sessionRef: {
    current: null,
  } as unknown as React.RefObject<LiveAvatarSession>,
  connectionQuality: ConnectionQuality.UNKNOWN,
  isMuted: true,
  voiceChatState: VoiceChatState.INACTIVE,
  sessionState: SessionState.DISCONNECTED,
  isStreamReady: false,
  isUserTalking: false,
  isAvatarTalking: false,
  messages: [],
});

type LiveAvatarContextProviderProps = {
  children: React.ReactNode;
  sessionAccessToken: string;
  voiceChatConfig?: boolean | VoiceChatConfig;
};

const useSessionState = (sessionRef: React.RefObject<LiveAvatarSession>) => {
  const [sessionState, setSessionState] = useState<SessionState>(
    sessionRef.current?.state || SessionState.INACTIVE,
  );
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    sessionRef.current?.connectionQuality || ConnectionQuality.UNKNOWN,
  );
  const [isStreamReady, setIsStreamReady] = useState<boolean>(false);

  useEffect(() => {
    if (sessionRef.current) {
      sessionRef.current.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
        setSessionState(state);
        if (state === SessionState.DISCONNECTED) {
          sessionRef.current.removeAllListeners();
          sessionRef.current.voiceChat.removeAllListeners();
          setIsStreamReady(false);
        }
      });
      sessionRef.current.on(SessionEvent.SESSION_STREAM_READY, () => {
        setIsStreamReady(true);
      });
      sessionRef.current.on(
        SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED,
        setConnectionQuality,
      );
    }
  }, [sessionRef]);

  return { sessionState, isStreamReady, connectionQuality };
};

const useVoiceChatState = (sessionRef: React.RefObject<LiveAvatarSession>) => {
  const [isMuted, setIsMuted] = useState(true);
  const [voiceChatState, setVoiceChatState] = useState<VoiceChatState>(
    sessionRef.current?.voiceChat.state || VoiceChatState.INACTIVE,
  );

  useEffect(() => {
    if (sessionRef.current) {
      sessionRef.current.voiceChat.on(VoiceChatEvent.MUTED, () => {
        setIsMuted(true);
      });
      sessionRef.current.voiceChat.on(VoiceChatEvent.UNMUTED, () => {
        setIsMuted(false);
      });
      sessionRef.current.voiceChat.on(
        VoiceChatEvent.STATE_CHANGED,
        setVoiceChatState,
      );
    }
  }, [sessionRef]);

  return { isMuted, voiceChatState };
};

const useTalkingState = (sessionRef: React.RefObject<LiveAvatarSession>) => {
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);

  useEffect(() => {
    if (sessionRef.current) {
      sessionRef.current.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
        setIsUserTalking(true);
      });
      sessionRef.current.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
        setIsUserTalking(false);
      });
      sessionRef.current.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        setIsAvatarTalking(true);
      });
      sessionRef.current.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        setIsAvatarTalking(false);
      });
    }
  }, [sessionRef]);

  return { isUserTalking, isAvatarTalking };
};

const useChatHistoryState = (
  sessionRef: React.RefObject<LiveAvatarSession>,
) => {
  const [messages, setMessages] = useState<LiveAvatarSessionMessage[]>([]);
  const currentSenderRef = useRef<MessageSender | null>(null);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    // User chunks are cumulative (full phrase so far) — replace
    const handleUserChunk = (event: { text: string }) => {
      const sender = MessageSender.USER;
      if (currentSenderRef.current === sender) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last) return prev;
          return [...prev.slice(0, -1), { ...last, message: event.text }];
        });
      } else {
        currentSenderRef.current = sender;
        setMessages((prev) => [
          ...prev,
          { sender, message: event.text, timestamp: Date.now() },
        ]);
      }
    };

    // Avatar chunks are individual words — append
    const handleAvatarChunk = (event: { text: string }) => {
      const sender = MessageSender.AVATAR;
      if (currentSenderRef.current === sender) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last) return prev;
          return [
            ...prev.slice(0, -1),
            { ...last, message: last.message + event.text },
          ];
        });
      } else {
        currentSenderRef.current = sender;
        setMessages((prev) => [
          ...prev,
          { sender, message: event.text, timestamp: Date.now() },
        ]);
      }
    };

    const handleUserFinal = (event: { text: string }) => {
      currentSenderRef.current = null;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === MessageSender.USER) {
          return [...prev.slice(0, -1), { ...last, message: event.text }];
        }
        return [
          ...prev,
          {
            sender: MessageSender.USER,
            message: event.text,
            timestamp: Date.now(),
          },
        ];
      });
    };

    const handleAvatarFinal = (event: { text: string }) => {
      currentSenderRef.current = null;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === MessageSender.AVATAR) {
          return [...prev.slice(0, -1), { ...last, message: event.text }];
        }
        return [
          ...prev,
          {
            sender: MessageSender.AVATAR,
            message: event.text,
            timestamp: Date.now(),
          },
        ];
      });
    };

    session.on(AgentEventsEnum.USER_TRANSCRIPTION_CHUNK, handleUserChunk);
    session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK, handleAvatarChunk);
    session.on(AgentEventsEnum.USER_TRANSCRIPTION, handleUserFinal);
    session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, handleAvatarFinal);

    return () => {
      session.off(AgentEventsEnum.USER_TRANSCRIPTION_CHUNK, handleUserChunk);
      session.off(
        AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK,
        handleAvatarChunk,
      );
      session.off(AgentEventsEnum.USER_TRANSCRIPTION, handleUserFinal);
      session.off(AgentEventsEnum.AVATAR_TRANSCRIPTION, handleAvatarFinal);
    };
  }, [sessionRef]);

  return { messages };
};

export const LiveAvatarContextProvider = ({
  children,
  sessionAccessToken,
  voiceChatConfig = true,
}: LiveAvatarContextProviderProps) => {
  // Default voice chat on
  const config = {
    voiceChat: voiceChatConfig,
    apiUrl: API_URL,
  };
  const sessionRef = useRef<LiveAvatarSession>(
    new LiveAvatarSession(sessionAccessToken, config),
  );

  const { sessionState, isStreamReady, connectionQuality } =
    useSessionState(sessionRef);

  const { isMuted, voiceChatState } = useVoiceChatState(sessionRef);
  const { isUserTalking, isAvatarTalking } = useTalkingState(sessionRef);
  const { messages } = useChatHistoryState(sessionRef);

  return (
    <LiveAvatarContext.Provider
      value={{
        sessionRef,
        sessionState,
        isStreamReady,
        connectionQuality,
        isMuted,
        voiceChatState,
        isUserTalking,
        isAvatarTalking,
        messages,
      }}
    >
      {children}
    </LiveAvatarContext.Provider>
  );
};

export const useLiveAvatarContext = () => {
  return useContext(LiveAvatarContext);
};
