# Clara Voice Agent - Troubleshooting Guide

## Session Summary (December 2024)

This document captures all the audio integration work, bug fixes, and considerations for the Clara Voice Agent - a real-time voice agent using ElevenLabs Conversational AI with HeyGen LiveAvatar lip-sync.

---

## Architecture Overview

```
User speaks → Microphone (44.1kHz)
      ↓ resample to 16kHz
ElevenLabs WebSocket (STT + LLM + TTS)
      ↓ audio chunks @ 16kHz PCM base64
Audio Buffer (accumulate chunks)
      ↓ resample to 24kHz + add silence padding
HeyGen LiveAvatar (lip-sync video playback)
```

### Key Files

| File                                              | Purpose                             |
| ------------------------------------------------- | ----------------------------------- |
| `apps/demo/src/components/ClaraVoiceAgent.tsx`    | Main component with all audio logic |
| `apps/demo/src/hooks/useElevenLabsAgent.ts`       | ElevenLabs WebSocket hook           |
| `apps/demo/src/components/debug/MobileLogger.tsx` | On-screen mobile debugging          |
| `apps/demo/src/liveavatar/LiveAvatarContext.tsx`  | HeyGen session context              |

---

## TWO-PHASE Audio Strategy

The core innovation to reduce perceived latency while maintaining audio quality.

### Phase 1: Immediate First Chunk

- **When**: First audio chunk arrives from ElevenLabs
- **Action**: Send immediately to HeyGen (no timeout, no delay)
- **Why**: First words are most important for perceived responsiveness
- **Silence**: Uses `phase1LeadingSilence` (100ms mobile, 30ms desktop)

### Phase 2: Gap Detection for Rest

- **When**: Subsequent chunks after Phase 1
- **Action**: Accumulate in buffer, send when gap detected
- **Gap Threshold**: Time since last chunk (150ms mobile, 250ms desktop)
- **Silence**: Uses `phase2LeadingSilence` (80ms mobile, 50ms desktop)

### Buffer Limit Protection

- Mobile CPUs struggle with large audio processing
- When buffer exceeds `maxBufferSamples`, process immediately
- Mobile: 24000 samples (1.5s), Desktop: 64000 samples (4s)

---

## Desktop vs Mobile Configuration

```typescript
// Desktop: More tolerant, larger buffers
const DESKTOP_CONFIG: AudioConfig = {
  gapThreshold: 250, // Longer gap tolerance
  maxBufferSamples: 64000, // 4s buffer ok
  phase1LeadingSilence: 30, // Minimal wake-up time
  phase2LeadingSilence: 50,
  phase2TrailingSilence: 150,
};

// Mobile: Stricter timing, smaller batches
const MOBILE_CONFIG: AudioConfig = {
  gapThreshold: 150, // More sensitive
  maxBufferSamples: 24000, // 1.5s max (CPU protection)
  phase1LeadingSilence: 100, // More HeyGen wake-up time
  phase2LeadingSilence: 80,
  phase2TrailingSilence: 150,
};
```

### Why Different Configs?

| Issue                | Desktop        | Mobile                   |
| -------------------- | -------------- | ------------------------ |
| Audio chunk delivery | Uniform timing | Burst delivery (network) |
| CPU processing       | Fast resample  | Slow, can hang           |
| HeyGen wake-up       | Fast           | Needs more time          |
| Buffer handling      | Large ok       | Must be small            |

---

## Critical Bug Fixes

### Bug #1: `hassentImmediateRef` Not Reset on Natural Turn End

**Symptom**: First words cut off on 2nd, 3rd, etc. responses (but 1st response works)

**Root Cause**:

- `hassentImmediateRef` tracks if PHASE 1 was executed
- Only reset when user **interrupts** active speech
- NOT reset when avatar finishes naturally and user speaks new question

**Evidence in Logs**:

