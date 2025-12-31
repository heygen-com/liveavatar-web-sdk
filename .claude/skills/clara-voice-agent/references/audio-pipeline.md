# Audio Pipeline Details

## Flujo completo

```
1. Usuario habla
   └─> Micrófono captura @ 44.1kHz

2. Browser resamplea a 16kHz
   └─> navigator.mediaDevices.getUserMedia()

3. ElevenLabs WebSocket recibe audio
   └─> wss://api.elevenlabs.io/v1/convai/conversation
   └─> Procesa: STT → LLM → TTS
   └─> Retorna chunks de audio 16kHz PCM base64

4. onAudioData callback recibe chunks
   └─> Ghost chunk debounce (300ms post-interrupt)
   └─> TWO-PHASE decision:
       ├─> PHASE 1: Primer chunk → enviar inmediato
       └─> PHASE 2: Acumular en buffer

5. Buffer acumula chunks
   └─> Mobile limit: 32K samples
   └─> Gap detection: 150-250ms sin chunks → enviar

6. sendAllAudioToAvatar()
   └─> Concatenar chunks (aún 16kHz)
   └─> Resample ONCE: 16kHz → 24kHz
   └─> Agregar silencio (lead + trail)
   └─> Smart Chunking si > 800KB
   └─> repeatAudio() a HeyGen

7. HeyGen LiveAvatar
   └─> Recibe audio 24kHz PCM base64
   └─> Genera lip-sync video
   └─> Emite avatar.speak_ended cuando termina
```

## Eventos críticos

### ElevenLabs → App

| Evento               | Significado               |
| -------------------- | ------------------------- |
| `audio`              | Chunk de audio disponible |
| `agent_response`     | LLM empezó a generar      |
| `agent_response_end` | LLM terminó de generar    |
| `interruption`       | Usuario interrumpió       |

### App → HeyGen

| Método                | Uso                        |
| --------------------- | -------------------------- |
| `repeatAudio(base64)` | Enviar audio para lip-sync |

### HeyGen → App

| Evento               | Significado              |
| -------------------- | ------------------------ |
| `avatar.speak_ended` | Avatar terminó de hablar |

## Problemas comunes y causas

| Síntoma                    | Causa probable       | Solución                       |
| -------------------------- | -------------------- | ------------------------------ |
| Primeras palabras cortadas | PHASE 1 no funciona  | Verificar hassentImmediateRef  |
| Audio stuttering           | Chunks muy pequeños  | Verificar gap threshold        |
| Audio truncado             | > 1MB enviado        | Verificar Smart Chunking       |
| Latencia alta              | PHASE 1 con delay    | Verificar envío síncrono       |
| Ghost audio post-interrupt | Debounce no funciona | Verificar lastInterruptTimeRef |
