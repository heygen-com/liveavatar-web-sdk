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
  Check,
  AlertTriangle,
} from "lucide-react";

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
// SAFARI iOS FALLBACK SCREEN (shadcn/ui redesign)
// ============================================
const SafariFallbackScreen: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 landing-gradient min-h-screen">
    <Card className="max-w-sm w-full glass-morphism border-0 shadow-2xl">
      <CardHeader className="text-center pb-2">
        <Avatar className="w-20 h-20 mx-auto mb-4 ring-4 ring-white/50 shadow-xl">
          <AvatarImage src="/clara-avatar.png" alt="Clara" />
          <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-2xl font-bold">
            C
          </AvatarFallback>
        </Avatar>

        <Badge
          variant="secondary"
          className="mx-auto mb-3 bg-amber-100 text-amber-700 hover:bg-amber-100"
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          Compatibilidad limitada
        </Badge>

        <CardTitle className="text-xl text-slate-800">
          Clara funciona mejor en otros navegadores
        </CardTitle>
        <CardDescription className="text-sm mt-2">
          Safari en iPhone tiene limitaciones técnicas temporales. Para la mejor
          experiencia:
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3 p-3 bg-white/80 rounded-lg border border-slate-200">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
            <div className="text-left flex-1">
              <p className="font-medium text-slate-800 text-sm">
                Chrome en Android
              </p>
              <p className="text-xs text-slate-500">Experiencia completa</p>
            </div>
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-3 p-3 bg-white/80 rounded-lg border border-slate-200">
            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-slate-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" />
              </svg>
            </div>
            <div className="text-left flex-1">
              <p className="font-medium text-slate-800 text-sm">Desktop</p>
              <p className="text-xs text-slate-500">
                Chrome, Safari, Firefox, Edge
              </p>
            </div>
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
          </div>
        </div>
        <p className="text-xs text-slate-400 text-center">
          Estamos trabajando para habilitar Safari iOS pronto.
        </p>
      </CardContent>
    </Card>
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
    <div className="flex-1 flex flex-col items-center justify-center p-6 landing-gradient min-h-screen">
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
    <div className="flex-1 flex flex-col items-center justify-center p-6 landing-gradient min-h-screen">
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

  const { sessionRef } = useLiveAvatarContext();
  const { isStreamReady, connectionQuality, attachElement } = useSession();

  // Flag to prevent multiple agent connection attempts
  const hasConnectedAgentRef = useRef(false);

  // Simple audio buffer - accumulate ALL chunks and send together at the end
  const audioBufferRef = useRef<string[]>([]);
  const totalChunksReceivedRef = useRef(0);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Send ALL accumulated audio to avatar (called when agent finishes speaking or timeout)
  const sendAllAudioToAvatar = useCallback(() => {
    // Clear any pending timer
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (audioBufferRef.current.length === 0) {
      console.log("[AUDIO] No audio to send");
      return;
    }

    const chunks = audioBufferRef.current;
    audioBufferRef.current = [];

    // Concatenate all chunks into one
    const concatenatedAudio = concatenateBase64Audio(chunks);
    if (!concatenatedAudio || !sessionRef.current) return;

    const sizeKB = Math.round(concatenatedAudio.length / 1024);
    console.log(
      `[AUDIO] Sending complete response: ${chunks.length} chunks, ${sizeKB}KB total`,
    );

    try {
      sessionRef.current.repeatAudio(concatenatedAudio);
    } catch (error) {
      console.error("Error sending audio to avatar:", error);
    }
  }, [concatenateBase64Audio, sessionRef]);

  // Schedule sending audio after a delay (fallback if agent_response_end doesn't arrive)
  // Use shorter timeout but also check buffer size for faster response on long audio
  const scheduleAudioFlush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }

    // If we have a lot of audio already (>400KB), send sooner (200ms)
    // Otherwise wait longer (500ms) to capture more chunks
    const bufferSize = audioBufferRef.current.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );
    const timeout = bufferSize > 400000 ? 200 : 500;

    flushTimerRef.current = setTimeout(() => {
      console.log(`[AUDIO] Timeout (${timeout}ms) - sending buffered audio`);
      sendAllAudioToAvatar();
    }, timeout);
  }, [sendAllAudioToAvatar]);

  // ElevenLabs Agent hook - SIMPLIFIED: accumulate all audio, send at end
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
      // Accumulate chunks and schedule flush (timeout-based)
      totalChunksReceivedRef.current++;
      audioBufferRef.current.push(audioBase64);
      console.log(
        `[AUDIO] Chunk #${totalChunksReceivedRef.current} buffered (${audioBufferRef.current.length} total)`,
      );
      // Reset timer - wait for more chunks or send after timeout
      scheduleAudioFlush();
    },
    onAgentResponseEnd: () => {
      // Agent finished speaking - send immediately (faster than timeout)
      console.log("[AUDIO] agent_response_end received, sending all audio now");
      sendAllAudioToAvatar();
    },
    onInterruption: () => {
      // User interrupted - NOW we clear the buffer (old response audio)
      // This is the right moment because ElevenLabs confirms the interruption
      console.log("[AUDIO] Interruption confirmed - clearing old buffer");
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      audioBufferRef.current = [];
    },
    onUserTranscript: (text) => {
      console.log("[AUDIO] User said:", text);

      // Clear buffer immediately when user speaks - prevents old audio mixing with new response
      // We do this here because onInterruption event from ElevenLabs is unreliable
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      audioBufferRef.current = [];
      totalChunksReceivedRef.current = 0;
      console.log("[AUDIO] Buffer cleared (user started speaking)");

      // Interrupt the avatar if it's currently speaking
      if (sessionRef.current) {
        try {
          sessionRef.current.interrupt();
          console.log("[AUDIO] Interrupted avatar");
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

  // Safari iOS workaround - show fallback screen
  if (isSafariIOS()) {
    return <SafariFallbackScreen />;
  }

  return (
    <div
      className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-slate-50"
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

export default ClaraVoiceAgent;
