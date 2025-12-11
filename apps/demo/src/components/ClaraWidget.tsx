"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { SessionState, ConnectionQuality } from "@heygen/liveavatar-web-sdk";
import {
  LiveAvatarContextProvider,
  useSession,
  useVoiceChat,
  useLiveAvatarContext,
  WidgetState,
  CustomerData,
} from "../liveavatar";
import { useScreenSize, useFixedHeight } from "../hooks";

// Icons (inline SVGs for simplicity)
const PhoneIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  </svg>
);

const PhoneOffIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
    />
  </svg>
);

const MicIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
    />
  </svg>
);

const MicOffIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      clipRule="evenodd"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
    />
  </svg>
);

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// ============================================
// STATUS INDICATOR COMPONENT
// ============================================
interface StatusIndicatorProps {
  isConnected: boolean;
  isUserTalking: boolean;
  isAvatarTalking: boolean;
  isMuted: boolean;
  connectionQuality: ConnectionQuality;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  isConnected,
  isUserTalking,
  isAvatarTalking,
  isMuted,
  connectionQuality,
}) => {
  // Determine which status to show (priority order)
  const getStatusContent = () => {
    if (!isConnected) {
      return null;
    }

    if (isMuted) {
      return (
        <div className="status-badge bg-red-500/90 text-white border border-red-400/30">
          <MicOffIcon className="w-3 h-3" />
          <span>Muted</span>
        </div>
      );
    }

    if (isUserTalking) {
      return (
        <div className="status-badge status-badge-success status-pulse">
          <div className="voice-wave text-white">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>Listening</span>
        </div>
      );
    }

    if (isAvatarTalking) {
      return (
        <div className="status-badge status-badge-info">
          <div className="voice-wave text-white">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>Responding</span>
        </div>
      );
    }

    return (
      <div className="status-badge status-badge-neutral">
        <div
          className={`connection-dot ${connectionQuality === ConnectionQuality.GOOD ? "good" : connectionQuality === ConnectionQuality.BAD ? "bad" : "unknown"} dot-pulse`}
        />
        <span>Connected</span>
      </div>
    );
  };

  return <div className="absolute top-4 left-4 z-10">{getStatusContent()}</div>;
};

// ============================================
// VOICE CONTROLS COMPONENT
// ============================================
interface VoiceControlsProps {
  isMuted: boolean;
  isActive: boolean;
  isLoading: boolean;
  onToggleMute: () => void;
  onStart: () => void;
  onStop: () => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  isMuted,
  isActive,
  isLoading,
  onToggleMute,
}) => {
  if (!isActive) return null;

  return (
    <button
      onClick={onToggleMute}
      disabled={isLoading}
      className={`btn-mute floating-glass ${isMuted ? "muted" : ""}`}
      title={isMuted ? "Unmute" : "Mute"}
    >
      {isMuted ? (
        <MicOffIcon className="w-5 h-5" />
      ) : (
        <MicIcon className="w-5 h-5" />
      )}
    </button>
  );
};

// ============================================
// LANDING SCREEN COMPONENT
// ============================================
interface LandingScreenProps {
  onStartCall: () => void;
  isLoading: boolean;
  userName?: string | null;
  customerData?: CustomerData | null;
}

