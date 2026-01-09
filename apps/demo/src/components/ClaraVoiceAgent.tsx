"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  SessionState,
  ConnectionQuality,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";
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
import { Skeleton } from "./ui/skeleton";
import Image from "next/image";

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

// Debug tools
import { MobileLogger } from "./debug/MobileLogger";

// Toast notifications
import { toast } from "sonner";

// ============================================
// DEVICE DETECTION (runtime, not module-level)
// ============================================
const isMobileDevice = (): boolean => {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};

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
// HYBRID AUDIO STRATEGY CONSTANTS
// ============================================
// These are DESKTOP defaults - mobile overrides happen at runtime in component

// Smart Chunking: Split large audio to avoid HeyGen 1MB limit
const MAX_AUDIO_SIZE_BYTES = 800 * 1024; // 800KB per chunk (~16s audio)
const CHUNK_WAIT_TIMEOUT_MS = 20000; // 20s timeout per chunk

// Ghost chunk protection: Ignore chunks arriving shortly after interrupt
const INTERRUPT_DEBOUNCE_MS = 300; // Ignore chunks for 300ms after interrupt

// Target sample rate for HeyGen
const TARGET_SAMPLE_RATE = 24000;

// ============================================
// DESKTOP vs MOBILE AUDIO CONFIG
// ============================================
// Desktop: Can handle larger buffers, longer gaps, works well with immediate send
// Mobile: Needs smaller buffers, shorter gaps, and careful timing
interface AudioConfig {
  gapThreshold: number; // ms gap to detect end of stream
  maxBufferSamples: number; // Max samples before forced processing
  phase1LeadingSilence: number; // Silence before first audio
  phase1TrailingSilence: number;
  phase2LeadingSilence: number; // Silence before subsequent audio
  phase2TrailingSilence: number;
  immediateFirstChunk: boolean; // Send first chunk without delay?
}

const DESKTOP_CONFIG: AudioConfig = {
  gapThreshold: 250,
  maxBufferSamples: 64000, // 4s @ 16kHz
  phase1LeadingSilence: 30, // Minimal - HeyGen handles it well
  phase1TrailingSilence: 0,
  phase2LeadingSilence: 50,
  phase2TrailingSilence: 150,
  immediateFirstChunk: true, // Works great on desktop
};

const MOBILE_CONFIG: AudioConfig = {
  gapThreshold: 150, // More sensitive for burst delivery
  maxBufferSamples: 24000, // 1.5s @ 16kHz - smaller batches for slow CPU
  phase1LeadingSilence: 100, // More time for HeyGen to wake up on mobile
  phase1TrailingSilence: 0,
  phase2LeadingSilence: 80,
  phase2TrailingSilence: 150,
  immediateFirstChunk: true, // Still send immediately, but with more silence
};

// GREETING FIX: Skip immediate send for greeting to accumulate more audio
// This prevents fragmentation of the greeting message on mobile devices
const GREETING_SKIP_PHASE1 = true;

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
        <Badge className="status-badge glass-morphism-strong bg-red-500/90 text-gray-900 border-red-400/40 hover:bg-red-500 shadow-lg">
          <MicOff className="w-3 h-3 mr-1" />
          <span className="font-medium">Silenciado</span>
        </Badge>
      );
    }

    if (isListening) {
      return (
        <Badge className="status-badge glass-morphism-strong bg-emerald-500/90 text-gray-900 border-emerald-400/40 status-pulse hover:bg-emerald-500 shadow-lg">
          <div className="voice-wave text-gray-900 mr-1">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="font-medium">Escuchando</span>
        </Badge>
      );
    }

    if (isThinking) {
      return (
        <Badge className="status-badge glass-morphism-strong bg-amber-500/90 text-gray-900 border-amber-400/40 hover:bg-amber-500 shadow-lg">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          <span className="font-medium">Pensando</span>
        </Badge>
      );
    }

    if (isSpeaking) {
      return (
        <Badge className="status-badge glass-morphism-strong bg-blue-500/90 text-gray-900 border-blue-400/40 hover:bg-blue-500 shadow-lg">
          <div className="voice-wave text-gray-900 mr-1">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="font-medium">Respondiendo</span>
        </Badge>
      );
    }

    return (
      <Badge className="status-badge badge-ios hover:bg-white/40 shadow-md">
        <div
          className={`connection-dot ${connectionQuality === ConnectionQuality.GOOD ? "good" : connectionQuality === ConnectionQuality.BAD ? "bad" : "unknown"} dot-pulse mr-1`}
        />
        <span className="font-medium text-neutral-700">Conectado</span>
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
      className={`floating-glass rounded-full w-12 h-12 transition-all duration-300 ${
        isMuted
          ? "bg-red-500/90 hover:bg-red-500 text-gray-900 border-red-400/40 shadow-xl"
          : "glass-morphism-dark text-gray-900 border-white/20 shadow-lg"
      }`}
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
  isRateLimited?: boolean;
  rateLimitCountdown?: number;
}

