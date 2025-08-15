import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  ConnectionQuality,
  LiveAvatarSession,
  SessionState,
  SessionConfig,
  LiveAvatarClient,
  SessionEvent,
  VoiceChatEvent,
  VoiceChatState,
} from "@liveavatar/js-sdk";
import { LiveAvatarSessionMessage, MessageSender } from "./types";

const client = new LiveAvatarClient();

type LiveAvatarContextProps = {
  sessionRef: React.RefObject<LiveAvatarSession>;

  isMuted: boolean;
  voiceChatState: VoiceChatState;

  sessionState: SessionState;
  stream: MediaStream | null;
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
  stream: null,
  isUserTalking: false,
  isAvatarTalking: false,
  messages: [],
});

type LiveAvatarContextProviderProps = {
  children: React.ReactNode;
  sessionToken: string;
  config?: SessionConfig;
};

const useSessionState = (sessionRef: React.RefObject<LiveAvatarSession>) => {
  const [sessionState, setSessionState] = useState<SessionState>(
    sessionRef.current?.state || SessionState.INACTIVE,
  );
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    sessionRef.current?.connectionQuality || ConnectionQuality.UNKNOWN,
  );
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (sessionRef.current) {
      sessionRef.current.on(SessionEvent.STATE_CHANGED, (state) => {
        setSessionState(state);
        if (state === SessionState.DISCONNECTED) {
          sessionRef.current.removeAllListeners();
          sessionRef.current.voiceChat.removeAllListeners();
          setStream(null);
        }
      });
      sessionRef.current.on(SessionEvent.STREAM_READY, setStream);
      sessionRef.current.on(
        SessionEvent.CONNECTION_QUALITY_CHANGED,
        setConnectionQuality,
      );
    }
  }, [sessionRef]);

  return { sessionState, stream, connectionQuality };
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
      sessionRef.current.on(SessionEvent.USER_START_TALKING, () => {
        setIsUserTalking(true);
      });
      sessionRef.current.on(SessionEvent.USER_STOP_TALKING, () => {
        setIsUserTalking(false);
      });
      sessionRef.current.on(SessionEvent.AVATAR_START_TALKING, () => {
        setIsAvatarTalking(true);
      });
      sessionRef.current.on(SessionEvent.AVATAR_STOP_TALKING, () => {
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
    if (sessionRef.current) {
      const handleEndMessage = () => {
        currentSenderRef.current = null;
      };

      const handleMessage = (
        sender: MessageSender,
        { task_id, message }: { task_id: string; message: string },
      ) => {
        if (currentSenderRef.current === sender) {
          setMessages((prev) => [
            ...prev.slice(0, -1),
            {
              ...prev[prev.length - 1]!,
              message: [prev[prev.length - 1]!.message, message].join(""),
            },
          ]);
        } else {
          currentSenderRef.current = sender;
          setMessages((prev) => [
            ...prev,
            {
              id: task_id,
              sender: sender,
              message,
              timestamp: Date.now(),
            },
          ]);
        }
      };

      sessionRef.current.on(SessionEvent.USER_END_MESSAGE, handleEndMessage);
      sessionRef.current.on(SessionEvent.AVATAR_END_MESSAGE, handleEndMessage);
      sessionRef.current.on(SessionEvent.USER_MESSAGE, (data) =>
        handleMessage(MessageSender.USER, data),
      );
      sessionRef.current.on(SessionEvent.AVATAR_MESSAGE, (data) =>
        handleMessage(MessageSender.AVATAR, data),
      );
    }
  }, [sessionRef]);

  return { messages };
};

export const LiveAvatarContextProvider = ({
  children,
  sessionToken,
  config,
}: LiveAvatarContextProviderProps) => {
  const sessionRef = useRef<LiveAvatarSession>(
    client.createSession(config || {}, sessionToken),
  );
  const { sessionState, stream, connectionQuality } =
    useSessionState(sessionRef);
  const { isMuted, voiceChatState } = useVoiceChatState(sessionRef);
  const { isUserTalking, isAvatarTalking } = useTalkingState(sessionRef);
  const { messages } = useChatHistoryState(sessionRef);

  return (
    <LiveAvatarContext.Provider
      value={{
        sessionRef,
        sessionState,
        stream,
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
