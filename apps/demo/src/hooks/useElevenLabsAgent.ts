import { useState, useCallback, useRef, useEffect } from "react";

export interface ElevenLabsAgentState {
  isConnected: boolean;
  isConnecting: boolean;
  isListening: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  error: string | null;
  transcript: string | null;
  agentResponse: string | null;
}

// Latency metrics for performance monitoring
export interface LatencyMetrics {
  // Timestamps (ms since epoch)
  userSpeechEndTime: number; // When user_transcript received
  agentResponseTime: number; // When agent_response received
  firstAudioChunkTime: number; // When first TTS audio chunk received
  audioSentTime: number; // When audio sent to HeyGen (set externally)
  avatarSpeakStartTime: number; // When avatar starts speaking (set externally)

  // Calculated latencies (ms)
  sttLatency: number; // Time for speech-to-text (estimated)
  llmLatency: number; // agentResponseTime - userSpeechEndTime
  ttsFirstChunkLatency: number; // firstAudioChunkTime - agentResponseTime
  processingLatency: number; // audioSentTime - firstAudioChunkTime
  heygenLatency: number; // avatarSpeakStartTime - audioSentTime
  totalE2ELatency: number; // avatarSpeakStartTime - userSpeechEndTime
}

// Customer data for personalization
export interface CustomerDataForAgent {
  firstName?: string;
  lastName?: string;
  email?: string;
  skinType?: string;
  skinConcerns?: string[];
  ordersCount?: number;
}

export interface UseElevenLabsAgentConfig {
  onAudioData?: (audioBase64: string, sampleRate: number) => void; // Raw audio + sample rate (no resampling in hook)
  onAgentResponse?: (text: string) => void;
  onAgentResponseEnd?: () => void; // Called when agent finishes speaking (all audio sent)
  onInterruption?: () => void; // Called when user interrupts the agent
  onUserTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  onLatencyMetrics?: (metrics: Partial<LatencyMetrics>) => void; // Called with latency data for analytics
  customerData?: CustomerDataForAgent; // Customer data for ElevenLabs dynamic variables
}

export interface UseElevenLabsAgentReturn extends ElevenLabsAgentState {
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => void;
  stopListening: () => void;
  // Latency tracking methods
  reportAudioSent: () => void; // Call when audio is sent to HeyGen
  reportAvatarStarted: () => void; // Call when avatar starts speaking
  getLatencyMetrics: () => Partial<LatencyMetrics>;
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

// Convert Float32Array to Int16Array (PCM 16-bit)
function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]!));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

// NOTE: Resampling functions removed - resampling now happens ONCE in ClaraVoiceAgent
// after concatenating all chunks (eliminates chunk boundary discontinuities)

