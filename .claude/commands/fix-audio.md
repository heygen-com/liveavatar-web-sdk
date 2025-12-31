---
description: Debug y fix de problemas de audio en Clara Voice Agent
argument-hint: [symptom description]
allowed-tools: Read, Grep, Edit, Bash(pnpm:*)
---

# Fix Audio Issue

## Síntoma reportado

$ARGUMENTS

## Archivos críticos a revisar

1. **Pipeline principal**: `apps/demo/src/components/ClaraVoiceAgent.tsx`
2. **Hook ElevenLabs**: `apps/demo/src/hooks/useElevenLabsAgent.ts`
3. **Troubleshooting**: `apps/demo/TROUBLESHOOTING.md`

## Checklist de diagnóstico

### 1. Audio cortado / primeras palabras perdidas

- [ ] Verificar TWO-PHASE strategy está activo
- [ ] PHASE 1 debe enviar primer chunk inmediatamente
- [ ] Verificar `hassentImmediateRef` se resetea correctamente

### 2. Audio entrecortado / stutter

- [ ] Verificar Smart Chunking threshold (800KB)
- [ ] Verificar gap entre chunks no es muy largo
- [ ] Verificar que no hay resampling múltiple

### 3. Latencia alta

- [ ] Verificar que PHASE 1 envía sin delay
- [ ] Verificar latency tracking está funcionando
- [ ] Revisar logs de `[AUDIO]` en consola

### 4. Audio truncado (respuestas largas)

- [ ] Verificar MAX_AUDIO_SIZE_BYTES = 800KB
- [ ] Verificar Smart Chunking divide correctamente
- [ ] Verificar waitForAvatarSpeakEnded funciona

### 5. Mobile específico

- [ ] Verificar buffer limit (32K samples)
- [ ] Verificar audioConfig usa valores mobile
- [ ] Revisar MobileLogger para debug en device

## Constantes clave

```typescript
MAX_AUDIO_SIZE_BYTES = 800 * 1024; // 800KB per chunk
CHUNK_WAIT_TIMEOUT_MS = 20000; // 20s timeout
INTERRUPT_DEBOUNCE_MS = 300; // Ghost chunk protection
TARGET_SAMPLE_RATE = 24000; // HeyGen requirement
```

## Output esperado

1. Identificar causa raíz
2. Proponer fix con código específico
3. Verificar con `pnpm build`
4. NO hacer commit - solo proponer cambios