```
// First response - PHASE 1 runs correctly
[AUDIO] PHASE 1: IMMEDIATE send first chunk

// Second response - PHASE 1 skipped! Goes straight to buffer limit
[AUDIO] Chunk #1 buffered (1 total)
[AUDIO] BUFFER LIMIT: 24000 samples >= 24000, processing NOW
```

**Fix** (ClaraVoiceAgent.tsx, line ~1029):

```typescript
onUserTranscript: (text) => {
  // ... validation ...

  if (isSendingAudioRef.current) {
    // User interrupted - full cleanup
    hassentImmediateRef.current = false;
    // ... clear buffers, interrupt avatar ...
  } else {
    // Avatar already finished naturally
    // CRITICAL FIX: Still need to reset for NEW conversation turn!
    hassentImmediateRef.current = false; // <-- This was missing!
    isAfterInterruptRef.current = true;
  }
};
```

### Bug #2: PHASE 1 Timeout Being Skipped on Mobile

**Symptom**: Phase 1 sometimes didn't execute, went straight to Phase 2

**Root Cause**: Original implementation used `setTimeout(sendAllAudioToAvatar, 0)` which could be skipped by subsequent chunk arrivals

**Fix**: Made PHASE 1 synchronous - no setTimeout, direct call:

```typescript
if (!hassentImmediateRef.current && currentBufferLength === 1) {
  hassentImmediateRef.current = true;
  sendAllAudioToAvatar(true); // Synchronous, immediate
  return;
}
```

### Bug #3: Runtime Device Detection During SSR

**Symptom**: Config always defaulted to desktop during server-side render

**Root Cause**: `isMobileDevice()` called at module level where `window` is undefined

**Fix**: Use `useMemo` inside component for runtime detection:

```typescript
const audioConfig = React.useMemo(() => {
  const isMobile = isMobileDevice();
  return isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG;
}, []);
```

---

## Leading Silence: Why It's Needed

HeyGen LiveAvatar needs time to "wake up" and start lip-sync after receiving audio. Without leading silence:

1. Audio plays before avatar mouth moves
2. First syllables are "eaten" (heard but not lip-synced)
3. Perceived as words being cut off

### Silence Values

| Phase            | Mobile | Desktop | Why Different                |
| ---------------- | ------ | ------- | ---------------------------- |
| Phase 1 Leading  | 100ms  | 30ms    | Mobile HeyGen slower to wake |
| Phase 2 Leading  | 80ms   | 50ms    | Already "warm"               |
| Phase 2 Trailing | 150ms  | 150ms   | Clean ending                 |

---

## ElevenLabs WebSocket Integration

### Key Events

| Event                 | When                   | Action                             |
| --------------------- | ---------------------- | ---------------------------------- |
| `onAudioChunk`        | TTS audio arrives      | Buffer chunk, check phases         |
| `onUserTranscript`    | User speech recognized | Maybe interrupt, reset state       |
| `onAgentResponse`     | Agent starts talking   | Mark response start time           |
| `onAgentStopSpeaking` | TTS stream ends        | Cleanup, mark isSendingAudio=false |

### Audio Format from ElevenLabs

- Format: PCM 16-bit signed, mono
- Sample rate: 16kHz (configurable)
- Encoding: Base64 string
- Delivery: Streaming chunks via WebSocket

### Resampling for HeyGen

HeyGen expects 24kHz. Resample using linear interpolation:

```typescript
const resampleAudio = (
  input: Int16Array,
  fromRate: number,
  toRate: number,
): Int16Array => {
  const ratio = fromRate / toRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const fraction = srcIndex - srcIndexFloor;

    const sample1 = input[srcIndexFloor] || 0;
    const sample2 = input[srcIndexFloor + 1] || sample1;
    output[i] = Math.round(sample1 + (sample2 - sample1) * fraction);
  }
  return output;
};
```

---

## HeyGen LiveAvatar Integration

### Key Methods

