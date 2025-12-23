"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { SessionState, ConnectionQuality } from "@heygen/liveavatar-web-sdk";
import {
  LiveAvatarContextProvider,
  useSession,
  useLiveAvatarContext,
  WidgetState,
  CustomerData,
} from "../liveavatar";
import { useScreenSize, useFixedHeight, useElevenLabsAgent } from "../hooks";

// shadcn/ui components
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";

// Lucide icons
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";

// ============================================
// SESSION LIMIT CONFIGURATION
// ============================================
// Toggle: false = no limit (beta), true = enforce limit (production)
const SESSION_LIMIT_ENABLED = true;
// Maximum session duration in minutes
const SESSION_LIMIT_MINUTES = 10;
// Warning before session ends (in seconds)
const SESSION_WARNING_SECONDS = 30;

// ============================================
// SAFARI iOS DETECTION
// ============================================
const isSafariIOS = (): boolean => {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS/.test(ua);
  const notFirefox = !/FxiOS/.test(ua);
  return iOS && webkit && notChrome && notFirefox;
};

// ============================================
// SAFARI iOS WARNING BANNER (non-blocking)
// ============================================
interface SafariBannerProps {
  onClose: () => void;
}

const SafariBanner: React.FC<SafariBannerProps> = ({ onClose }) => (
  <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-3 shadow-sm">
    <div className="flex items-center justify-between max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            Safari iOS tiene limitaciones
          </p>
          <p className="text-xs text-amber-600">
            Para mejor experiencia, usa Chrome o un navegador de escritorio.
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-amber-600 hover:text-amber-800 p-1 rounded-full hover:bg-amber-100 transition-colors"
        aria-label="Cerrar aviso"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
);

// ============================================
// SESSION EXPIRY WARNING BANNER
// ============================================
interface SessionExpiryWarningProps {
  secondsRemaining: number;
}

const SessionExpiryWarning: React.FC<SessionExpiryWarningProps> = ({
  secondsRemaining,
}) => (
  <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-200 px-4 py-3 shadow-sm animate-pulse">
    <div className="flex items-center justify-center gap-3 max-w-4xl mx-auto">
      <Clock className="w-5 h-5 text-red-600 flex-shrink-0" />
      <p className="text-sm font-medium text-red-800">
        Tu sesión expira en {secondsRemaining} segundos
      </p>
    </div>
  </div>
);

// ============================================
// STATUS INDICATOR COMPONENT (shadcn/ui redesign)
// ============================================
interface StatusIndicatorProps {
  isConnected: boolean;
  isListening: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  connectionQuality: ConnectionQuality;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  isConnected,
  isListening,
  isThinking,
  isSpeaking,
  isMuted,
  connectionQuality,
}) => {
  const getStatusContent = () => {
    if (!isConnected) {
      return null;
    }

    if (isMuted) {
      return (
        <Badge className="status-badge bg-red-500/90 text-white border border-red-400/30 hover:bg-red-500/90">
          <MicOff className="w-3 h-3 mr-1" />
          <span>Silenciado</span>
        </Badge>
      );
    }

    if (isListening) {
      return (
        <Badge className="status-badge status-badge-success status-pulse hover:bg-green-500/90">
          <div className="voice-wave text-white mr-1">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>Escuchando</span>
        </Badge>
      );
    }

    if (isThinking) {
      return (
        <Badge className="status-badge status-badge-warning hover:bg-amber-500/90">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          <span>Pensando</span>
        </Badge>
      );
    }

    if (isSpeaking) {
      return (
        <Badge className="status-badge status-badge-info hover:bg-blue-500/90">
          <div className="voice-wave text-white mr-1">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>Respondiendo</span>
        </Badge>
      );
    }

    return (
      <Badge className="status-badge status-badge-neutral hover:bg-white/30">
        <div
          className={`connection-dot ${connectionQuality === ConnectionQuality.GOOD ? "good" : connectionQuality === ConnectionQuality.BAD ? "bad" : "unknown"} dot-pulse mr-1`}
        />
        <span>Conectado</span>
      </Badge>
    );
  };

  return <div className="absolute top-4 left-4 z-10">{getStatusContent()}</div>;
};

