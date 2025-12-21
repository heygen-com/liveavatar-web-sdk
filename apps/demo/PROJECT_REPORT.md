# Clara Voice Agent - Reporte del Proyecto

**Fecha:** Diciembre 2024
**Estado:** MVP Funcional
**Versión:** 1.0.0-beta

---

## 1. Resumen Ejecutivo

Clara Voice Agent es un asistente de voz con avatar 3D que combina:

- **ElevenLabs Conversational AI** para STT (Speech-to-Text), LLM y TTS (Text-to-Speech)
- **HeyGen LiveAvatar** para renderizado de avatar 3D con lip-sync en tiempo real

El usuario habla con Clara a través del micrófono, Clara procesa la conversación y responde con voz sincronizada con movimientos labiales del avatar.

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Browser)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    Audio PCM 16kHz    ┌──────────────────────┐   │
│  │  Micrófono  │ ──────────────────►   │  ElevenLabs WebSocket │   │
│  │  (44.1kHz)  │    (base64 JSON)      │  Conversational AI   │   │
│  └─────────────┘                       └──────────┬───────────┘   │
│                                                   │                │
│                                    Audio chunks   │                │
│                                    (16kHz PCM)    ▼                │
│                                        ┌──────────────────┐        │
│                                        │  Audio Buffer    │        │
│                                        │  (Acumulador)    │        │
│                                        └────────┬─────────┘        │
│                                                 │                  │
│                              Timeout (200-500ms)│                  │
│                              o agent_response_end                  │
│                                                 ▼                  │
│  ┌─────────────┐    Audio PCM 24kHz    ┌──────────────────┐        │
│  │   HeyGen    │ ◄──────────────────   │  Resample +      │        │
│  │  LiveAvatar │    (base64)           │  Concatenate     │        │
│  │   (Video)   │                       └──────────────────┘        │
│  └─────────────┘                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         SERVIDOR (Next.js API)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  /api/start-custom-session  →  HeyGen API (session token)          │
│  /api/elevenlabs-conversation  →  ElevenLabs API (signed URL)      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Stack Tecnológico

### Frontend

| Tecnología   | Versión | Propósito               |
| ------------ | ------- | ----------------------- |
| Next.js      | 15.4.2  | Framework React con SSR |
| React        | 19.1.0  | UI Library              |
| TypeScript   | 5.x     | Type safety             |
| Tailwind CSS | 4.x     | Estilos                 |
| shadcn/ui    | latest  | Componentes UI          |
| Lucide React | latest  | Iconos                  |

### SDKs Externos

| SDK                        | Propósito                           |
| -------------------------- | ----------------------------------- |
| @heygen/liveavatar-web-sdk | Avatar 3D con lip-sync              |
| ElevenLabs WebSocket API   | Conversational AI (STT + LLM + TTS) |

### APIs Externas

| Servicio   | Endpoint          | Propósito                 |
| ---------- | ----------------- | ------------------------- |
| HeyGen     | api.heygen.com    | Crear sesiones de avatar  |
| ElevenLabs | api.elevenlabs.io | Signed URL para WebSocket |

---

## 4. Archivos Principales

### Componentes Core

```
apps/demo/src/
├── components/
│   └── ClaraVoiceAgent.tsx    # Componente principal (900+ líneas)
│       ├── SafariFallbackScreen   # Fallback para Safari iOS
│       ├── LandingScreen          # Pantalla inicial
│       ├── ConnectingScreen       # Estado de conexión
│       ├── ConnectedSession       # Sesión activa con avatar
│       ├── StatusIndicator        # Badge de estado
│       └── VoiceControls          # Control de mute
│
├── hooks/
│   ├── useElevenLabsAgent.ts  # Hook para ElevenLabs WebSocket (~500 líneas)
│   │   ├── connect()              # Conexión WebSocket
│   │   ├── startMicrophoneCapture()  # Captura de audio
│   │   ├── handleWebSocketMessage()  # Procesa eventos
│   │   └── Callbacks: onAudioData, onAgentResponse, onInterruption, etc.
│   │
│   ├── useScreenSize.ts       # Detección desktop/mobile
│   └── useFixedHeight.ts      # Manejo de altura en iframe
│
├── liveavatar/
│   ├── LiveAvatarContext.tsx  # Context provider para HeyGen
│   ├── useSession.ts          # Hook para sesión de avatar
│   └── index.ts               # Exports
│
└── app/
    ├── page.tsx               # Página principal
    └── api/
        ├── start-custom-session/route.ts  # API para HeyGen
        └── elevenlabs-conversation/route.ts  # API para ElevenLabs
```

