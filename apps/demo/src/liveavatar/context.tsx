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
