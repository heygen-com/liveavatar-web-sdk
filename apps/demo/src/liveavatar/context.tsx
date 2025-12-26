import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ConnectionQuality,
  LiveAvatarSession,
  SessionState,
  SessionEvent,
  VoiceChatEvent,
  VoiceChatState,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";
import { LiveAvatarSessionMessage, CustomerData, WidgetState } from "./types";
import { API_URL } from "../../app/api/secrets";

type LiveAvatarContextProps = {
  sessionRef: React.RefObject<LiveAvatarSession>;

  isMuted: boolean;
  voiceChatState: VoiceChatState;

  sessionState: SessionState;
  widgetState: WidgetState;
  isStreamReady: boolean;
  connectionQuality: ConnectionQuality;

  isUserTalking: boolean;
  isAvatarTalking: boolean;

  messages: LiveAvatarSessionMessage[];

  // Personalization
  userName: string | null;
  customerData: CustomerData | null;
};

export const LiveAvatarContext = createContext<LiveAvatarContextProps>({
  sessionRef: {
    current: null,
  } as unknown as React.RefObject<LiveAvatarSession>,
  connectionQuality: ConnectionQuality.UNKNOWN,
  isMuted: true,
  voiceChatState: VoiceChatState.INACTIVE,
  sessionState: SessionState.DISCONNECTED,
  widgetState: WidgetState.INACTIVE,
  isStreamReady: false,
  isUserTalking: false,
  isAvatarTalking: false,
  messages: [],
  userName: null,
  customerData: null,
});

type LiveAvatarContextProviderProps = {
  children: React.ReactNode;
  sessionAccessToken: string;
  userName?: string | null;
  customerData?: CustomerData | null;
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
    const session = sessionRef.current;
    if (!session) return;

    // Named handlers for proper cleanup
    const handleStateChange = (state: SessionState) => {
      setSessionState(state);
      if (state === SessionState.DISCONNECTED) {
        session.removeAllListeners();
        session.voiceChat.removeAllListeners();
        setIsStreamReady(false);
      }
    };

    const handleStreamReady = () => setIsStreamReady(true);

    session.on(SessionEvent.SESSION_STATE_CHANGED, handleStateChange);
    session.on(SessionEvent.SESSION_STREAM_READY, handleStreamReady);
    session.on(
      SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED,
      setConnectionQuality,
    );

    // Cleanup: remove listeners on unmount
    return () => {
      session.off(SessionEvent.SESSION_STATE_CHANGED, handleStateChange);
      session.off(SessionEvent.SESSION_STREAM_READY, handleStreamReady);
      session.off(
        SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED,
        setConnectionQuality,
      );
    };
  }, [sessionRef]);

  return { sessionState, isStreamReady, connectionQuality };
};

const useVoiceChatState = (sessionRef: React.RefObject<LiveAvatarSession>) => {
  const [isMuted, setIsMuted] = useState(true);
  const [voiceChatState, setVoiceChatState] = useState<VoiceChatState>(
    sessionRef.current?.voiceChat.state || VoiceChatState.INACTIVE,
  );

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    // Named handlers for proper cleanup
    const handleMuted = () => setIsMuted(true);
    const handleUnmuted = () => setIsMuted(false);

    session.voiceChat.on(VoiceChatEvent.MUTED, handleMuted);
    session.voiceChat.on(VoiceChatEvent.UNMUTED, handleUnmuted);
    session.voiceChat.on(VoiceChatEvent.STATE_CHANGED, setVoiceChatState);

    // Cleanup: remove listeners on unmount
    return () => {
      session.voiceChat.off(VoiceChatEvent.MUTED, handleMuted);
      session.voiceChat.off(VoiceChatEvent.UNMUTED, handleUnmuted);
      session.voiceChat.off(VoiceChatEvent.STATE_CHANGED, setVoiceChatState);
    };
  }, [sessionRef]);

  return { isMuted, voiceChatState };
};

const useTalkingState = (sessionRef: React.RefObject<LiveAvatarSession>) => {
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    // Named handlers for proper cleanup
    const handleUserStart = () => setIsUserTalking(true);
    const handleUserEnd = () => setIsUserTalking(false);
    const handleAvatarStart = () => setIsAvatarTalking(true);
    const handleAvatarEnd = () => setIsAvatarTalking(false);

    session.on(AgentEventsEnum.USER_SPEAK_STARTED, handleUserStart);
    session.on(AgentEventsEnum.USER_SPEAK_ENDED, handleUserEnd);
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, handleAvatarStart);
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, handleAvatarEnd);

    // Cleanup: remove listeners on unmount
    return () => {
      session.off(AgentEventsEnum.USER_SPEAK_STARTED, handleUserStart);
      session.off(AgentEventsEnum.USER_SPEAK_ENDED, handleUserEnd);
      session.off(AgentEventsEnum.AVATAR_SPEAK_STARTED, handleAvatarStart);
      session.off(AgentEventsEnum.AVATAR_SPEAK_ENDED, handleAvatarEnd);
    };
  }, [sessionRef]);

  return { isUserTalking, isAvatarTalking };
};

/**
 * Derive widget state from session state
 */
const useWidgetState = (
  sessionState: SessionState,
  isStreamReady: boolean,
): WidgetState => {
  return useMemo(() => {
    if (
      sessionState === SessionState.DISCONNECTED ||
      sessionState === SessionState.INACTIVE
    ) {
      return WidgetState.INACTIVE;
    }
    if (sessionState === SessionState.CONNECTING || !isStreamReady) {
      return WidgetState.CONNECTING;
    }
    if (sessionState === SessionState.CONNECTED && isStreamReady) {
      return WidgetState.CONNECTED;
    }
    return WidgetState.INACTIVE;
  }, [sessionState, isStreamReady]);
};

export const LiveAvatarContextProvider = ({
  children,
  sessionAccessToken,
  userName = null,
  customerData = null,
}: LiveAvatarContextProviderProps) => {
  // Default voice chat on
  const config = {
    voiceChat: true,
    apiUrl: API_URL,
  };
  const sessionRef = useRef<LiveAvatarSession>(
    new LiveAvatarSession(sessionAccessToken, config),
  );

  const { sessionState, isStreamReady, connectionQuality } =
    useSessionState(sessionRef);

  const { isMuted, voiceChatState } = useVoiceChatState(sessionRef);
  const { isUserTalking, isAvatarTalking } = useTalkingState(sessionRef);
  const widgetState = useWidgetState(sessionState, isStreamReady);

  return (
    <LiveAvatarContext.Provider
      value={{
        sessionRef,
        sessionState,
        widgetState,
        isStreamReady,
        connectionQuality,
        isMuted,
        voiceChatState,
        isUserTalking,
        isAvatarTalking,
        messages: [], // TODO - properly implement chat history
        userName,
        customerData,
      }}
    >
      {children}
    </LiveAvatarContext.Provider>
  );
};

export const useLiveAvatarContext = () => {
  return useContext(LiveAvatarContext);
};
