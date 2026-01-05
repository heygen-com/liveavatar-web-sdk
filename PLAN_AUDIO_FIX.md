# Plan de Implementación - Fix de Audio Completo

## Contexto

Implementar dos fixes críticos de audio para mobile:

1. **Skip buffer limit para greeting** - Evitar fragmentación en mobile
2. **Reset debounce en onAgentResponse** - Preservar primeras palabras

---

## Estado Actual (Branch: claude/sync-develop-KYCiq)

### ✅ Ya Implementado

- Ghost chunk debounce (300ms)
- Buffer management con límites por dispositivo
- Two-phase send strategy (PHASE 1 + PHASE 2)
- Interrupt flag tracking
- Basic greeting tracking (`isFirstAudioRef`)

### ❌ Falta Implementar

- Constante `GREETING_SKIP_PHASE1`
- Skip de buffer limit específico para greeting
- Reset de `lastInterruptTimeRef` en `onAgentResponse`

---

## Archivos a Modificar

1. **`apps/demo/src/components/ClaraVoiceAgent.tsx`**
   - Líneas relevantes: 70-116 (config), 903-910 (debounce), 929-962 (phases), 969-971 (onAgentResponse)

---

## Plan Escalonado de Implementación

### PASO 1: Agregar Constante `GREETING_SKIP_PHASE1`

**Ubicación:** `ClaraVoiceAgent.tsx`, líneas 70-116 (bloque de audio config)

**Cambio:**

```typescript
// Agregar después de línea 116
const GREETING_SKIP_PHASE1 = true; // Skip immediate send for greeting - accumulate more audio
```

**Propósito:**

- Feature flag para controlar el comportamiento del greeting
- Facilita debugging y rollback si es necesario

**Riesgo:** ❌ Ninguno (solo constante)

---

### PASO 2: Implementar Skip de PHASE 1 para Greeting

**Ubicación:** `ClaraVoiceAgent.tsx`, líneas 929-939 (PHASE 1: Immediate)

**Cambio Actual:**

```typescript
// PHASE 1: Immediate (first chunk) - LOW latency
if (!hassentImmediateRef.current && !isAfterInterruptRef.current) {
  console.log("[AUDIO] PHASE 1: Immediate send (first chunk)");
  hassentImmediateRef.current = true;
  sendAllAudioToAvatar(false); // No wait for gap
  return;
}
```

**Cambio Nuevo:**

```typescript
// PHASE 1: Immediate (first chunk) - LOW latency
// Skip for greeting to accumulate more audio and avoid fragmentation
if (!hassentImmediateRef.current && !isAfterInterruptRef.current) {
  if (isFirstAudioRef.current && GREETING_SKIP_PHASE1) {
    console.log("[AUDIO] GREETING: Skipping PHASE 1 (immediate send)");
    // Don't send yet - continue to gap detection or buffer limit
  } else {
    console.log("[AUDIO] PHASE 1: Immediate send (first chunk)");
    hassentImmediateRef.current = true;
    sendAllAudioToAvatar(false); // No wait for gap
    return;
  }
}
```

**Propósito:**

- Greeting acumula más audio antes de enviar
- Respuestas normales mantienen latencia baja

**Riesgo:** ⚠️ Bajo - Solo afecta greeting, fácil de revertir

---

### PASO 3: Implementar Skip de Buffer Limit para Greeting

**Ubicación:** `ClaraVoiceAgent.tsx`, líneas 942-957 (Buffer limit check)

**Cambio Actual:**

```typescript
// Mobile optimization: Send buffer if it exceeds max samples
if (currentSamples >= audioConfig.maxBufferSamples) {
  console.log(
    `[AUDIO] BUFFER LIMIT: ${currentSamples} samples >= ${audioConfig.maxBufferSamples} max, sending`,
  );
  sendAllAudioToAvatar(false);
  return;
}
```

**Cambio Nuevo:**