### Archivos de Configuración

```
apps/demo/
├── .env.local                 # Variables de entorno (NO commitear)
│   ├── HEYGEN_API_KEY
│   ├── ELEVENLABS_API_KEY
│   └── ELEVENLABS_AGENT_ID
│
├── next.config.ts             # Configuración Next.js
├── tailwind.config.ts         # Configuración Tailwind
├── components.json            # Configuración shadcn/ui
└── package.json               # Dependencias
```

---

## 5. Flujo de Audio (Detallado)

### 5.1 Usuario → ElevenLabs

```javascript
// 1. Captura de micrófono (44.1kHz nativo)
navigator.mediaDevices.getUserMedia({ audio: true });

// 2. Conversión a PCM 16-bit
float32ToInt16(audioData);

// 3. Resample a 16kHz
resampleAudio(pcmData, 44100, 16000);

// 4. Encode a base64
arrayBufferToBase64(pcmData.buffer);

// 5. Enviar via WebSocket
ws.send(JSON.stringify({ user_audio_chunk: base64Audio }));
```

### 5.2 ElevenLabs → Avatar

```javascript
// 1. Recibir chunks de audio (16kHz)
onAudioData: (audioBase64) => {
  audioBufferRef.current.push(audioBase64)
  scheduleAudioFlush()
}

// 2. Timeout adaptativo
timeout = bufferSize > 400KB ? 200ms : 500ms

// 3. Concatenar todos los chunks
concatenateBase64Audio(chunks)

// 4. Resample a 24kHz (interno en el SDK de HeyGen)
// 5. Enviar a avatar
session.repeatAudio(concatenatedAudio)
```

### 5.3 Manejo de Interrupciones

```javascript
// Cuando usuario habla:
onUserTranscript → session.interrupt()  // Solo interrumpe avatar

// Cuando ElevenLabs confirma:
onInterruption → audioBuffer = []  // Limpia buffer viejo

// Nueva respuesta llega a buffer limpio
```

---

## 6. Variables de Entorno

```bash
# .env.local (REQUERIDAS)

# HeyGen API
HEYGEN_API_KEY=your_heygen_api_key_here

# ElevenLabs API
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxxx
```

### Obtener las Keys

1. **HeyGen API Key:**
   - Dashboard: https://app.heygen.com/settings/api
   - Plan requerido: Creator o superior

2. **ElevenLabs API Key:**
   - Dashboard: https://elevenlabs.io/app/settings/api-keys
   - Plan requerido: Creator o superior

3. **ElevenLabs Agent ID:**
   - Crear agente en: https://elevenlabs.io/app/conversational-ai
   - Copiar ID del agente creado

---

## 7. Configuración del Agente ElevenLabs

### Configuración Recomendada

```yaml
Agent Name: Clara Skin Care Assistant
Language: Spanish (es)
Voice: Rachel (o voz latina)

First Message: |
  ¡Hola! Soy Clara, tu asistente de belleza personal.
  Estoy aquí para ayudarte con el cuidado de tu piel.
  ¿En qué puedo ayudarte hoy?

System Prompt: |
  Eres Clara, una asistente experta en cuidado de la piel.
  - Responde siempre en español
  - Sé amable y profesional
  - Haz preguntas para entender las necesidades del usuario
  - Recomienda productos basándote en el tipo de piel
  - Mantén respuestas concisas (2-3 oraciones máximo)

LLM: Claude 3.5 Sonnet (recomendado) o GPT-4
Temperature: 0.7
Max Tokens: 150
```

---

## 8. Limitaciones Conocidas

### 8.1 Safari iOS

