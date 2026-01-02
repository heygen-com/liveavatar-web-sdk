---
name: clara-voice-agent
description: Use when working with Clara Voice Agent, audio pipeline, ElevenLabs integration, HeyGen LiveAvatar, or any voice agent functionality.
---

# Clara Voice Agent Skill

## Overview

Clara es un agente de voz en tiempo real para Beta Skin Tech que combina:

- **ElevenLabs**: STT + LLM + TTS via WebSocket
- **HeyGen LiveAvatar**: Lip-sync video avatar
- **Next.js 16**: Frontend framework

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLARA VOICE AGENT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Usuario habla → Mic (44.1kHz)                                   │
│       ↓ browser resample                                         │
│  ElevenLabs WebSocket (16kHz PCM)                                │
│       ↓ STT → LLM → TTS                                          │
│  Audio chunks (16kHz base64 PCM)                                 │
│       ↓ accumulate in buffer                                     │
│  Audio Buffer                                                    │
│       ↓ resample ONCE to 24kHz                                   │
│  HeyGen LiveAvatar                                               │
│       ↓ lip-sync + video                                         │
│  Usuario ve avatar hablando                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Estrategia de Audio: HYBRID

### TWO-PHASE Strategy

| Phase   | Cuando            | Acción                   | Silencio      |
| ------- | ----------------- | ------------------------ | ------------- |
| PHASE 1 | Primer chunk      | Enviar INMEDIATAMENTE    | 30-100ms lead |
| PHASE 2 | Chunks siguientes | Acumular + gap detection | 50-80ms lead  |

### Smart Chunking

- Si audio > 800KB: dividir en segmentos
- Enviar secuencialmente esperando `avatar.speak_ended`
- Previene buffer overflow de HeyGen

## Archivos Clave

| Archivo                                           | Propósito                              |
| ------------------------------------------------- | -------------------------------------- |
| `apps/demo/src/components/ClaraVoiceAgent.tsx`    | Componente principal, todo el pipeline |
| `apps/demo/src/hooks/useElevenLabsAgent.ts`       | Hook WebSocket ElevenLabs              |
| `apps/demo/src/components/debug/MobileLogger.tsx` | Debug en pantalla para móvil           |
| `apps/demo/TROUBLESHOOTING.md`                    | Guía de problemas de audio             |

## Constantes Críticas

```typescript
// Audio chunking
MAX_AUDIO_SIZE_BYTES = 800 * 1024   // 800KB per chunk
CHUNK_WAIT_TIMEOUT_MS = 20000        // 20s timeout per chunk

// Ghost chunk protection
INTERRUPT_DEBOUNCE_MS = 300          // Ignore post-interrupt

// Sample rates
SOURCE_RATE = 16000                  // ElevenLabs output
TARGET_RATE = 24000                  // HeyGen requirement

// Mobile vs Desktop (runtime)
gapThreshold: 150ms (mobile) / 250ms (desktop)
maxBufferSamples: 32K (mobile) / 128K (desktop)
```

## Deployments

| Branch  | Environment | URL                              |
| ------- | ----------- | -------------------------------- |
| master  | Production  | https://clara.betaskintech.com   |
| develop | Staging     | https://testers.betaskintech.com |

## DO NOT MODIFY

- `packages/js-sdk/src/` - SDK público, requiere plan aprobado
- Constantes de sample rate sin entender el pipeline completo

## Referencias

- [Audio Pipeline Details](references/audio-pipeline.md)
- [HeyGen SDK Limits](references/heygen-limits.md)
- [ElevenLabs Events](references/elevenlabs-events.md)