```typescript
// Mobile optimization: Send buffer if it exceeds max samples
// Skip buffer limit for greeting to accumulate full message
if (currentSamples >= audioConfig.maxBufferSamples) {
  if (isFirstAudioRef.current && GREETING_SKIP_PHASE1) {
    console.log(
      `[AUDIO] GREETING: Skipping buffer limit (${currentSamples}/${audioConfig.maxBufferSamples} samples) - accumulating more`,
    );
    // Continue to gap detection - don't return
  } else {
    console.log(
      `[AUDIO] BUFFER LIMIT: ${currentSamples} samples >= ${audioConfig.maxBufferSamples} max, sending`,
    );
    sendAllAudioToAvatar(false);
    return;
  }
}
```

**Propósito:**

- **CRÍTICO**: Evita fragmentación del greeting en mobile
- Mobile normalmente fragmenta en ~24000 samples (1.5s)
- Greeting ahora esperará gap detection o `onAgentResponseEnd`

**Riesgo:** ⚠️ Medio - Cambia comportamiento de buffer en mobile, pero solo para greeting

---

### PASO 4: Reset de Debounce en `onAgentResponse`

**Ubicación:** `ClaraVoiceAgent.tsx`, líneas 969-971

**Cambio Actual:**

```typescript
onAgentResponse: () => {
  console.log("[AUDIO] agent_response received - new response starting");
},
```

**Cambio Nuevo:**

```typescript
onAgentResponse: () => {
  console.log("[AUDIO] agent_response received - new response starting");

  // Reset interrupt debounce to accept new audio chunks immediately
  // Without this, fast responses (<300ms) get discarded as "ghost chunks"
  lastInterruptTimeRef.current = 0;
  console.log("[AUDIO] Reset interrupt debounce for new response");
},
```

**Propósito:**

- **CRÍTICO**: Preserva primeras palabras cuando ElevenLabs responde rápido (<300ms)
- Sin esto, chunks del nuevo audio se descartan como "ghost chunks"

**Riesgo:** ⚠️ Bajo - Solo resetea timestamp, no afecta flujo principal

---

### PASO 5: Agregar Logging Detallado

**Ubicación:** `ClaraVoiceAgent.tsx`, donde sea relevante

**Cambios:**

```typescript
// En onAudioData (línea ~920)
console.log(
  `[AUDIO] Chunk ${totalChunksReceivedRef.current}, buffer: ${currentSamples} samples, isGreeting: ${isFirstAudioRef.current}`,
);

// En sendAllAudioToAvatar (línea ~820)
if (isFirstAudio) {
  console.log(
    `[AUDIO] GREETING SENT: ${chunks.length} chunks, ${totalSizeKB}KB, single repeatAudio() call`,
  );
} else {
  console.log(
    `[AUDIO] Response sent: ${chunks.length} chunks, ${totalSizeKB}KB`,
  );
}
```

**Propósito:**

- Facilitar debugging
- Confirmar que greeting se envía como un solo chunk
- Verificar que debounce funciona correctamente

**Riesgo:** ❌ Ninguno (solo logs)

---

## Testing Plan

### Test 1: Greeting en Mobile

**Objetivo:** Verificar que greeting se envía como UNA sola llamada a `repeatAudio()`

**Pasos:**

1. Abrir en mobile (o DevTools mobile simulation)
2. Iniciar sesión con avatar
3. Observar logs del greeting inicial

**Resultado Esperado:**

```
[AUDIO] GREETING: Skipping PHASE 1 (immediate send)
[AUDIO] GREETING: Skipping buffer limit (25000/24000 samples) - accumulating more
[AUDIO] agent_response_end received - sending all remaining audio
[AUDIO] GREETING SENT: 12 chunks, 450KB, single repeatAudio() call
```

**Resultado Anterior (❌ Fragmentado):**

```
[AUDIO] BUFFER LIMIT: 25000 samples >= 24000 max, sending
[AUDIO] Response sent: 3 chunks, 86KB
[AUDIO] BUFFER LIMIT: 24500 samples >= 24000 max, sending
[AUDIO] Response sent: 3 chunks, 92KB
...
```

---

### Test 2: Respuestas Rápidas (<300ms)

**Objetivo:** Verificar que primeras palabras NO se pierden

**Pasos:**

1. Hacer pregunta que genere respuesta rápida
2. Interrumpir justo antes de que avatar responda
3. Observar si primeras palabras se reproducen

**Resultado Esperado:**

```
[AUDIO] agent_response received - new response starting
[AUDIO] Reset interrupt debounce for new response
[AUDIO] Chunk 1 accepted (time since interrupt: 150ms)
```