// ============================================
// VOICE CONTROLS COMPONENT (shadcn/ui redesign)
// ============================================
interface VoiceControlsProps {
  isMuted: boolean;
  isActive: boolean;
  onToggleMute: () => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  isMuted,
  isActive,
  onToggleMute,
}) => {
  if (!isActive) return null;

  return (
    <Button
      onClick={onToggleMute}
      variant="ghost"
      size="icon"
      className={`floating-glass rounded-full w-12 h-12 ${isMuted ? "bg-red-500/80 hover:bg-red-500 text-white" : "bg-slate-800/80 hover:bg-slate-800 text-white"}`}
      title={isMuted ? "Activar micrófono" : "Silenciar"}
    >
      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </Button>
  );
};

// ============================================
// LANDING SCREEN COMPONENT (shadcn/ui redesign)
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
    <div className="flex-1 w-full flex flex-col items-center justify-center p-6 landing-gradient min-h-screen">
      <Card className="max-w-sm w-full glass-morphism border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          {/* Clara Avatar */}
          <Avatar className="w-24 h-24 mx-auto mb-4 ring-4 ring-white/50 shadow-xl">
            <AvatarImage src="/clara-avatar.png" alt="Clara" />
            <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-3xl font-bold">
              C
            </AvatarFallback>
          </Avatar>

          {/* Badge */}
          <Badge
            variant="secondary"
            className="mx-auto mb-3 bg-indigo-100 text-indigo-700 hover:bg-indigo-100"
          >
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse mr-2" />
            Clara Skin Care Assistant
          </Badge>

          <CardTitle className="text-2xl text-slate-800">
            {displayName ? `Hola, ${displayName}!` : "Hola!"}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Soy Clara, tu asistente de belleza personal. Estoy aquí para
            ayudarte a encontrar los productos perfectos para ti.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <Button
            onClick={onStartCall}
            disabled={isLoading}
            size="lg"
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg h-14 text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Phone className="w-5 h-5 mr-2" />
                Iniciar Conversación
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================
// CONNECTING SCREEN COMPONENT (shadcn/ui redesign)
// ============================================
const ConnectingScreen: React.FC = () => {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center p-6 landing-gradient min-h-screen">
      <Card className="max-w-sm w-full glass-morphism border-0 shadow-xl">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-700 mb-2">
            Conectando...
          </h2>
          <p className="text-slate-500 text-sm">Preparando a Clara</p>
        </CardContent>
      </Card>
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
// CONNECTED SESSION COMPONENT (Voice Agent)
// ============================================
interface ConnectedSessionProps {
  onEndCall: () => void;
}

const ConnectedSession: React.FC<ConnectedSessionProps> = ({ onEndCall }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isDesktop } = useScreenSize();
  const { fixedHeight, isInIframe } = useFixedHeight();
  const [isMuted, setIsMuted] = useState(false);

  // Session limit state
  const [sessionSecondsRemaining, setSessionSecondsRemaining] = useState(
    SESSION_LIMIT_MINUTES * 60,
  );
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { sessionRef } = useLiveAvatarContext();
  const { isStreamReady, connectionQuality, attachElement } = useSession();

  // Flag to prevent multiple agent connection attempts
  const hasConnectedAgentRef = useRef(false);

  // Audio buffer - accumulate all chunks, send when gap detected
  const audioBufferRef = useRef<string[]>([]);
  const totalChunksReceivedRef = useRef(0);
  const lastChunkTimeRef = useRef<number>(0);
  const gapCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Interruption handling - block old chunks, add leading silence
  const isInterruptionPendingRef = useRef(false);
  const isAfterInterruptRef = useRef(false);

  // Gap threshold: 300ms without new chunks = stream ended, send all
  // ElevenLabs sends chunks every ~150ms, so 300ms ensures we accumulate multiple chunks
  const CHUNK_GAP_THRESHOLD = 300;
  // Leading silence duration in ms (gives HeyGen time to process interrupt)
  const LEADING_SILENCE_MS = 150;

  // Generate silence in PCM 16-bit signed, 24kHz mono format (base64)
  const generateSilence = useCallback((durationMs: number): string => {
    const sampleRate = 24000;
    const numSamples = Math.floor((durationMs / 1000) * sampleRate);
    // PCM 16-bit = 2 bytes per sample
    const buffer = new Uint8Array(numSamples * 2);
    // All zeros = silence (16-bit signed PCM)
    // buffer is already filled with zeros by default

    // Convert to base64
    let binary = "";
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]!);
    }
    return btoa(binary);
  }, []);

  // Concatenate base64 audio chunks into a single base64 string
  const concatenateBase64Audio = useCallback((chunks: string[]): string => {
    if (chunks.length === 0) return "";
    if (chunks.length === 1) return chunks[0]!;

    // Decode all chunks to binary
    const binaryChunks = chunks.map((chunk) => {
      const binaryString = atob(chunk);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    });

    // Calculate total length
    const totalLength = binaryChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );

    // Concatenate all chunks
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of binaryChunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // Encode back to base64
    let binary = "";
    for (let i = 0; i < result.length; i++) {
      binary += String.fromCharCode(result[i]!);
    }
    return btoa(binary);
  }, []);

  // Send ALL accumulated audio to avatar (called when gap detected or agent_response_end)
  const sendAllAudioToAvatar = useCallback(() => {
    // Clear gap check interval
    if (gapCheckIntervalRef.current) {
      clearInterval(gapCheckIntervalRef.current);
      gapCheckIntervalRef.current = null;
    }

    if (audioBufferRef.current.length === 0) {
      console.log("[AUDIO] No audio to send");
      return;
    }

    const chunks = audioBufferRef.current;
    audioBufferRef.current = [];

    // Concatenate all chunks into one
    let concatenatedAudio = concatenateBase64Audio(chunks);
    if (!concatenatedAudio || !sessionRef.current) return;

    // Add leading silence after interruption to give HeyGen time to process
    if (isAfterInterruptRef.current) {
      const silenceBase64 = generateSilence(LEADING_SILENCE_MS);
      concatenatedAudio = concatenateBase64Audio([
        silenceBase64,
        concatenatedAudio,
      ]);
      isAfterInterruptRef.current = false;
      console.log(
        `[AUDIO] Added ${LEADING_SILENCE_MS}ms leading silence after interrupt`,
      );
    }

    const sizeKB = Math.round(concatenatedAudio.length / 1024);
    console.log(`[AUDIO] Sending ${chunks.length} chunks, ${sizeKB}KB total`);

    try {
      sessionRef.current.repeatAudio(concatenatedAudio);
    } catch (error) {
      console.error("Error sending audio to avatar:", error);
    }
  }, [concatenateBase64Audio, generateSilence, sessionRef]);

  // Start gap detection - checks if stream ended by detecting pause between chunks
  const startGapDetection = useCallback(() => {
    // Clear any existing interval
    if (gapCheckIntervalRef.current) {
      clearInterval(gapCheckIntervalRef.current);
    }

    // Check every 50ms if there's a gap in chunks
    gapCheckIntervalRef.current = setInterval(() => {
      const timeSinceLastChunk = Date.now() - lastChunkTimeRef.current;

      // If gap exceeds threshold, stream has ended - send buffered audio
      if (
        timeSinceLastChunk >= CHUNK_GAP_THRESHOLD &&
        audioBufferRef.current.length > 0
      ) {
        console.log(
          `[AUDIO] Gap detected (${timeSinceLastChunk}ms) - sending buffered audio`,
        );
        sendAllAudioToAvatar();
      }
    }, 50);
  }, [sendAllAudioToAvatar]);

  // ElevenLabs Agent hook - SIMPLE: accumulate all chunks, send when gap detected
  const {
    isConnected: isAgentConnected,
    isListening,
    isThinking,
    isSpeaking,
    connect: connectAgent,
    disconnect: disconnectAgent,
    startListening,
    stopListening,
    error: agentError,
  } = useElevenLabsAgent({
    onAudioData: (audioBase64) => {
      // Ignore chunks while interruption is pending (old audio from previous response)
      if (isInterruptionPendingRef.current) {
        console.log("[AUDIO] Chunk ignored - interruption pending");
        return;
      }

      // Accumulate chunk
      totalChunksReceivedRef.current++;
      audioBufferRef.current.push(audioBase64);
      lastChunkTimeRef.current = Date.now();

      console.log(
        `[AUDIO] Chunk #${totalChunksReceivedRef.current} buffered (${audioBufferRef.current.length} total)`,
      );

      // Start gap detection if not already running
      if (!gapCheckIntervalRef.current) {
        startGapDetection();
      }
    },
    onAgentResponseEnd: () => {
      // Agent finished speaking - send immediately (faster than timeout)
      console.log("[AUDIO] agent_response_end received, sending all audio now");
      sendAllAudioToAvatar();
    },
    onAgentResponse: () => {
      // Agent is responding - if interruption was pending, unblock now
      // This handles cases where ElevenLabs doesn't send 'interruption' event
      if (isInterruptionPendingRef.current) {
        console.log(
          "[AUDIO] agent_response received while blocked - unblocking",
        );
        isInterruptionPendingRef.current = false;
      }
    },
    onInterruption: () => {
      // ElevenLabs confirmed interruption - unblock new chunks
      console.log("[AUDIO] Interruption confirmed by ElevenLabs - unblocking");
      isInterruptionPendingRef.current = false;

      // Clear any remaining buffer (should already be empty)
      if (gapCheckIntervalRef.current) {
        clearInterval(gapCheckIntervalRef.current);
        gapCheckIntervalRef.current = null;
      }
      audioBufferRef.current = [];
      totalChunksReceivedRef.current = 0;
    },
    onUserTranscript: (text) => {
      console.log("[AUDIO] User said:", text);

      // Filter out noise/empty transcripts
      const cleanText = text?.trim().replace(/\./g, "").trim() || "";
      if (cleanText.length < 2) {
        console.log("[AUDIO] Ignoring noise/empty transcript");
        return;
      }

      // BLOCK old chunks immediately - don't wait for ElevenLabs confirmation
      isInterruptionPendingRef.current = true;
      // Flag to add leading silence on next response (only if there was audio playing)
      if (audioBufferRef.current.length > 0 || isSpeaking) {
        isAfterInterruptRef.current = true;
      }

      // Clear buffer and stop gap detection
      if (gapCheckIntervalRef.current) {
        clearInterval(gapCheckIntervalRef.current);
        gapCheckIntervalRef.current = null;
      }
      audioBufferRef.current = [];
      totalChunksReceivedRef.current = 0;

      // Interrupt avatar immediately
      console.log("[AUDIO] Blocking old chunks, interrupting avatar");
      if (sessionRef.current) {
        try {
          sessionRef.current.interrupt();
        } catch {
          // Ignore interrupt errors
        }
      }
    },
    onError: (error) => {
      console.error("Agent error:", error);
    },
  });

  // Attach video element when stream is ready
  useEffect(() => {
    if (isStreamReady && videoRef.current) {
      attachElement(videoRef.current);
    }
  }, [isStreamReady, attachElement]);

  // Connect to ElevenLabs agent when avatar stream is ready
  useEffect(() => {
    // Use ref flag to ensure we only connect once
    if (isStreamReady && !hasConnectedAgentRef.current) {
      hasConnectedAgentRef.current = true;
      console.log("Connecting to ElevenLabs agent...");
      connectAgent();
    }
  }, [isStreamReady, connectAgent]);

  // Cleanup on unmount - empty deps to run only once on true unmount
  useEffect(() => {
    return () => {
      disconnectAgent();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session limit timer - only runs if SESSION_LIMIT_ENABLED is true
  useEffect(() => {
    if (!SESSION_LIMIT_ENABLED) return;

    sessionTimerRef.current = setInterval(() => {
      setSessionSecondsRemaining((prev) => {
        const newValue = prev - 1;

        // Show warning when approaching limit
        if (newValue <= SESSION_WARNING_SECONDS && newValue > 0) {
          setShowExpiryWarning(true);
        }

        return newValue <= 0 ? 0 : newValue;
      });
    }, 1000);

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, []);

  // Handle session expiry - separate effect to avoid setState during render
  useEffect(() => {
    if (SESSION_LIMIT_ENABLED && sessionSecondsRemaining <= 0) {
      console.log("[SESSION] Time limit reached, ending session");
      onEndCall();
    }
  }, [sessionSecondsRemaining, onEndCall]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      startListening();
      setIsMuted(false);
    } else {
      stopListening();
      setIsMuted(true);
    }
  }, [isMuted, startListening, stopListening]);

  const containerStyle =
    fixedHeight && isInIframe
      ? { height: `${fixedHeight}px`, overflow: "hidden" as const }
      : {};

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center relative safe-area-all w-full"
      style={containerStyle}
    >
      {/* Session expiry warning */}
      {showExpiryWarning && (
        <SessionExpiryWarning secondsRemaining={sessionSecondsRemaining} />
      )}

      {/* Error display */}
      {agentError && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
          {agentError}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center relative p-4 md:p-6 w-full">
        {/* Avatar container */}
        <div
          className={`
          relative h-full
          ${
            isDesktop
              ? "max-w-4xl w-full aspect-video"
              : "max-w-sm w-full aspect-[9/16] md:aspect-[3/4]"
          }
        `}
        >
          {/* Status indicator */}
          <StatusIndicator
            isConnected={isStreamReady && isAgentConnected}
            isListening={isListening}
            isThinking={isThinking}
            isSpeaking={isSpeaking}
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
                isActive={isAgentConnected}
                onToggleMute={handleToggleMute}
              />

              {/* End call button */}
              <Button
                onClick={onEndCall}
                variant="destructive"
                size="lg"
                className="flex items-center gap-2 flex-1 max-w-xs justify-center floating-glass bg-red-500/90 hover:bg-red-500 border border-red-400/30"
              >
                <PhoneOff className="w-5 h-5" />
                <span>Finalizar</span>
              </Button>

              {/* Spacer for symmetry */}
              {isAgentConnected && <div className="w-11" />}
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
export interface ClaraVoiceAgentProps {
  userName?: string | null;
  customerData?: CustomerData | null;
}

export const ClaraVoiceAgent: React.FC<ClaraVoiceAgentProps> = ({
  userName = null,
  customerData = null,
}) => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSafariBanner, setShowSafariBanner] = useState(() => isSafariIOS());
  const { fixedHeight, isInIframe } = useFixedHeight();
  const { isDesktop } = useScreenSize();

  const handleStartCall = useCallback(async () => {
    setIsStarting(true);
    setError(null);

    try {
      // Use CUSTOM mode for Voice Agent (we handle STT/LLM/TTS via ElevenLabs)
      const res = await fetch("/api/start-custom-session", {
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
      className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-slate-50"
      style={containerStyle}
    >
      {/* Safari iOS warning banner (non-blocking) */}
      {showSafariBanner && (
        <SafariBanner onClose={() => setShowSafariBanner(false)} />
      )}

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

export default ClaraVoiceAgent;
