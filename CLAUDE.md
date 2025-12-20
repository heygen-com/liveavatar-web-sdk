CLAUDE.md - Clara Voice Agent
Quick Commands
bash# Desarrollo (puerto 3001)
pnpm dev # Monorepo completo
pnpm demo # Solo demo app

# Build & Verificación

pnpm build # Build all (OBLIGATORIO antes de push)
pnpm typecheck # TypeScript check
pnpm lint # ESLint

# Testing

pnpm test # Tests con coverage
cd packages/js-sdk && npx vitest run [archivo] # Test específico

# Session Init

./init.sh # Iniciar sesión Claude Code
Session Protocol
Inicio (OBLIGATORIO)
bash./init.sh # 1. Verificación completa
cat .claude/sessions/claude-progress.txt # 2. Última sesión
cat .claude/tracking/feature_list.json # 3. Features pendientes

# 4. Elegir UNA feature HIGH priority

# 5. Anunciar: "Trabajando en [feature-id]"

Fin (OBLIGATORIO)
bashpnpm build # 1. Verificar build
git add . && git commit -m "tipo: desc" # 2. Commit

# 3. Actualizar .claude/sessions/claude-progress.txt

# 4. Si feature completa → passes: true en feature_list.json

Arquitectura Core (30 segundos)
Usuario habla → Micrófono (44.1kHz)
↓ resample 16kHz
ElevenLabs WebSocket (STT + LLM + TTS)
↓ chunks audio 16kHz
Audio Buffer (acumula 200-500ms)
↓ resample 24kHz
HeyGen LiveAvatar (lip-sync video)
Archivos críticos:
QuéDóndeComponente principalapps/demo/src/components/ClaraVoiceAgent.tsxHook ElevenLabsapps/demo/src/hooks/useElevenLabsAgent.tsContext HeyGenapps/demo/src/liveavatar/LiveAvatarContext.tsxAPI HeyGenapps/demo/src/app/api/start-custom-session/route.tsAPI ElevenLabsapps/demo/src/app/api/elevenlabs-conversation/route.ts
Reglas Críticas
PROHIBIDO

Modificar packages/js-sdk/src/ sin plan aprobado (es el SDK público)
Push sin pnpm build passing
Marcar feature como passes: true sin test en browser real
Probar en Safari iOS (no soportado, hay fallback)

OBLIGATORIO

UNA feature por sesión
Test end-to-end en Chrome antes de declarar completo
Documentar workarounds en TROUBLESHOOTING.md
Commit después de cada cambio funcional

Limitaciones Conocidas
IssueStatusWorkaroundSafari iOSNo soportadoSafariFallbackScreen muestra mensajeLatencia 200-800msBy designTimeout adaptativo en bufferAudio cortadoRespuestas cortasBuffer mínimo 200ms
Environment Variables
bash# apps/demo/.env.local (REQUERIDAS)
HEYGEN_API_KEY=xxx
ELEVENLABS_API_KEY=xxx
ELEVENLABS_AGENT_ID=agent_xxx
Tracking Files
ArchivoPropósitoActualizar.claude/sessions/claude-progress.txtLog sesionesCada sesión.claude/tracking/feature_list.jsonEstado featuresAl completar.claude/tracking/blockers.jsonBloqueadoresCuando aparezcan.claude/PROJECT_BRIEF.mdScope del proyectoSi cambia alcance
Documentación Extendida

Arquitectura completa: docs/PROJECT_KNOWLEDGE.md
Problemas y soluciones: docs/TROUBLESHOOTING.md
Guía de deploy: docs/DEPLOYMENT.md
Handoff: docs/HANDOFF.md

Context7 Auto-Invoke
Usar automáticamente para:

@heygen/liveavatar-web-sdk → HeyGen LiveAvatar docs
ElevenLabs WebSocket API → ElevenLabs Conversational AI docs
Next.js 15 App Router → Next.js docs
LiveKit client → LiveKit docs

Requisitos Sistema

Node.js >= 22
pnpm 9.0.0
Chrome/Firefox para testing (NO Safari)