**Resultado Anterior (❌ Perdido):**

```
[AUDIO] Ignoring ghost chunk (199ms since interrupt)
```

---

### Test 3: Respuestas Normales (No Greeting)

**Objetivo:** Verificar que respuestas normales mantienen baja latencia

**Pasos:**

1. Hacer pregunta al avatar
2. Observar primera respuesta (no greeting)
3. Verificar que PHASE 1 se ejecuta normalmente

**Resultado Esperado:**

```
[AUDIO] PHASE 1: Immediate send (first chunk)
[AUDIO] Response sent: 1 chunks, 45KB
```

---

## Rollback Plan

Si algo falla, revertir en orden inverso:

1. **Paso 5 (Logging):** Comentar logs nuevos
2. **Paso 4 (Reset):** Comentar reset de `lastInterruptTimeRef`
3. **Paso 3 (Buffer):** Comentar skip de buffer limit
4. **Paso 2 (PHASE 1):** Comentar skip de PHASE 1
5. **Paso 1 (Constante):** Cambiar `GREETING_SKIP_PHASE1 = false`

---

## Métricas de Éxito

| Métrica                                 | Antes                      | Después           | Target                                        |
| --------------------------------------- | -------------------------- | ----------------- | --------------------------------------------- |
| **Greeting Calls (Mobile)**             | 4+ `repeatAudio()`         | 1 `repeatAudio()` | 1 ✅                                          |
| **Greeting Size (Mobile)**              | 86KB + 92KB + 38KB + 296KB | 450KB             | Single chunk ✅                               |
| **Primeras Palabras Perdidas**          | Sí (respuestas <300ms)     | No                | 0% ✅                                         |
| **Latencia Primera Palabra (Greeting)** | ~200ms                     | ~400ms            | Aceptable (+200ms es tolerable para greeting) |
| **Latencia Respuestas Normales**        | ~100ms                     | ~100ms            | Sin cambio ✅                                 |

---

## Notas Adicionales

### Por qué Greeting puede esperar más

El greeting es la PRIMERA interacción. El usuario NO está esperando respuesta inmediata porque no ha hablado aún. Es aceptable +200-300ms de latencia para garantizar audio fluido y profesional.

### Por qué Respuestas Normales deben ser rápidas

Respuestas a preguntas del usuario DEBEN tener latencia mínima para sentirse naturales. PHASE 1 (immediate send) es crítico aquí.

### Compatibilidad Desktop

Desktop NO se ve afectado porque:

- Buffer limit: 64000 samples (4 segundos) - greeting casi nunca alcanza este límite
- Si lo alcanza, se envía completo de todos modos (sin fragmentación)

---

## Timeline Estimado

| Paso                      | Tiempo | Acumulado |
| ------------------------- | ------ | --------- |
| PASO 1: Constante         | 2 min  | 2 min     |
| PASO 2: Skip PHASE 1      | 5 min  | 7 min     |
| PASO 3: Skip Buffer Limit | 5 min  | 12 min    |
| PASO 4: Reset Debounce    | 3 min  | 15 min    |
| PASO 5: Logging           | 5 min  | 20 min    |
| Testing                   | 10 min | 30 min    |
| Documentación             | 10 min | 40 min    |

**Total:** ~40 minutos de implementación + testing

---

## Archivos de Referencia

- Implementación: `apps/demo/src/components/ClaraVoiceAgent.tsx`
- Documentación: `apps/demo/TROUBLESHOOTING.md`
- Testing: Browser DevTools console + Mobile device

---

## Siguientes Pasos

1. ✅ Plan creado y revisado
2. ⏳ Implementar PASO 1 (constante)
3. ⏳ Implementar PASO 2 (skip PHASE 1)
4. ⏳ Implementar PASO 3 (skip buffer limit)
5. ⏳ Implementar PASO 4 (reset debounce)
6. ⏳ Implementar PASO 5 (logging)
7. ⏳ Testing completo
8. ⏳ Documentación actualizada
9. ⏳ Commit y push

---

**Última actualización:** 2026-01-05
**Branch:** claude/sync-develop-KYCiq
**Commit base:** 83b69d8