const LandingScreen: React.FC<LandingScreenProps> = ({
  onStartCall,
  isLoading,
  userName,
  customerData,
  isRateLimited = false,
  rateLimitCountdown = 0,
}) => {
  const displayName = customerData?.firstName || userName;

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center p-6 landing-gradient min-h-screen">
      <Card className="max-w-sm w-full card-ios border-0 shadow-2xl relative z-10">
        <CardHeader className="text-center pb-2">
          {/* Clara Avatar */}
          <div className="avatar-ring-ios mx-auto mb-4">
            <div className="h-20 w-20 rounded-full glass-morphism-strong flex items-center justify-center overflow-hidden p-3">
              <Image
                src="/images/clara-logo.png"
                alt="Clara Logo"
                width={80}
                height={80}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Badge */}
          <div className="badge-ios mx-auto mb-3 text-neutral-800">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--platinum-600)" }}
            />
            Clara Skin Care Assistant
          </div>

          <CardTitle className="text-2xl font-bold text-neutral-800">
            {displayName ? `Hola, ${displayName}!` : "Hola!"}
          </CardTitle>
          <CardDescription className="text-base mt-2 text-neutral-600">
            Soy Clara, tu asistente de belleza personal. Estoy aquí para
            ayudarte a encontrar los productos perfectos para ti.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <Button
            onClick={onStartCall}
            disabled={isLoading || isRateLimited}
            size="lg"
            className="btn-ios-primary"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Conectando...
              </>
            ) : isRateLimited ? (
              <>
                <Clock className="w-5 h-5 mr-2" />
                Espera {rateLimitCountdown}s
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
      <Card className="max-w-sm w-full card-ios border-0 shadow-2xl relative z-10">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <Skeleton className="w-20 h-20 rounded-full glass-morphism-subtle" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2
                className="w-8 h-8 animate-spin"
                style={{ color: "var(--platinum-700)" }}
              />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">
            Conectando...
          </h2>
          <p className="text-neutral-600 text-sm font-medium">
            Preparando a Clara
          </p>
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

  // RUNTIME device detection - select appropriate audio config
  const audioConfig = React.useMemo(() => {
    const isMobile = isMobileDevice();
    const config = isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG;
    console.log(
      `[AUDIO] Runtime config: ${isMobile ? "MOBILE" : "DESKTOP"} | ` +
        `Gap=${config.gapThreshold}ms | MaxBuffer=${config.maxBufferSamples} | ` +
        `Phase1=${config.phase1LeadingSilence}ms | Phase2=${config.phase2LeadingSilence}ms`,
    );
    return config;
  }, []);

  // Session limit state
  const [sessionSecondsRemaining, setSessionSecondsRemaining] = useState(
    SESSION_LIMIT_MINUTES * 60,
  );
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { sessionRef, customerData } = useLiveAvatarContext();
  const { isStreamReady, connectionQuality, attachElement } = useSession();

  // Flag to prevent multiple agent connection attempts
  const hasConnectedAgentRef = useRef(false);

  // Audio buffer - accumulate all chunks, send when gap detected
  const audioBufferRef = useRef<string[]>([]);
  const totalChunksReceivedRef = useRef(0);
  const lastChunkTimeRef = useRef<number>(0);
  const gapCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Leading silence flag - add silence after interrupt to give HeyGen time
  const isAfterInterruptRef = useRef(false);

  // TWO-PHASE strategy refs
  const immediateSendTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hassentImmediateRef = useRef(false); // Track if we already sent immediate chunks
  const isFirstAudioRef = useRef(true); // Track if this is the first audio response

  // Ghost chunk debounce - ignore chunks arriving shortly after interruption
  const lastInterruptTimeRef = useRef<number>(0);

  // Track if HeyGen is currently playing audio (for conditional interrupt handling)
  const isSendingAudioRef = useRef(false);

  // Track ElevenLabs source sample rate (for resampling)
  const sourceRateRef = useRef<number>(16000);

  // Latency tracking refs - populated after useElevenLabsAgent is called
  const reportAudioSentRef = useRef<(() => void) | null>(null);
  const reportAvatarStartedRef = useRef<(() => void) | null>(null);

  // Calculate total samples in buffer (for mobile buffer limit check)
  // Used to prevent accumulating too much audio before processing
  const calculateBufferSamples = useCallback((chunks: string[]): number => {
    let totalBytes = 0;
    for (const chunk of chunks) {
      // base64 → bytes: multiply by 0.75
      totalBytes += Math.round(chunk.length * 0.75);
    }
    // PCM 16-bit = 2 bytes per sample
    return Math.floor(totalBytes / 2);
  }, []);

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

  // Resample audio from source rate to target rate using linear interpolation
  // Called ONCE on the entire concatenated audio to eliminate chunk boundary discontinuities
  const resampleAudio = useCallback(
    (
      sourceBuffer: Int16Array,
      sourceRate: number,
      targetRate: number,
    ): Int16Array => {
      if (sourceRate === targetRate) return sourceBuffer;

      const ratio = sourceRate / targetRate;
      const targetLength = Math.round(sourceBuffer.length / ratio);
      const targetBuffer = new Int16Array(targetLength);

      for (let i = 0; i < targetLength; i++) {
        const sourceIndex = i * ratio;
        const indexFloor = Math.floor(sourceIndex);
        const indexCeil = Math.min(indexFloor + 1, sourceBuffer.length - 1);
        const fraction = sourceIndex - indexFloor;

        targetBuffer[i] = Math.round(
          sourceBuffer[indexFloor]! * (1 - fraction) +
            sourceBuffer[indexCeil]! * fraction,
        );
      }

      return targetBuffer;
    },
    [],
  );

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

  // Helper: Wait for avatar to finish current audio segment
  const waitForAvatarSpeakEnded = useCallback(
    (timeoutMs: number = CHUNK_WAIT_TIMEOUT_MS): Promise<void> => {
      return new Promise((resolve) => {
        const session = sessionRef.current;
        if (!session) {
          resolve();
          return;
        }

        const handler = () => {
          session.off(AgentEventsEnum.AVATAR_SPEAK_ENDED, handler);
          clearTimeout(timeout);
          console.log("[AUDIO] avatar.speak_ended received");
          resolve();
        };

        const timeout = setTimeout(() => {
          session.off(AgentEventsEnum.AVATAR_SPEAK_ENDED, handler);
          console.warn(
            `[AUDIO] Timeout (${timeoutMs}ms) waiting for avatar.speak_ended`,
          );
          resolve(); // Continue anyway
        }, timeoutMs);

        session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, handler);
      });
    },
    [sessionRef],
  );

  // Split base64 audio into chunks of maxBytes (in decoded bytes)
  const smartSplitAudio = useCallback(
    (audioBase64: string, maxBytes: number): string[] => {
      // Base64: 4 chars = 3 bytes, so maxChars = maxBytes * 4 / 3
      const maxChars = Math.floor((maxBytes * 4) / 3);
      const chunks: string[] = [];

      for (let i = 0; i < audioBase64.length; i += maxChars) {
        chunks.push(audioBase64.slice(i, i + maxChars));
      }

      return chunks;
    },
    [],
  );

  // Send large audio in sequential chunks (waits for each to finish)
  const sendChunkedAudio = useCallback(
    async (audioBase64: string) => {
      const chunks = smartSplitAudio(audioBase64, MAX_AUDIO_SIZE_BYTES);
      console.log(
        `[AUDIO] Smart chunking: ${chunks.length} segments of ~${Math.round(MAX_AUDIO_SIZE_BYTES / 1024)}KB`,
      );

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const sizeKB = Math.round((chunk.length * 0.75) / 1024);

        console.log(
          `[AUDIO] Sending chunk ${i + 1}/${chunks.length} (${sizeKB}KB)`,
        );

        // Report audio sent for latency tracking (only first chunk)
        if (i === 0) {
          reportAudioSentRef.current?.();
        }

        isSendingAudioRef.current = true;
        sessionRef.current?.repeatAudio(chunk);

        // Wait for this chunk to finish before sending next
        if (i < chunks.length - 1) {
          await waitForAvatarSpeakEnded();
        }
      }

      console.log(
        `[AUDIO] Smart chunking complete: ${chunks.length} chunks sent`,
      );
    },
    [smartSplitAudio, waitForAvatarSpeakEnded, sessionRef],
  );

  // Send ALL accumulated audio to avatar (called when gap detected or agent_response_end)
  // HYBRID: Resamples once after concatenation, adds silence, uses Smart Chunking for large audio
  // isImmediateSend: true for PHASE 1 (first words, minimal silence), false for PHASE 2 (rest of response)
  const sendAllAudioToAvatar = useCallback(
    (isImmediateSend: boolean = false) => {
      // Clear gap check interval
      if (gapCheckIntervalRef.current) {
        clearInterval(gapCheckIntervalRef.current);
        gapCheckIntervalRef.current = null;
      }

      // Clear immediate send timeout (TWO-PHASE cleanup)
      if (immediateSendTimeoutRef.current) {
        clearTimeout(immediateSendTimeoutRef.current);
        immediateSendTimeoutRef.current = null;
      }

      if (audioBufferRef.current.length === 0) {
        console.log("[AUDIO] No audio to send");
        return;
      }

      const chunks = audioBufferRef.current;
      audioBufferRef.current = [];

      // 1. Concatenate all RAW chunks (still at source sample rate, e.g., 16kHz)
      const concatenatedRaw = concatenateBase64Audio(chunks);
      if (!concatenatedRaw || !sessionRef.current) return;

      // 2. Decode base64 → Int16Array (raw PCM)
      const binaryString = atob(concatenatedRaw);
      const rawBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        rawBytes[i] = binaryString.charCodeAt(i);
      }
      const sourceBuffer = new Int16Array(rawBytes.buffer);

      // 3. Resample ONCE from source rate (16kHz) to target rate (24kHz)
      const sourceRate = sourceRateRef.current;
      const resampledBuffer = resampleAudio(
        sourceBuffer,
        sourceRate,
        TARGET_SAMPLE_RATE,
      );

      console.log(
        `[AUDIO] Resampled: ${sourceBuffer.length} samples @ ${sourceRate}Hz → ${resampledBuffer.length} samples @ ${TARGET_SAMPLE_RATE}Hz`,
      );

      // 4. Encode resampled audio back to base64
      let binary = "";
      const resampledBytes = new Uint8Array(resampledBuffer.buffer);
      for (let i = 0; i < resampledBytes.length; i++) {
        binary += String.fromCharCode(resampledBytes[i]!);
      }
      let finalAudio = btoa(binary);

      // 5. Add leading + trailing silence (DIFFERENTIATED BY PHASE)
      // Uses runtime audioConfig for device-specific values
      const leadingSilenceMs = isImmediateSend
        ? audioConfig.phase1LeadingSilence
        : audioConfig.phase2LeadingSilence;
      const trailingSilenceMs = isImmediateSend
        ? audioConfig.phase1TrailingSilence
        : audioConfig.phase2TrailingSilence;

      const leadingSilence = generateSilence(leadingSilenceMs);
      const trailingSilence = generateSilence(trailingSilenceMs);

      // Only add silence if duration > 0
      const audioWithSilence = [finalAudio];
      if (leadingSilenceMs > 0) audioWithSilence.unshift(leadingSilence);
      if (trailingSilenceMs > 0) audioWithSilence.push(trailingSilence);
      finalAudio = concatenateBase64Audio(audioWithSilence);

      // Log with phase info
      const phaseLabel = isImmediateSend ? "PHASE 1 (fast)" : "PHASE 2";
      const interruptNote = isAfterInterruptRef.current
        ? " (post-interrupt)"
        : "";
      console.log(
        `[AUDIO] ${phaseLabel}: ${leadingSilenceMs}ms lead + ${trailingSilenceMs}ms trail${interruptNote}`,
      );

      // Reset interrupt flag
      if (isAfterInterruptRef.current) {
        isAfterInterruptRef.current = false;
      }

      // === SMART CHUNKING: Check size and split if needed ===
      const audioSizeBytes = Math.round(finalAudio.length * 0.75);
      const audioSizeKB = Math.round(audioSizeBytes / 1024);
      const estimatedDurationSec = audioSizeKB / 48; // ~48KB/s @ 24kHz 16-bit

      console.log(
        `[AUDIO] Size: ${audioSizeKB}KB (~${estimatedDurationSec.toFixed(1)}s)`,
      );

      if (audioSizeBytes > MAX_AUDIO_SIZE_BYTES) {
        console.log(
          `[AUDIO] Audio too large (${audioSizeKB}KB > ${Math.round(MAX_AUDIO_SIZE_BYTES / 1024)}KB), using smart chunking`,
        );
        // Send chunked - function handles isSendingAudioRef internally
        sendChunkedAudio(finalAudio);
        return; // Exit - chunked send handles everything
      }

      // === Normal path: audio is small enough for single send ===
      const totalSizeKB = Math.round(finalAudio.length / 1024);
      const isFirstAudio = isFirstAudioRef.current;

      if (isFirstAudio) {
        isFirstAudioRef.current = false;
        console.log(
          `[AUDIO] GREETING SENT: ${chunks.length} chunks, ${totalSizeKB}KB, single repeatAudio() call`,
        );
      } else {
        console.log(
          `[AUDIO] Response sent: ${chunks.length} chunks, ${totalSizeKB}KB`,
        );
      }

      // 6. Send ALL audio in a single call
      console.log(
        `[AUDIO] Sending complete audio (${totalSizeKB}KB) in single call`,
      );
      try {
        // Report audio sent for latency tracking
        reportAudioSentRef.current?.();

        isSendingAudioRef.current = true;
        sessionRef.current.repeatAudio(finalAudio);
      } catch (error) {
        console.error("Error sending audio to avatar:", error);
        isSendingAudioRef.current = false;
      }
    },
    [
      audioConfig,
      concatenateBase64Audio,
      generateSilence,
      resampleAudio,
      sendChunkedAudio,
      sessionRef,
    ],
  );

  // Start gap detection - checks if stream ended by detecting pause between chunks
  const startGapDetection = useCallback(() => {
    // Clear any existing interval
    if (gapCheckIntervalRef.current) {
      clearInterval(gapCheckIntervalRef.current);
    }

    // Check every 50ms if there's a gap in chunks
    // Uses runtime audioConfig.gapThreshold for device-specific timing
    gapCheckIntervalRef.current = setInterval(() => {
      const timeSinceLastChunk = Date.now() - lastChunkTimeRef.current;

      // If gap exceeds threshold, stream has ended - send buffered audio
      if (
        timeSinceLastChunk >= audioConfig.gapThreshold &&
        audioBufferRef.current.length > 0
      ) {
        console.log(
          `[AUDIO] Gap detected (${timeSinceLastChunk}ms >= ${audioConfig.gapThreshold}ms) - sending buffered audio`,
        );
        sendAllAudioToAvatar();
      }
    }, 50);
  }, [sendAllAudioToAvatar, audioConfig.gapThreshold]);

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
    // Latency tracking
    reportAudioSent,
    reportAvatarStarted,
  } = useElevenLabsAgent({
    // Pass customer data for ElevenLabs dynamic variables personalization
    customerData: customerData
      ? {
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          email: customerData.email,
          skinType: customerData.skinType,
          skinConcerns: customerData.skinConcerns,
          ordersCount: customerData.ordersCount,
        }
      : undefined,
    onAudioData: (audioBase64, sampleRate) => {
      // DEBOUNCE: Ignore "ghost" chunks that arrive shortly after interruption
      // These are in-flight chunks from the previous response
      const timeSinceInterrupt = Date.now() - lastInterruptTimeRef.current;
      if (timeSinceInterrupt < INTERRUPT_DEBOUNCE_MS) {
        console.log(
          `[AUDIO] Ignoring ghost chunk (${timeSinceInterrupt}ms since interrupt)`,
        );
        return;
      }

      // Store source sample rate from first chunk (used for resampling after concatenation)
      if (totalChunksReceivedRef.current === 0) {
        sourceRateRef.current = sampleRate;
        console.log(`[AUDIO] Source sample rate: ${sampleRate}Hz`);
      }

      // Accumulate RAW chunks (no resampling) - resampling happens ONCE after concatenation
      totalChunksReceivedRef.current++;
      audioBufferRef.current.push(audioBase64);
      lastChunkTimeRef.current = Date.now();

      const currentBufferLength = audioBufferRef.current.length;
      const currentSamplesForLog = calculateBufferSamples(
        audioBufferRef.current,
      );
      console.log(
        `[AUDIO] Chunk #${totalChunksReceivedRef.current}, buffer: ${currentSamplesForLog} samples (${currentBufferLength} chunks), isGreeting: ${isFirstAudioRef.current}`,
      );

      // TWO-PHASE STRATEGY:
      // Phase 1: Send first chunk IMMEDIATELY (contains first words - reduces perceived latency)
      // This is SYNCHRONOUS - no timeout, no delay, just send NOW
      // GREETING FIX: Skip PHASE 1 for greeting to accumulate more audio
      if (!hassentImmediateRef.current && currentBufferLength === 1) {
        if (isFirstAudioRef.current && GREETING_SKIP_PHASE1) {
          console.log("[AUDIO] GREETING: Skipping PHASE 1 (immediate send)");
          // Don't send yet - continue to gap detection or buffer limit
        } else {
          hassentImmediateRef.current = true;
          console.log(
            `[AUDIO] PHASE 1: IMMEDIATE send first chunk (first words) - NO DELAY`,
          );
          // Send synchronously - first words go out ASAP
          sendAllAudioToAvatar(true); // isImmediateSend = true for minimal silence
          return;
        }
      }

      // MOBILE OPTIMIZATION: Check if buffer exceeds limit
      // Mobile CPUs struggle with large resamples - process in smaller batches
      // Uses runtime audioConfig.maxBufferSamples for device-specific limits
      // GREETING FIX: Skip buffer limit for greeting to accumulate full message
      const currentSamples = calculateBufferSamples(audioBufferRef.current);
      if (currentSamples >= audioConfig.maxBufferSamples) {
        if (isFirstAudioRef.current && GREETING_SKIP_PHASE1) {
          console.log(
            `[AUDIO] GREETING: Skipping buffer limit (${currentSamples}/${audioConfig.maxBufferSamples} samples) - accumulating more`,
          );
          // Continue to gap detection - don't return
        } else {
          console.log(
            `[AUDIO] BUFFER LIMIT: ${currentSamples} samples >= ${audioConfig.maxBufferSamples}, processing NOW`,
          );
          // Clear gap detection since we're processing now
          if (gapCheckIntervalRef.current) {
            clearInterval(gapCheckIntervalRef.current);
            gapCheckIntervalRef.current = null;
          }
          sendAllAudioToAvatar(false); // PHASE 2 style padding
          return;
        }
      }

      // Phase 2: For remaining chunks, use gap detection
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
      console.log("[AUDIO] agent_response received - new response starting");

      // GREETING FIX: Reset interrupt debounce to accept new audio chunks immediately
      // Without this, fast responses (<300ms) get discarded as "ghost chunks"
      lastInterruptTimeRef.current = 0;
      console.log("[AUDIO] Reset interrupt debounce for new response");
    },
    onInterruption: () => {
      // ElevenLabs confirmed user actually interrupted the agent
      console.log("[AUDIO] Interruption confirmed - clearing buffer");

      // Set flag to add leading silence on next response (gives HeyGen time after interrupt)
      isAfterInterruptRef.current = true;

      // Record interrupt time for debounce (ignore ghost chunks)
      lastInterruptTimeRef.current = Date.now();

      // Clear buffer and stop gap detection
      if (gapCheckIntervalRef.current) {
        clearInterval(gapCheckIntervalRef.current);
        gapCheckIntervalRef.current = null;
      }

      // Clear immediate send timeout (TWO-PHASE cleanup)
      if (immediateSendTimeoutRef.current) {
        clearTimeout(immediateSendTimeoutRef.current);
        immediateSendTimeoutRef.current = null;
      }

      audioBufferRef.current = [];
      totalChunksReceivedRef.current = 0;
      hassentImmediateRef.current = false; // Reset for next response
      isSendingAudioRef.current = false; // Reset sending state
    },
    onUserTranscript: (text) => {
      console.log("[AUDIO] User said:", text);

      // Filter out noise/empty transcripts
      const cleanText = text?.trim().replace(/\./g, "").trim() || "";
      if (cleanText.length < 2) {
        console.log("[AUDIO] Ignoring noise/empty transcript");
        return;
      }

      // CONDITIONAL INTERRUPT: Only clear buffer if avatar is CURRENTLY speaking
      // If avatar finished, chunks arriving are from the NEW response - preserve them
      if (isSendingAudioRef.current) {
        console.log("[AUDIO] User interrupted active speech - clearing buffer");

        // Record interrupt time for debounce (ignore ghost chunks)
        lastInterruptTimeRef.current = Date.now();

        // Cancel gap detection
        if (gapCheckIntervalRef.current) {
          clearInterval(gapCheckIntervalRef.current);
          gapCheckIntervalRef.current = null;
        }

        // Clear immediate send timeout
        if (immediateSendTimeoutRef.current) {
          clearTimeout(immediateSendTimeoutRef.current);
          immediateSendTimeoutRef.current = null;
        }

        // Clear audio state
        audioBufferRef.current = [];
        isSendingAudioRef.current = false;
        hassentImmediateRef.current = false;

        // Set flag for leading silence on next response
        isAfterInterruptRef.current = true;

        // Interrupt HeyGen avatar playback
        if (sessionRef.current) {
          try {
            sessionRef.current.interrupt();
          } catch {
            // Ignore interrupt errors
          }
        }
      } else {
        // Avatar already finished - don't clear buffer, don't set debounce
        // Chunks arriving are from the NEW response being generated
        console.log(
          "[AUDIO] User spoke after avatar finished - preserving buffer",
        );

        // CRITICAL FIX: Reset hassentImmediateRef for the NEW conversation turn
        // Without this, PHASE 1 (100ms silence) is skipped and only PHASE 2 (80ms) runs
        // This caused first words to be cut off on subsequent responses
        hassentImmediateRef.current = false;

        // Set the interrupt flag for leading silence on next response
        isAfterInterruptRef.current = true;
      }
    },
    onError: (error) => {
      console.error("Agent error:", error);
    },
  });

  // Populate latency tracking refs (for use in callbacks defined before useElevenLabsAgent)
  useEffect(() => {
    reportAudioSentRef.current = reportAudioSent;
    reportAvatarStartedRef.current = reportAvatarStarted;
  }, [reportAudioSent, reportAvatarStarted]);

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

  // Listen for AVATAR_SPEAK_STARTED to track HeyGen latency
  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    const handleAvatarSpeakStarted = () => {
      console.log("[LATENCY] Avatar started speaking");
      reportAvatarStartedRef.current?.();
    };

    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, handleAvatarSpeakStarted);

    return () => {
      session.off(
        AgentEventsEnum.AVATAR_SPEAK_STARTED,
        handleAvatarSpeakStarted,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for AVATAR_SPEAK_ENDED to reset sending state
  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    const handleAvatarSpeakEnded = () => {
      console.log("[AUDIO] Avatar finished speaking");
      isSendingAudioRef.current = false;
    };

    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, handleAvatarSpeakEnded);

    return () => {
      session.off(AgentEventsEnum.AVATAR_SPEAK_ENDED, handleAvatarSpeakEnded);
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

  // Cleanup on unmount - prevent memory leaks from intervals
  useEffect(() => {
    return () => {
      // Cleanup gap detection interval
      if (gapCheckIntervalRef.current) {
        clearInterval(gapCheckIntervalRef.current);
        gapCheckIntervalRef.current = null;
      }
      // Cleanup immediate send timeout (TWO-PHASE)
      if (immediateSendTimeoutRef.current) {
        clearTimeout(immediateSendTimeoutRef.current);
        immediateSendTimeoutRef.current = null;
      }
      // Cleanup session timer
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      // Clear audio buffer
      audioBufferRef.current = [];
    };
  }, []);

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
                className="flex items-center gap-2 flex-1 max-w-xs justify-center floating-glass glass-morphism-strong bg-red-500/95 hover:bg-red-500 border border-red-400/40 shadow-xl transition-all duration-300 text-gray-900"
              >
                <PhoneOff className="w-5 h-5" />
                <span className="font-medium">Finalizar</span>
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

  // Rate limit state
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const rateLimitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup rate limit timer on unmount
  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) {
        clearInterval(rateLimitTimerRef.current);
        rateLimitTimerRef.current = null;
      }
    };
  }, []);

  // Countdown timer for rate limit
  useEffect(() => {
    if (rateLimitCountdown > 0) {
      setIsRateLimited(true);
      rateLimitTimerRef.current = setInterval(() => {
        setRateLimitCountdown((prev) => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            setIsRateLimited(false);
            if (rateLimitTimerRef.current) {
              clearInterval(rateLimitTimerRef.current);
              rateLimitTimerRef.current = null;
            }
          }
          return newValue <= 0 ? 0 : newValue;
        });
      }, 1000);

      return () => {
        if (rateLimitTimerRef.current) {
          clearInterval(rateLimitTimerRef.current);
          rateLimitTimerRef.current = null;
        }
      };
    }
  }, [rateLimitCountdown]);

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

        // Handle rate limit (429) specifically
        if (res.status === 429) {
          const retryAfter = errorData.retryAfter || 60;
          setRateLimitCountdown(retryAfter);

          // Show toast notification
          toast.error("Límite de sesiones alcanzado", {
            description: `Has iniciado muchas sesiones recientemente. Por favor espera ${retryAfter} segundos antes de intentar nuevamente.`,
            duration: 5000,
          });

          return; // Exit early, don't throw error
        }

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
          isRateLimited={isRateLimited}
          rateLimitCountdown={rateLimitCountdown}
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

      {/* Mobile debug logger - shows [AUDIO] logs on screen */}
      <MobileLogger enabled={isMobileDevice()} filter="[AUDIO]" maxLogs={100} />
    </div>
  );
};

export default ClaraVoiceAgent;