const LandingScreen: React.FC<LandingScreenProps> = ({
  onStartCall,
  isLoading,
  userName,
  customerData,
}) => {
  const displayName = customerData?.firstName || userName;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 landing-gradient">
      <div className="landing-card max-w-sm w-full text-center">
        {/* Avatar placeholder */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-lg">
          <span className="text-4xl text-white">AI</span>
        </div>

        {/* Greeting */}
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {displayName ? `Hello, ${displayName}!` : "Hello!"}
        </h2>
        <p className="text-slate-600 mb-8">
          Ready to start a conversation with your virtual assistant?
        </p>

        {/* Start button */}
        <button
          onClick={onStartCall}
          disabled={isLoading}
          className="w-full btn-success flex items-center justify-center gap-3 min-h-[56px]"
        >
          {isLoading ? (
            <>
              <LoaderIcon className="w-5 h-5" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <PhoneIcon className="w-5 h-5" />
              <span>Start Call</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ============================================
// CONNECTING SCREEN COMPONENT
// ============================================
const ConnectingScreen: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-100">
      <div className="text-center">
        <div className="spinner spinner-dark w-12 h-12 mx-auto mb-6" />
        <h2 className="text-xl font-semibold text-slate-700 mb-2">
          Connecting...
        </h2>
        <p className="text-slate-500">
          Please wait while we establish the connection
        </p>
      </div>
    </div>
  );
};

// ============================================
// AVATAR VIDEO COMPONENT
// ============================================
interface AvatarVideoProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreamReady: boolean;
}

const AvatarVideo: React.FC<AvatarVideoProps> = ({
  videoRef,
  isStreamReady,
}) => {
  return (
    <div className="avatar-container rounded-2xl overflow-hidden shadow-2xl">
      {!isStreamReady && (
        <div className="avatar-placeholder flex items-center justify-center">
          <div className="spinner w-8 h-8" />
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className={`w-full h-full object-cover transition-opacity duration-500 ${isStreamReady ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
};

// ============================================
// CONNECTED SESSION COMPONENT
// ============================================
interface ConnectedSessionProps {
  onEndCall: () => void;
}

const ConnectedSession: React.FC<ConnectedSessionProps> = ({ onEndCall }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isDesktop } = useScreenSize();
  const { fixedHeight, isInIframe } = useFixedHeight();

  const { isStreamReady, connectionQuality, attachElement } = useSession();

  const {
    isActive,
    isLoading,
    isMuted,
    isUserTalking,
    isAvatarTalking,
    mute,
    unmute,
    start: startVoiceChat,
    stop: stopVoiceChat,
  } = useVoiceChat();

  // Attach video element when stream is ready
  useEffect(() => {
    if (isStreamReady && videoRef.current) {
      attachElement(videoRef.current);
    }
  }, [isStreamReady, attachElement]);

  // Auto-start voice chat when connected
  useEffect(() => {
    if (isStreamReady && !isActive && !isLoading) {
      startVoiceChat();
    }
  }, [isStreamReady, isActive, isLoading, startVoiceChat]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      unmute();
    } else {
      mute();
    }
  }, [isMuted, mute, unmute]);

  const containerStyle =
    fixedHeight && isInIframe
      ? { height: `${fixedHeight}px`, overflow: "hidden" as const }
      : {};

  return (
    <div
      className="flex-1 flex flex-col relative safe-area-all"
      style={containerStyle}
    >
      {/* Main content area */}
      <div className="flex-1 relative p-4 md:p-6">
        {/* Avatar container - responsive sizing */}
        <div
          className={`
          relative mx-auto h-full
          ${
            isDesktop
              ? "max-w-4xl aspect-video"
              : "max-w-sm aspect-[9/16] md:aspect-[3/4]"
          }
        `}
        >
          {/* Status indicator */}
          <StatusIndicator
            isConnected={isStreamReady}
            isUserTalking={isUserTalking}
            isAvatarTalking={isAvatarTalking}
            isMuted={isMuted}
            connectionQuality={connectionQuality}
          />

          {/* Avatar video */}
          <AvatarVideo videoRef={videoRef} isStreamReady={isStreamReady} />

          {/* Controls overlay */}
          <div className="controls-overlay rounded-b-2xl">
            <div className="flex items-center justify-between gap-4">
              {/* Voice control */}
              <VoiceControls
                isMuted={isMuted}
                isActive={isActive}
                isLoading={isLoading}
                onToggleMute={handleToggleMute}
                onStart={startVoiceChat}
                onStop={stopVoiceChat}
              />

              {/* End call button */}
              <button
                onClick={onEndCall}
                className="btn-danger flex items-center gap-2 flex-1 max-w-xs justify-center"
              >
                <PhoneOffIcon className="w-5 h-5" />
                <span>End Call</span>
              </button>

              {/* Spacer for symmetry when voice controls are shown */}
              {isActive && <div className="w-11" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SESSION WRAPPER COMPONENT
// ============================================
interface SessionWrapperProps {
  onSessionStopped: () => void;
}

const SessionWrapper: React.FC<SessionWrapperProps> = ({
  onSessionStopped,
}) => {
  const { widgetState, sessionState } = useLiveAvatarContext();
  const { startSession, stopSession } = useSession();

  // Start session automatically
  useEffect(() => {
    if (sessionState === SessionState.INACTIVE) {
      startSession();
    }
  }, [sessionState, startSession]);

  // Handle session end
  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      onSessionStopped();
    }
  }, [sessionState, onSessionStopped]);

  const handleEndCall = useCallback(() => {
    stopSession();
  }, [stopSession]);

  // Render based on widget state
  if (widgetState === WidgetState.CONNECTING) {
    return <ConnectingScreen />;
  }

  if (widgetState === WidgetState.CONNECTED) {
    return <ConnectedSession onEndCall={handleEndCall} />;
  }

  return <ConnectingScreen />;
};

// ============================================
// MAIN WIDGET COMPONENT
// ============================================
export interface ClaraWidgetProps {
  userName?: string | null;
  customerData?: CustomerData | null;
}

export const ClaraWidget: React.FC<ClaraWidgetProps> = ({
  userName = null,
  customerData = null,
}) => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fixedHeight, isInIframe } = useFixedHeight();
  const { isDesktop } = useScreenSize();

  const handleStartCall = useCallback(async () => {
    setIsStarting(true);
    setError(null);

    try {
      // Send device type to select appropriate avatar (mobile/desktop)
      const res = await fetch("/api/start-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceType: isDesktop ? "desktop" : "mobile",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to start session");
      }

      const { session_token } = await res.json();
      setSessionToken(session_token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsStarting(false);
    }
  }, [isDesktop]);

  const handleSessionStopped = useCallback(() => {
    setSessionToken(null);
  }, []);

  const containerStyle =
    fixedHeight && isInIframe
      ? { height: `${fixedHeight}px`, overflow: "hidden" as const }
      : {};

  return (
    <div
      className="w-full h-full min-h-screen flex flex-col bg-slate-50"
      style={containerStyle}
    >
      {error && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="absolute top-2 right-2 text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {!sessionToken ? (
        <LandingScreen
          onStartCall={handleStartCall}
          isLoading={isStarting}
          userName={userName}
          customerData={customerData}
        />
      ) : (
        <LiveAvatarContextProvider
          sessionAccessToken={sessionToken}
          userName={userName}
          customerData={customerData}
        >
          <SessionWrapper onSessionStopped={handleSessionStopped} />
        </LiveAvatarContextProvider>
      )}
    </div>
  );
};

export default ClaraWidget;
