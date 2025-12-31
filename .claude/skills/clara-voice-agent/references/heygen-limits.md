# HeyGen SDK Limits

## Límites conocidos

| Límite         | Valor      | Consecuencia                    |
| -------------- | ---------- | ------------------------------- |
| Audio size     | < 1MB      | Audio truncado si excede        |
| Audio duration | ≤ 15s      | Aproximado, depende del bitrate |
| Sample rate    | 24kHz      | OBLIGATORIO, otros rates fallan |
| Format         | PCM 16-bit | Base64 encoded                  |

## Cálculos de tamaño

```
24kHz * 2 bytes (16-bit) = 48KB/s
15 segundos = 720KB
Margen seguro = 800KB (incluye overhead base64)
```

## API de repeatAudio

```typescript
session.repeatAudio(audioBase64: string): void
```

- NO es async - retorna inmediatamente
- NO hace queue - un audio a la vez
- Emite `avatar.speak_ended` cuando termina

## Eventos

```typescript
// Cuando el avatar termina de hablar
session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
  console.log("Avatar finished speaking");
});
```

## Best Practices

1. **Siempre resamplear a 24kHz** antes de enviar
2. **Verificar tamaño** antes de enviar (< 800KB)
3. **Esperar speak_ended** antes de enviar siguiente chunk
4. **No enviar mientras habla** - causa comportamiento undefined

## Workarounds implementados

### Smart Chunking

Si audio > 800KB:

1. Dividir en chunks de ~800KB
2. Enviar chunk 1
3. Esperar avatar.speak_ended
4. Enviar chunk 2
5. Repetir hasta terminar

### Micro-pausa entre chunks

- Inevitable ~150-300ms de gap
- Mitigado con chunks más grandes (800KB vs 600KB)
- Trade-off: menos cortes vs más riesgo de overflow