| Method                        | Purpose                                   |
| ----------------------------- | ----------------------------------------- |
| `session.repeatAudio(base64)` | Send audio for lip-sync playback          |
| `session.interrupt()`         | Stop current playback (on user interrupt) |

### Audio Format for HeyGen

- Format: PCM 16-bit signed, mono
- Sample rate: 24kHz
- Encoding: Base64 string
- Max size: ~1MB per chunk (use chunking for long audio)

### Smart Chunking for Long Responses

```typescript
const MAX_AUDIO_SIZE_BYTES = 800 * 1024; // 800KB per chunk

const sendChunkedAudio = async (fullAudio: string) => {
  const chunkSize = MAX_AUDIO_SIZE_BYTES;
  const chunks = [];

  for (let i = 0; i < fullAudio.length; i += chunkSize) {
    chunks.push(fullAudio.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    await session.repeatAudio(chunk);
    await waitForAvatarReady(); // Wait before next chunk
  }
};
```

---

## Mobile Debugging with MobileLogger

Since Eruda and remote debugging are unreliable on mobile, we created an on-screen logger.

### Usage

```tsx
<MobileLogger
  enabled={isMobileDevice()}
  filter="[AUDIO]" // Empty string = show ALL logs
  maxLogs={100}
/>
```

### Features

- **Copy All**: Copies entire log history to clipboard
- **Clear**: Clears current logs
- **Minimize/Expand**: Toggle compact mode
- **Auto-scroll**: Always shows latest logs
- **Color coding**: Red (error), Yellow (warn), Blue (info), Green (log)

### Log Prefixes

All audio-related logs use `[AUDIO]` prefix for easy filtering:

```
[AUDIO] Runtime config: MOBILE | Gap=150ms | MaxBuffer=24000
[AUDIO] PHASE 1: IMMEDIATE send first chunk
[AUDIO] Gap detected (152ms >= 150ms) - sending buffered audio
```

---

## Common Issues & Solutions

### Issue: First words cut off on first response

**Cause**: Not enough leading silence for HeyGen to wake up
**Solution**: Increase `phase1LeadingSilence` (try 120-150ms on mobile)

### Issue: First words cut off on subsequent responses