// Helper to send JSON messages to WebSocket
function sendMessage(ws: WebSocket, message: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Get ElevenLabs input format string based on sample rate
function getInputAudioFormat(sampleRate: number): string {
  // ElevenLabs supports: pcm_8000, pcm_16000, pcm_22050, pcm_24000, pcm_44100, pcm_48000
  const supportedRates = [8000, 16000, 22050, 24000, 44100, 48000];
  // Find closest supported rate
  const closest = supportedRates.reduce((prev, curr) =>
    Math.abs(curr - sampleRate) < Math.abs(prev - sampleRate) ? curr : prev,
  );
  return `pcm_${closest}`;
}

export const useElevenLabsAgent = (
  config: UseElevenLabsAgentConfig = {},
): UseElevenLabsAgentReturn => {
  const {
    onAudioData,
    onAgentResponse,
    onAgentResponseEnd,
    onInterruption,
    onUserTranscript,
    onError,
    onLatencyMetrics,
    customerData,
  } = config;

  const [state, setState] = useState<ElevenLabsAgentState>({
    isConnected: false,
    isConnecting: false,
    isListening: false,
    isThinking: false,
    isSpeaking: false,
    error: null,
    transcript: null,
    agentResponse: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<string[]>([]);

  // Connection flags as refs to prevent callback recreation
  const isConnectingRef = useRef(false);
  const isConnectedRef = useRef(false);

  // Track the sample rate from ElevenLabs (received in conversation_initiation_metadata)
  const elevenLabsSampleRateRef = useRef<number>(16000); // Default to 16kHz

  // Track microphone sample rate for sending audio at native rate (no resample needed)
  const micSampleRateRef = useRef<number>(48000);

  // Reconnection state
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 3;
  const shouldReconnectRef = useRef<boolean>(true);

  // Latency tracking refs
  const latencyRef = useRef<Partial<LatencyMetrics>>({});
  const isFirstAudioChunkRef = useRef<boolean>(true);
  const responseIdRef = useRef<number>(0); // Track response cycles

  // Cleanup function
  const cleanup = useCallback(() => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current.port.close();
      audioWorkletNodeRef.current = null;
    }

    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Reset connection refs
    isConnectingRef.current = false;
    isConnectedRef.current = false;

    setState({
      isConnected: false,
      isConnecting: false,
      isListening: false,
      isThinking: false,
      isSpeaking: false,
      error: null,
      transcript: null,
      agentResponse: null,
    });
  }, []);

  // Connect to ElevenLabs Conversational AI
  const connect = useCallback(async () => {
    // Prevent multiple connection attempts - use REFS for immediate check
    if (isConnectingRef.current || isConnectedRef.current) {
      console.log(
        "useElevenLabsAgent: Already connecting or connected, skipping",
      );
      return;
    }

    // Set ref immediately to prevent race conditions
    isConnectingRef.current = true;
    // Enable auto-reconnect when connecting
    shouldReconnectRef.current = true;

    console.log("useElevenLabsAgent: connect() called");
    try {
      cleanup();

      setState((prev) => ({ ...prev, error: null, isConnecting: true }));

      console.log("useElevenLabsAgent: Fetching signed URL...");
      // Get signed URL from backend
      const res = await fetch("/api/elevenlabs-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      console.log("useElevenLabsAgent: Fetch response status:", res.status);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to get signed URL");
      }

      const { signedUrl } = await res.json();

      // Connect WebSocket
      const ws = new WebSocket(signedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("ElevenLabs WebSocket connected");
        // Update refs immediately
        isConnectedRef.current = true;
        isConnectingRef.current = false;
        // Reset reconnect attempts on successful connection
        reconnectAttemptsRef.current = 0;

        setState((prev) => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
        }));

        // Start microphone capture first to get actual sample rate
        startMicrophoneCapture();
      };

      ws.onmessage = (event) => {
        handleWebSocketMessage(event);
      };

      ws.onerror = (error) => {
        console.error("ElevenLabs WebSocket error:", error);
        // Reset refs on error
        isConnectingRef.current = false;
        setState((prev) => ({
          ...prev,
          error: "WebSocket connection error",
        }));
        onError?.("WebSocket connection error");
      };

      ws.onclose = (event) => {
        console.log("ElevenLabs WebSocket closed:", event.code, event.reason);
        console.log("WebSocket close event details:", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        // Reset refs on close
        isConnectedRef.current = false;
        isConnectingRef.current = false;
        setState((prev) => ({ ...prev, isConnected: false }));

        // Auto-reconnect on abnormal closure (1005, 1006)
        if (
          (event.code === 1005 || event.code === 1006) &&
          shouldReconnectRef.current
        ) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * reconnectAttemptsRef.current, 5000);
            console.log(
              `[WS] Abnormal close (${event.code}), reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
            );
            setTimeout(() => {
              if (shouldReconnectRef.current) {
                connect();
              }
            }, delay);
          } else {
            console.log("[WS] Max reconnect attempts reached");
            onError?.("Connection lost. Please refresh the page.");
          }
        } else if (event.code !== 1000) {
          onError?.(
            `WebSocket closed: ${event.code} - ${event.reason || "Unknown reason"}`,
          );
        }
      };
    } catch (error) {
      // Reset ref on catch
      isConnectingRef.current = false;
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isConnecting: false,
      }));
      onError?.(errorMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup, onError]); // Intentionally omit handleWebSocketMessage and startMicrophoneCapture to prevent callback recreation

  // Handle WebSocket messages from ElevenLabs
  const handleWebSocketMessage = useCallback(
    (event: MessageEvent) => {
      // Binary data = audio (raw PCM from ElevenLabs)
      // NO RESAMPLING HERE - pass raw audio with sample rate to allow single resample after concatenation
      // This eliminates discontinuities that occurred when resampling per-chunk
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((buffer) => {
          const base64Audio = arrayBufferToBase64(buffer);
          audioChunksRef.current.push(base64Audio);
          onAudioData?.(base64Audio, elevenLabsSampleRateRef.current);
        });
        return;
      }

      // Text data = JSON events
      try {
        const data = JSON.parse(event.data);
        console.log("ElevenLabs event:", data.type, data);

        switch (data.type) {
          case "conversation_initiation_metadata": {
            // Conversation started - extract audio configuration
            console.log("Conversation initialized:", data);
            // Extract sample rate from metadata if available
            const audioConfig =
              data.conversation_initiation_metadata_event
                ?.agent_output_audio_format;
            if (audioConfig) {
              // Parse format like "pcm_16000" or "pcm_24000"
              const match = audioConfig.match(/pcm_(\d+)/);
              if (match) {
                elevenLabsSampleRateRef.current = parseInt(match[1], 10);
                console.log(
                  "ElevenLabs audio sample rate:",
                  elevenLabsSampleRateRef.current,
                );
              }
            }
            setState((prev) => ({ ...prev, isListening: true }));
            break;
          }

          case "user_transcript": {
            // User speech transcribed - LATENCY TRACKING: Start of new response cycle
            const userTranscriptTime = Date.now();
            responseIdRef.current++;
            const currentResponseId = responseIdRef.current;

            // Reset latency tracking for new response cycle
            latencyRef.current = {
              userSpeechEndTime: userTranscriptTime,
            };
            isFirstAudioChunkRef.current = true;

            const transcriptText =
              data.user_transcription_event?.user_transcript ||
              data.user_transcript;

            console.log(
              `[LATENCY] #${currentResponseId} User transcript received at ${userTranscriptTime}`,
            );
            console.log(`[AUDIO] User said: ${transcriptText}`);

            setState((prev) => ({
              ...prev,
              transcript: transcriptText,
              isThinking: true,
            }));
            onUserTranscript?.(transcriptText);
            break;
          }

          case "agent_response": {
            // Agent text response - LATENCY TRACKING: LLM response received
            const agentResponseTime = Date.now();
            latencyRef.current.agentResponseTime = agentResponseTime;

            // Calculate LLM latency
            const llmLatency = latencyRef.current.userSpeechEndTime
              ? agentResponseTime - latencyRef.current.userSpeechEndTime
              : 0;
            latencyRef.current.llmLatency = llmLatency;

            const responseText =
              data.agent_response_event?.agent_response || data.agent_response;

            console.log(
              `[LATENCY] #${responseIdRef.current} Agent response: LLM_LATENCY=${llmLatency}ms`,
            );

            setState((prev) => ({
              ...prev,
              agentResponse: responseText,
              isThinking: false,
              isSpeaking: true,
            }));
            onAgentResponse?.(responseText);
            break;
          }

          case "audio": {
            // Audio chunk (some implementations send base64 in JSON instead of binary)
            // NO RESAMPLING HERE - pass raw audio with sample rate to allow single resample after concatenation
            if (data.audio_event?.audio_base_64) {
              const base64Audio = data.audio_event.audio_base_64;

              // LATENCY TRACKING: Track first audio chunk (TTS started)
              if (isFirstAudioChunkRef.current) {
                const firstAudioTime = Date.now();
                latencyRef.current.firstAudioChunkTime = firstAudioTime;
                isFirstAudioChunkRef.current = false;

                // Calculate TTS first chunk latency
                const ttsLatency = latencyRef.current.agentResponseTime
                  ? firstAudioTime - latencyRef.current.agentResponseTime
                  : 0;
                latencyRef.current.ttsFirstChunkLatency = ttsLatency;

                console.log(
                  `[LATENCY] #${responseIdRef.current} First TTS chunk: TTS_LATENCY=${ttsLatency}ms`,
                );
              }

              audioChunksRef.current.push(base64Audio);
              onAudioData?.(base64Audio, elevenLabsSampleRateRef.current);
            }
            // Don't change state here - let agent_response handle isSpeaking
            break;
          }

          case "agent_response_correction":
            // Agent corrected their response
            setState((prev) => ({
              ...prev,
              agentResponse:
                data.agent_response_correction_event
                  ?.corrected_agent_response || prev.agentResponse,
            }));
            break;

          case "interruption":
            // User interrupted agent - clear old audio and notify
            console.log("[ElevenLabs] Interruption - clearing old audio");
            setState((prev) => ({
              ...prev,
              isSpeaking: false,
              isThinking: false,
              isListening: true,
            }));
            audioChunksRef.current = [];
            onInterruption?.();
            break;

          case "ping":
            // Respond to ping with the delay ElevenLabs requests (for timing sync)
            // Note: ping_ms is NOT network latency - it's the delay to wait before pong
            if (wsRef.current) {
              const pingDelay = data.ping_event?.ping_ms || 0;
              const eventId = data.ping_event?.event_id || data.event_id;

              setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  sendMessage(wsRef.current, {
                    type: "pong",
                    event_id: eventId,
                  });
                }
              }, pingDelay);
            }
            break;

          case "agent_response_end":
            // Agent finished speaking - go back to listening
            console.log("[ElevenLabs] agent_response_end - all audio sent");
            setState((prev) => ({
              ...prev,
              isSpeaking: false,
              isListening: true,
            }));
            onAgentResponseEnd?.();
            break;

          case "internal_tentative_agent_response":
            // Internal event - ignore to prevent state toggling
            console.log(
              "Ignoring internal_tentative_agent_response to prevent state toggling",
            );
            break;

          default:
            console.log("Unknown ElevenLabs event:", data.type);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    },
    [
      onAudioData,
      onAgentResponse,
      onAgentResponseEnd,
      onInterruption,
      onUserTranscript,
    ],
  );

  // Start microphone capture using AudioWorkletNode (modern replacement for deprecated ScriptProcessorNode)
  const startMicrophoneCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioStreamRef.current = stream;

      // Create AudioContext WITHOUT specifying sampleRate to get native system rate
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Get the actual sample rate (typically 44100 or 48000)
      const actualSampleRate = audioContext.sampleRate;
      micSampleRateRef.current = actualSampleRate;
      console.log("Microphone actual sample rate:", actualSampleRate);

      // Send conversation initiation with correct audio format and dynamic variables
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const inputFormat = getInputAudioFormat(actualSampleRate);
        console.log(
          `[MIC] Configuring ElevenLabs with input format: ${inputFormat}`,
        );

        // Build dynamic variables - user_name is REQUIRED by ElevenLabs agent
        // Use customerData if available, otherwise default values
        const dynamicVariables = {
          user_name: customerData?.firstName || "amigo",
          skin_type: customerData?.skinType || "desconocido",
          skin_concerns: customerData?.skinConcerns?.join(", ") || "",
          total_purchases: String(customerData?.ordersCount || 0),
        };

        console.log(
          "[ElevenLabs] Sending dynamic_variables:",
          dynamicVariables,
        );

        sendMessage(wsRef.current, {
          type: "conversation_initiation_client_data",
          dynamic_variables: dynamicVariables,
          conversation_config_override: {
            agent: {
              asr: {
                user_input_audio_format: inputFormat,
              },
            },
          },
        });
      }

      // Try to use AudioWorkletNode (modern API), fallback to ScriptProcessorNode if not supported
      let useWorklet = true;
      try {
        await audioContext.audioWorklet.addModule(
          "/audio-worklet-processor.js",
        );
      } catch (workletError) {
        console.warn(
          "AudioWorklet not supported, falling back to ScriptProcessorNode:",
          workletError,
        );
        useWorklet = false;
      }

      const source = audioContext.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      if (useWorklet) {
        // Modern AudioWorkletNode approach
        const workletNode = new AudioWorkletNode(audioContext, "mic-processor");
        audioWorkletNodeRef.current = workletNode;

        let audioChunkCount = 0;
        workletNode.port.onmessage = (event) => {
          if (
            event.data.type === "audio" &&
            wsRef.current?.readyState === WebSocket.OPEN
          ) {
            const float32Data = event.data.buffer as Float32Array;

            // Convert Float32 to Int16 (PCM 16-bit)
            const pcmData = float32ToInt16(float32Data);

            // NO RESAMPLE - send at native rate, ElevenLabs configured to accept it
            const base64Audio = arrayBufferToBase64(pcmData.buffer);

            // Log every 100th chunk to avoid spam (doubled since we halved chunk size)
            audioChunkCount++;
            if (audioChunkCount % 100 === 1) {
              console.log(
                `[MIC-Worklet] Sending chunk #${audioChunkCount}, samples: ${pcmData.length}, rate: ${actualSampleRate}Hz`,
              );
            }

            // Send to ElevenLabs as JSON with base64
            sendMessage(wsRef.current, {
              user_audio_chunk: base64Audio,
            });
          }
        };

        source.connect(workletNode);
        // AudioWorkletNode doesn't need to connect to destination for input processing
        console.log(
          `[MIC] AudioWorkletNode started: ${actualSampleRate}Hz (no resample)`,
        );
      } else {
        // Fallback: ScriptProcessorNode (deprecated but widely supported)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const processor = (audioContext as any).createScriptProcessor(
          2048,
          1,
          1,
        );

        let audioChunkCount = 0;
        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);

            // Convert Float32 to Int16 (PCM 16-bit)
            const pcmData = float32ToInt16(inputData);

            // NO RESAMPLE - send at native rate
            const base64Audio = arrayBufferToBase64(pcmData.buffer);

            // Log every 100th chunk to avoid spam
            audioChunkCount++;
            if (audioChunkCount % 100 === 1) {
              console.log(
                `[MIC-ScriptProcessor] Sending chunk #${audioChunkCount}, samples: ${pcmData.length}, rate: ${actualSampleRate}Hz`,
              );
            }

            // Send to ElevenLabs as JSON with base64
            sendMessage(wsRef.current, {
              user_audio_chunk: base64Audio,
            });
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        // Store reference for cleanup (cast to any since we're using legacy API)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (audioWorkletNodeRef as any).current = processor;
        console.log(
          `[MIC] ScriptProcessorNode started: ${actualSampleRate}Hz (no resample, legacy fallback)`,
        );
      }

      setState((prev) => ({ ...prev, isListening: true }));
    } catch (error) {
      console.error("Failed to start microphone:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Microphone access denied";
      setState((prev) => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [onError, customerData]);

  // Disconnect from ElevenLabs
  const disconnect = useCallback(() => {
    // Disable auto-reconnect when user explicitly disconnects
    shouldReconnectRef.current = false;
    cleanup();
  }, [cleanup]);

  // Manual start/stop listening (for mute functionality)
  const startListening = useCallback(() => {
    // Resume audio context if suspended
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
      setState((prev) => ({ ...prev, isListening: true }));
    } else if (
      !audioContextRef.current &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      startMicrophoneCapture();
    }
  }, [startMicrophoneCapture]);

  const stopListening = useCallback(() => {
    // Suspend audio context to stop sending audio
    if (audioContextRef.current?.state === "running") {
      audioContextRef.current.suspend();
      setState((prev) => ({ ...prev, isListening: false }));
    }
  }, []);

  // Latency tracking: Called when audio is sent to HeyGen
  const reportAudioSent = useCallback(() => {
    const audioSentTime = Date.now();
    latencyRef.current.audioSentTime = audioSentTime;

    // Calculate processing latency (buffering + resampling)
    const processingLatency = latencyRef.current.firstAudioChunkTime
      ? audioSentTime - latencyRef.current.firstAudioChunkTime
      : 0;
    latencyRef.current.processingLatency = processingLatency;

    console.log(
      `[LATENCY] #${responseIdRef.current} Audio sent to HeyGen: PROCESSING_LATENCY=${processingLatency}ms`,
    );
  }, []);

  // Latency tracking: Called when avatar starts speaking
  const reportAvatarStarted = useCallback(() => {
    const avatarStartTime = Date.now();
    latencyRef.current.avatarSpeakStartTime = avatarStartTime;

    // Calculate HeyGen latency
    const heygenLatency = latencyRef.current.audioSentTime
      ? avatarStartTime - latencyRef.current.audioSentTime
      : 0;
    latencyRef.current.heygenLatency = heygenLatency;

    // Calculate total E2E latency
    const totalE2E = latencyRef.current.userSpeechEndTime
      ? avatarStartTime - latencyRef.current.userSpeechEndTime
      : 0;
    latencyRef.current.totalE2ELatency = totalE2E;

    console.log(
      `[LATENCY] #${responseIdRef.current} Avatar speaking: HEYGEN_LATENCY=${heygenLatency}ms | TOTAL_E2E=${totalE2E}ms`,
    );

    // Report complete metrics
    const metrics = { ...latencyRef.current };
    console.log(`[LATENCY] #${responseIdRef.current} Complete metrics:`, {
      llm: `${metrics.llmLatency}ms`,
      tts: `${metrics.ttsFirstChunkLatency}ms`,
      processing: `${metrics.processingLatency}ms`,
      heygen: `${metrics.heygenLatency}ms`,
      total: `${metrics.totalE2ELatency}ms`,
    });

    onLatencyMetrics?.(metrics);
  }, [onLatencyMetrics]);

  // Get current latency metrics
  const getLatencyMetrics = useCallback(() => {
    return { ...latencyRef.current };
  }, []);

  // Cleanup on unmount - use empty deps and ref to avoid StrictMode issues
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  useEffect(() => {
    // Track if this is a real unmount vs StrictMode re-render
    let isRealUnmount = false;

    // Small delay to differentiate StrictMode unmount from real unmount
    const timeoutId = setTimeout(() => {
      isRealUnmount = true;
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      // Only cleanup if it's a real unmount (timeout fired) or if we're connected
      if (isRealUnmount || isConnectedRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    startListening,
    stopListening,
    // Latency tracking
    reportAudioSent,
    reportAvatarStarted,
    getLatencyMetrics,
  };
};