- **Estado:** No soportado
- **Razón:** Restricciones de autoplay de audio en WebKit
- **Solución:** Pantalla de fallback que sugiere usar Chrome/Android

### 8.2 Latencia

- **Latencia típica:** 200-800ms entre fin de habla y respuesta del avatar
- **Causa:** Timeout de acumulación de audio
- **Trade-off:** Menor latencia = mayor riesgo de audio cortado

### 8.3 Audio Cortado

- **Cuándo:** Respuestas muy cortas o chunks con gaps >500ms
- **Mitigación:** Timeout adaptativo basado en tamaño del buffer

---

## 9. Guía de Despliegue a Producción

### 9.1 Pre-requisitos

- [ ] Cuenta de Vercel (recomendado) o hosting Node.js
- [ ] API Keys de producción (HeyGen + ElevenLabs)
- [ ] Dominio configurado (opcional pero recomendado)
- [ ] SSL/HTTPS (requerido para micrófono)

### 9.2 Pasos para Vercel

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Desde el directorio del proyecto
cd apps/demo

# 4. Deploy
vercel

# 5. Configurar variables de entorno en Vercel Dashboard
#    Settings → Environment Variables
#    - HEYGEN_API_KEY
#    - ELEVENLABS_API_KEY
#    - ELEVENLABS_AGENT_ID

# 6. Redeploy para aplicar variables
vercel --prod
```

### 9.3 Checklist Pre-Producción

#### Seguridad

- [ ] API Keys en variables de entorno (nunca en código)
- [ ] HTTPS habilitado
- [ ] CORS configurado correctamente
- [ ] Rate limiting en APIs

#### Performance

- [ ] Build optimizado (`next build`)
- [ ] Imágenes optimizadas
- [ ] Lazy loading de componentes pesados

#### Monitoreo

- [ ] Error tracking (Sentry recomendado)
- [ ] Analytics de uso
- [ ] Logs de WebSocket connections
- [ ] Alertas de errores de API

#### UX

- [ ] Mensajes de error amigables
- [ ] Estado de carga visible
- [ ] Fallback para navegadores no soportados
- [ ] Instrucciones de permisos de micrófono

### 9.4 Configuración de Producción Recomendada

```typescript
// next.config.ts
const nextConfig = {
  output: "standalone", // Para Docker/containers
  images: {
    domains: ["your-cdn.com"],
  },
  // Headers de seguridad
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
        ],
      },
    ];
  },
};
```

---

## 10. Mejoras Futuras Recomendadas

### Corto Plazo (1-2 semanas)

1. **Reconexión automática** de WebSocket
2. **Métricas de latencia** para optimización
3. **Límite de buffer** para respuestas muy largas
4. **Tests unitarios** para hooks

### Mediano Plazo (1-2 meses)

1. **VAD del lado del cliente** para reducir tráfico
2. **Caché de greeting** para respuesta instantánea
3. **Soporte multi-idioma**
4. **Personalización de avatar**

### Largo Plazo (3+ meses)

1. **Streaming real** con queue inteligente
2. **WebRTC** para menor latencia
3. **Avatar en dispositivos móviles** (nativo)
4. **Integración con CRM/backend**

---

## 11. Comandos Útiles

```bash
# Desarrollo
pnpm dev                    # Servidor de desarrollo (puerto 3001)

# Build
pnpm build                  # Build de producción
pnpm start                  # Servidor de producción

# Linting
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript check

# Limpieza
rm -rf .next node_modules   # Reset completo
pnpm install                # Reinstalar dependencias
```

---

## 12. Contacto y Soporte

### Documentación Externa

- [HeyGen LiveAvatar SDK](https://docs.heygen.com/docs/live-avatar-sdk)
- [ElevenLabs Conversational AI](https://elevenlabs.io/docs/conversational-ai)
- [Next.js Docs](https://nextjs.org/docs)
- [shadcn/ui](https://ui.shadcn.com)

---

## Changelog

### v1.0.0-beta (Diciembre 2024)

- Integración inicial ElevenLabs + HeyGen
- Sistema de buffer con timeout adaptativo
- Manejo de interrupciones
- UI con shadcn/ui
- Fallback para Safari iOS