**Cause**: `hassentImmediateRef` not reset (see Bug #1 above)
**Solution**: Ensure reset in both interrupt AND natural-end branches

### Issue: Audio choppy/stuttering on mobile

**Cause**: Buffer too large, CPU overloaded during resample
**Solution**: Reduce `maxBufferSamples` (try 16000 = 1s)

### Issue: Long pauses between audio chunks

**Cause**: Gap threshold too high, waiting too long
**Solution**: Reduce `gapThreshold` (try 100-120ms on mobile)

### Issue: Audio plays but avatar doesn't move

**Cause**: Audio sent before HeyGen session fully ready
**Solution**: Check `sessionRef.current` exists before sending

### Issue: Safari iOS doesn't work

**Status**: Not supported - use `SafariFallbackScreen` component
**Detection**: `isSafariIOS()` function

---

## Testing Checklist

Before declaring a fix complete:

- [ ] Test on Chrome Desktop (should work with DESKTOP_CONFIG)
- [ ] Test on Chrome Android (should use MOBILE_CONFIG)
- [ ] Test first response (PHASE 1 should fire)
- [ ] Test second response (PHASE 1 should fire again!)
- [ ] Test interruption mid-response (avatar should stop)
- [ ] Test long response (chunking should work)
- [ ] Check MobileLogger for correct phase logs
- [ ] Verify no words cut off at start of any response

---

## Key Refs in ClaraVoiceAgent

| Ref                    | Purpose                                |
| ---------------------- | -------------------------------------- |
| `audioBufferRef`       | Accumulates base64 audio chunks        |
| `hassentImmediateRef`  | Tracks if PHASE 1 executed this turn   |
| `isSendingAudioRef`    | True while avatar is speaking          |
| `lastChunkTimeRef`     | Timestamp of last received chunk       |
| `gapCheckIntervalRef`  | Interval ID for gap detection          |
| `lastInterruptTimeRef` | For ghost chunk debounce               |
| `isAfterInterruptRef`  | Flag for extra silence after interrupt |

---

## Version History

| Date         | Change                                       |
| ------------ | -------------------------------------------- |
| Dec 30, 2024 | TWO-PHASE strategy implemented               |
| Dec 30, 2024 | Desktop vs Mobile configs added              |
| Dec 30, 2024 | MobileLogger component created               |
| Dec 31, 2024 | Fixed `hassentImmediateRef` reset bug        |
| Dec 31, 2024 | MobileLogger: removed filter, added Copy All |

---

## CRITICAL BUG: Multiple repeatAudio() Calls (January 2026)

### Status: DOCUMENTED - FIX PENDING

### The Problem

The current code in `develop` has a bug when handling large audio responses (>800KB):

```typescript
// ClaraVoiceAgent.tsx lines 778-784
if (audioSizeBytes > MAX_AUDIO_SIZE_BYTES) {
  sendChunkedAudio(finalAudio); // ❌ PROBLEM
  return;
}
```

`sendChunkedAudio()` calls `repeatAudio()` multiple times in a loop:

```typescript
// Lines 651-671
for (let i = 0; i < chunks.length; i++) {
  sessionRef.current?.repeatAudio(chunk); // ❌ Each call = new event_id
  await waitForAvatarSpeakEnded();
}
```

### Why This Is Wrong

The HeyGen SDK **already does chunking internally**:

```typescript
// Inside SDK's repeatAudio():
const event_id = this.generateEventId(); // ONE event_id per call
audioChunks = splitPcm24kStringToChunks(audio); // 20ms chunks

for (const audioChunk of audioChunks) {
  socket.send({ type: "agent.speak", event_id, audio: audioChunk });
}
socket.send({ type: "agent.speak_end", event_id }); // Auto-commit
```

When we call `repeatAudio()` multiple times:

- Each call generates a NEW `event_id`
- HeyGen treats each as a separate "Task"
- Tasks can overlap/replace each other
- Audio gets cut or lost

### The Correct Solution

**Remove `sendChunkedAudio()` entirely**. Always use ONE call to `repeatAudio()`:

```typescript
// ✅ CORRECT - One call, SDK handles chunking
const sendAllAudioToAvatar = () => {
  const fullAudio = concatenateAllChunks(audioBufferRef.current);
  const resampled = resample16to24(fullAudio);
  const withSilence = addLeadingSilence(resampled, 100);

  sessionRef.current.repeatAudio(toBase64(withSilence)); // ONE CALL
  audioBufferRef.current = [];
};
```

### Failed Attempt: Custom Streaming API (January 2026)

A session attempted to create a custom Streaming API in the SDK:

```typescript
// ❌ THESE METHODS DON'T EXIST IN HEYGEN
beginAudioStream(); // Invented
sendAudioChunk(); // Invented
commitAudioStream(); // Invented
cancelAudioStream(); // Invented
```

This approach failed because:

1. The WebSocket messages were invented, not real HeyGen protocol
2. Added 150+ lines to SDK for no benefit
3. Introduced race conditions and state management complexity
4. The SDK already handles everything with `repeatAudio()`

**Lesson learned**: Don't modify working SDKs. Understand them first.

### When This Bug Manifests

- Audio responses longer than ~16 seconds (>800KB at 24kHz)
- Long LLM explanations
- Multiple consecutive questions without interruption

### Temporary Workaround

Until fixed, the bug only affects audio >800KB. Short responses work correctly because they take the "normal path" (line 811) which uses a single `repeatAudio()` call.

---

## MASTER vs DEVELOP Comparison (January 2026)

### Summary of Differences

| Behavior               | MASTER                  | DEVELOP          |
| ---------------------- | ----------------------- | ---------------- |
| Saludo inicial         | ✅ Fluido, sincronizado | ⚠️ Choppy audio  |
| Primeras palabras      | ✅ No se comen          | ❌ Se cortan     |
| Audio largo (>800KB)   | ❌ Falla/trunca         | ✅ Funciona      |
| Resampling             | ❌ No (envía crudo)     | ✅ Sí (16→24kHz) |
| Configs mobile/desktop | ❌ No                   | ✅ Sí            |

### MASTER: TWO-PHASE Simple

```typescript
// Constantes
IMMEDIATE_SEND_CHUNKS = 2     // Envía primeros 2 chunks
IMMEDIATE_SEND_DELAY = 80ms   // Espera para acumular
CHUNK_GAP_THRESHOLD = 250ms   // Gap detection

// Flujo
Chunk 1 → Espera 80ms...
Chunk 2 → Acumula
80ms timeout → repeatAudio(chunk1+chunk2)  // UN event_id
Chunks 3-N → Gap detection → repeatAudio(resto)  // OTRO event_id
Total: 2 llamadas máximo
```

**Por qué funciona bien para saludos:**

- 80ms delay permite acumular 2 chunks (~600ms audio)
- Una llamada tiene todo el inicio → no se cortan palabras
- Sin resampling = sin posibles artifacts

**Por qué falla con audio largo:**

- No tiene MAX_AUDIO_SIZE_BYTES
- Intenta enviar todo en una llamada
- WebSocket/HeyGen tiene límite ~1MB → se trunca

### DEVELOP: Hybrid + Smart Chunking

```typescript
// Constantes
maxBufferSamples = 24000 (mobile) / 64000 (desktop)  // ~1.5s / 4s
MAX_AUDIO_SIZE_BYTES = 800KB
phase1LeadingSilence = 100ms (mobile) / 30ms (desktop)

// Flujo del saludo (problema)
Chunk 1 → PHASE 1 IMMEDIATE → repeatAudio()  // event_id=A
Chunks 2-4 → Buffer se llena (24000 samples)
BUFFER LIMIT → repeatAudio()  // event_id=B ← PROBLEMA!
Más chunks → BUFFER LIMIT → repeatAudio()  // event_id=C ← PROBLEMA!
Total: 3+ llamadas = CHOPPY
```

**Por qué el saludo es choppy:**

1. Envía primer chunk INMEDIATAMENTE (solo ~200ms audio)
2. BUFFER_LIMIT (1.5s mobile) fuerza otra llamada
3. Múltiples `repeatAudio()` = múltiples event_id
4. HeyGen crea Tasks separados que compiten

**Por qué funciona para conversación:**

- Respuestas cortas (<1.5s) se envían en una llamada
- Gap detection funciona bien para respuestas normales

### Propuesta de Solución Híbrida (NO IMPLEMENTADA)

Combinar lo mejor de ambos:

```typescript
// De MASTER: Delay inicial para acumular más
const IMMEDIATE_SEND_DELAY = 80ms;  // Esperar 80ms
const IMMEDIATE_SEND_CHUNKS = 2;     // Mínimo 2 chunks

// De DEVELOP: Resampling y configs
const audioConfig = isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG;
const resampled = resample16to24(concatenated);

// CRÍTICO: UNA sola llamada repeatAudio() siempre
// No usar sendChunkedAudio() - SDK ya divide internamente
sessionRef.current.repeatAudio(finalAudio);  // SIEMPRE UNA

// Para audio largo: dividir ANTES de concatenar
// NO después con Smart Chunking
```

### Decisión Pendiente

Opciones:

1. **Rollback a MASTER** - Saludos perfectos, pero no soporta audio largo
2. **Fix DEVELOP** - Agregar delay inicial, eliminar Smart Chunking
3. **Híbrido nuevo** - Implementar solución propuesta arriba

---

## GREETING FIX: Prevent Fragmentation on Mobile (January 2026)

### Status: ✅ IMPLEMENTED

### The Problem

On mobile devices, the greeting message was being sent in **multiple** `repeatAudio()` calls instead of **one**, causing choppy/fragmented audio:

**Expected Behavior:**

```
[AUDIO] GREETING SENT: 12 chunks, 450KB, single repeatAudio() call
```

**Actual Behavior (Before Fix):**

```
[AUDIO] BUFFER LIMIT: 25000 samples >= 24000 max, sending
[AUDIO] Response sent: 3 chunks, 86KB
[AUDIO] BUFFER LIMIT: 24500 samples >= 24000 max, sending
[AUDIO] Response sent: 3 chunks, 92KB
[AUDIO] BUFFER LIMIT: ...
```

### Root Cause

The greeting was triggering **two critical paths** on mobile:

1. **PHASE 1 (Immediate Send)**: First chunk sent immediately (~200ms audio)
   - Fast for normal responses ✅
   - But greeting needs more accumulation ❌

2. **Buffer Limit Check**: Mobile limit is 24000 samples (1.5s)
   - Greeting is typically 3-5 seconds long
   - Exceeds limit multiple times → multiple `repeatAudio()` calls
   - Each call = new `event_id` → HeyGen treats as separate tasks → choppy audio

### The Solution

Implemented a **GREETING_SKIP_PHASE1** flag that changes behavior for the first response only:

#### 1. Added Constant (Line ~120)

```typescript
// GREETING FIX: Skip immediate send for greeting to accumulate more audio
// This prevents fragmentation of the greeting message on mobile devices
const GREETING_SKIP_PHASE1 = true;
```

#### 2. Skip PHASE 1 for Greeting (Lines ~937-950)

```typescript
// PHASE 1: Immediate (first chunk) - LOW latency
// GREETING FIX: Skip PHASE 1 for greeting to accumulate more audio
if (!hassentImmediateRef.current && currentBufferLength === 1) {
  if (isFirstAudioRef.current && GREETING_SKIP_PHASE1) {
    console.log("[AUDIO] GREETING: Skipping PHASE 1 (immediate send)");
    // Don't send yet - continue to gap detection or buffer limit
  } else {
    hassentImmediateRef.current = true;
    console.log(
      "[AUDIO] PHASE 1: IMMEDIATE send first chunk (first words) - NO DELAY",
    );
    sendAllAudioToAvatar(true); // isImmediateSend = true for minimal silence
    return;
  }
}
```

**Impact:**

- Greeting waits for more chunks before sending
- Normal responses still get immediate send (low latency)

#### 3. Skip Buffer Limit for Greeting (Lines ~957-975)

```typescript
// MOBILE OPTIMIZATION: Check if buffer exceeds limit
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
```

**Impact:**

- **CRITICAL**: Prevents greeting fragmentation on mobile
- Mobile normally fragments at ~24000 samples (1.5s)
- Greeting now waits for gap detection or `onAgentResponseEnd`

#### 4. Reset Debounce on New Response (Lines ~987-994)

```typescript
onAgentResponse: () => {
  console.log("[AUDIO] agent_response received - new response starting");

  // GREETING FIX: Reset interrupt debounce to accept new audio chunks immediately
  // Without this, fast responses (<300ms) get discarded as "ghost chunks"
  lastInterruptTimeRef.current = 0;
  console.log("[AUDIO] Reset interrupt debounce for new response");
},
```

**Impact:**

- **CRITICAL**: Preserves first words when ElevenLabs responds fast (<300ms)
- Without this, chunks of new audio are discarded as "ghost chunks"

#### 5. Enhanced Logging (Lines ~929-932, ~819-828)

```typescript
// In onAudioData
console.log(
  `[AUDIO] Chunk #${totalChunksReceivedRef.current}, buffer: ${currentSamplesForLog} samples (${currentBufferLength} chunks), isGreeting: ${isFirstAudioRef.current}`,
);

// In sendAllAudioToAvatar
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
```

**Impact:**

- Easier debugging and verification
- Clearly shows when greeting is sent as single call

### Why Greeting Can Wait (+200-300ms Latency)

The greeting is the **FIRST** interaction. The user **NOT** waiting for a response because they haven't spoken yet. It's acceptable to add +200-300ms latency to guarantee:

- ✅ Smooth, professional audio (single `repeatAudio()` call)
- ✅ Perfect lip-sync (no fragmentation)
- ✅ Good first impression

### Why Normal Responses Must Be Fast

Responses to user questions **MUST** have minimal latency to feel natural. PHASE 1 (immediate send) is critical for:

- ✅ Low perceived latency (~100ms first word)
- ✅ Natural conversation flow
- ✅ Responsive interaction

### Desktop Compatibility

Desktop is **NOT** affected because:

- Buffer limit: 64000 samples (4 seconds)
- Greeting almost never reaches this limit
- If it does, still sent complete (no fragmentation)

### Testing Results

#### Test 1: Greeting on Mobile ✅

**Expected Logs:**

```
[AUDIO] GREETING: Skipping PHASE 1 (immediate send)
[AUDIO] GREETING: Skipping buffer limit (25000/24000 samples) - accumulating more
[AUDIO] agent_response_end received - sending all audio now
[AUDIO] GREETING SENT: 12 chunks, 450KB, single repeatAudio() call
```

#### Test 2: Fast Responses (<300ms) ✅

**Expected Logs:**

```
[AUDIO] agent_response received - new response starting
[AUDIO] Reset interrupt debounce for new response
[AUDIO] Chunk 1 accepted (time since interrupt: 150ms)
```

**Before Fix (Lost):**

```
[AUDIO] Ignoring ghost chunk (199ms since interrupt)
```

#### Test 3: Normal Responses (Not Greeting) ✅

**Expected Logs:**

```
[AUDIO] PHASE 1: IMMEDIATE send first chunk (first words) - NO DELAY
[AUDIO] Response sent: 1 chunks, 45KB
```

### Performance Metrics

| Metric                      | Before                     | After             | Target                 |
| --------------------------- | -------------------------- | ----------------- | ---------------------- |
| **Greeting Calls (Mobile)** | 4+ `repeatAudio()`         | 1 `repeatAudio()` | 1 ✅                   |
| **Greeting Size (Mobile)**  | 86KB + 92KB + 38KB + 296KB | 450KB             | Single chunk ✅        |
| **First Words Lost**        | Yes (responses <300ms)     | No                | 0% ✅                  |
| **Greeting Latency**        | ~200ms                     | ~400ms            | Acceptable (+200ms) ✅ |
| **Normal Response Latency** | ~100ms                     | ~100ms            | No change ✅           |

---

## Version History

| Date         | Change                                               |
| ------------ | ---------------------------------------------------- |
| Dec 30, 2024 | TWO-PHASE strategy implemented                       |
| Dec 30, 2024 | Desktop vs Mobile configs added                      |
| Dec 30, 2024 | MobileLogger component created                       |
| Dec 31, 2024 | Fixed `hassentImmediateRef` reset bug                |
| Dec 31, 2024 | MobileLogger: removed filter, added Copy All         |
| Jan 02, 2026 | Documented multiple repeatAudio() bug                |
| Jan 02, 2026 | Post-mortem: Failed Streaming API attempt            |
| Jan 05, 2026 | **✅ GREETING FIX: Prevent fragmentation on mobile** |

---

## External Documentation

- [ElevenLabs Conversational AI](https://elevenlabs.io/docs/conversational-ai/overview)
- [HeyGen LiveAvatar SDK](https://docs.heygen.com/docs/liveavatar-web-sdk)
- [LiveKit (used by HeyGen)](https://docs.livekit.io/)
