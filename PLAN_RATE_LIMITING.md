# Plan de Rate Limiting - Clara Voice Agent

**Fecha:** 2026-01-02
**Estado:** Pendiente aprobación
**Stack:** Vercel KV Redis (Hobby - GRATIS)

---

## 1. ANÁLISIS DEL PROBLEMA

### Vulnerabilidades Actuales 🚨

#### A. **APIs Costosas Sin Protección**

```typescript
// ❌ CUALQUIERA puede spamear estos endpoints
POST / api / start - custom - session; // HeyGen token ($$$)
POST / api / elevenlabs - conversation; // ElevenLabs signed URL ($$$)
POST / api / shopify - customer; // Shopify API (rate limited por ellos)
POST / api / verify - customer; // Shopify API (rate limited por ellos)
```

#### B. **Escenarios de Abuso**

1. **DDoS básico:** Bot martilla `/api/start-custom-session` → Miles de tokens HeyGen → Factura enorme
2. **Credential stuffing:** Atacante prueba emails en `/api/verify-customer` → Shopify banea tu IP
3. **Spam legítimo:** Usuario impaciente clickea "Iniciar" 20 veces → 20 sesiones simultáneas

#### C. **Costos Sin Limitar**

- HeyGen: ~$0.05 por sesión × 1000 sesiones = **$50** (sin límite)
- ElevenLabs: ~$0.10 por minuto × 10 min × 100 usuarios = **$100/día** (sin límite)
- Shopify: Baneados por exceder rate limits → **Servicio caído**

---

## 2. SOLUCIÓN: VERCEL KV REDIS

### 🎯 **Por Qué Redis?**

#### Ventajas Específicas

- **Sub-ms latency:** No bloquea requests legítimos
- **Atomic operations:** Incremento thread-safe (no race conditions)
- **TTL automático:** Claves expiran solas (no limpieza manual)
- **100% gratis:** Vercel KV Hobby tier

#### Alternativas Descartadas

- **Prisma DB counters:** Demasiado lento (50-200ms vs <5ms)
- **In-memory (Node):** Se resetea en cada deploy/cold start
- **Upstash Redis directo:** Más config, Vercel KV ya integrado

### Vercel KV Hobby Tier (GRATIS)

- **Storage:** 256MB (millones de rate limit keys)
- **Requests:** 3000 comandos/día (suficiente para ~500 usuarios/día)
- **Latency:** <5ms (global edge network)

---

## 3. ESTRATEGIA DE RATE LIMITING

### 📋 **Matriz de Límites**

| Endpoint                       | Límite por IP | Límite por Usuario | Ventana | Razón                           |
| ------------------------------ | ------------- | ------------------ | ------- | ------------------------------- |
| `/api/start-custom-session`    | 5 req/15min   | 3 req/15min        | Sliding | Proteger HeyGen quota ($$$)     |
| `/api/elevenlabs-conversation` | 10 req/hour   | 5 req/hour         | Fixed   | Proteger ElevenLabs quota ($$$) |
| `/api/verify-customer`         | 10 req/5min   | -                  | Sliding | Evitar ban de Shopify API       |
| `/api/shopify-customer`        | 10 req/5min   | -                  | Sliding | Evitar ban de Shopify API       |
| **Global (todas las APIs)**    | 100 req/min   | -                  | Sliding | Anti-DDoS básico                |

### 🔑 **Rate Limit Keys**

```typescript
// Por IP (anonymous users)
`ratelimit:ip:{IP_ADDRESS}:{ENDPOINT}` → count + ttl

// Por Usuario (authenticated)
`ratelimit:user:{USER_ID}:{ENDPOINT}` → count + ttl

// Global (anti-DDoS)
`ratelimit:global:{IP_ADDRESS}` → count + ttl
```

### ⏱️ **Tipos de Ventana**

#### Fixed Window (simple, rápido)

```
0:00 → 5 requests OK → 1:00 reset
- Ventaja: Simple, bajo overhead
- Desventaja: "Burst" al inicio de ventana
```

#### Sliding Window (más fair, recomendado)

```
Cada request desplaza ventana dinámica
- Ventaja: Más equitativo, no hay bursts
- Desventaja: Levemente más complejo
```

---

## 4. IMPLEMENTACIÓN

### Sprint 1: Setup Vercel KV (30 min)

#### 1. Crear Vercel KV Database

```bash
# En Vercel Dashboard:
1. Storage → Create Database → KV
2. Copiar tokens a .env.local
```

#### 2. Instalar dependencias

```bash
cd apps/demo
pnpm add @vercel/kv
```

#### 3. Configurar env vars

```bash
# apps/demo/.env.local
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
```

---

### Sprint 2: Middleware de Rate Limiting (2-3 horas)

#### Ubicación: `apps/demo/src/lib/rate-limit.ts` (nuevo)

```typescript
import { kv } from "@vercel/kv";
import { NextRequest } from "next/server";

export interface RateLimitConfig {
  /**
   * Máximo de requests permitidos
   */
  max: number;

  /**
   * Ventana de tiempo en segundos
   */
  windowSec: number;

  /**
   * Tipo de ventana
   */
  type?: "fixed" | "sliding";
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // timestamp
}

/**
 * Rate limiter basado en Vercel KV Redis
 * Usa sliding window por defecto para distribución justa
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const { max, windowSec, type = "sliding" } = config;
  const now = Date.now();
  const key = `ratelimit:${identifier}`;

  if (type === "fixed") {
    // Fixed window: simple counter con TTL
    const count = await kv.incr(key);

    if (count === 1) {
      // Primera request en ventana → set TTL
      await kv.expire(key, windowSec);
    }

    const ttl = await kv.ttl(key);
    const reset = now + ttl * 1000;

    return {
      success: count <= max,
      limit: max,
      remaining: Math.max(0, max - count),
      reset,
    };
  } else {
    // Sliding window: sorted set con timestamps
    const windowMs = windowSec * 1000;
    const windowStart = now - windowMs;

    // 1. Eliminar requests antiguas fuera de ventana
    await kv.zremrangebyscore(key, 0, windowStart);

    // 2. Contar requests en ventana actual
    const count = await kv.zcard(key);

    if (count >= max) {
      // Rate limit excedido
      const oldestTimestamp = await kv.zrange(key, 0, 0, { withScores: true });
      const reset = oldestTimestamp[1] + windowMs;

      return {
        success: false,
        limit: max,
        remaining: 0,
        reset,
      };
    }

    // 3. Agregar request actual
    await kv.zadd(key, { score: now, member: `${now}:${Math.random()}` });

    // 4. Set TTL para auto-cleanup
    await kv.expire(key, windowSec);

    return {
      success: true,
      limit: max,
      remaining: max - count - 1,
      reset: now + windowMs,
    };
  }
}

/**
 * Helper: Get user identifier from request
 */
export function getIdentifier(
  request: NextRequest,
  type: "ip" | "user",
): string | null {
  if (type === "ip") {
    return (
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown"
    );
  } else {
    // Extraer user ID desde session (requiere auth)
    // TODO: Implementar después de integrar auth
    return null;
  }
}

/**
 * Wrapper: Rate limit por endpoint
 */
export async function rateLimitByEndpoint(
  request: NextRequest,
  endpoint: string,
): Promise<RateLimitResult> {
  const ip = getIdentifier(request, "ip");
  const identifier = `${ip}:${endpoint}`;

  // Configuraciones por endpoint
  const configs: Record<string, RateLimitConfig> = {
    "start-custom-session": { max: 5, windowSec: 15 * 60 }, // 5 per 15min
    "elevenlabs-conversation": { max: 10, windowSec: 60 * 60 }, // 10 per hour
    "verify-customer": { max: 10, windowSec: 5 * 60 }, // 10 per 5min
    "shopify-customer": { max: 10, windowSec: 5 * 60 }, // 10 per 5min
  };

  const config = configs[endpoint] || { max: 60, windowSec: 60 }; // Default: 60/min
  return rateLimit(identifier, config);
}
```

---

### Sprint 3: Integrar en API Routes (1-2 horas)

#### Ejemplo: Proteger `/api/start-custom-session`

```typescript
// apps/demo/app/api/start-custom-session/route.ts
import { rateLimitByEndpoint } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // === RATE LIMIT CHECK ===
  const limitResult = await rateLimitByEndpoint(
    request,
    "start-custom-session",
  );

  if (!limitResult.success) {
    return new Response(
      JSON.stringify({
        error: "Too many requests",
        message: "Por favor espera unos minutos antes de intentar nuevamente",
        retryAfter: Math.ceil((limitResult.reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": limitResult.limit.toString(),
          "X-RateLimit-Remaining": limitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(limitResult.reset).toISOString(),
          "Retry-After": Math.ceil(
            (limitResult.reset - Date.now()) / 1000,
          ).toString(),
        },
      },
    );
  }

  // === CONTINUAR CON LÓGICA NORMAL ===
  // ... resto del código existente
}
```

#### Aplicar en TODOS los endpoints críticos:

- ✅ `/api/start-custom-session/route.ts`
- ✅ `/api/elevenlabs-conversation/route.ts`
- ✅ `/api/verify-customer/route.ts`
- ✅ `/api/shopify-customer/route.ts`

---

### Sprint 4: UI de Rate Limit Feedback (1 hora)

#### A. Toast cuando se excede límite

```typescript
// apps/demo/src/components/ClaraVoiceAgent.tsx
const handleStartCall = async () => {
  try {
    const res = await fetch("/api/start-custom-session", {
      method: "POST",
      // ...
    });

    if (res.status === 429) {
      const data = await res.json();
      const retryAfter = data.retryAfter; // seconds

      // Mostrar toast con countdown
      toast.error(
        `Demasiadas sesiones iniciadas. Intenta en ${formatSeconds(retryAfter)}`,
        { duration: retryAfter * 1000 },
      );

      return;
    }

    // ... success flow
  } catch (error) {
    // ...
  }
};
```

#### B. Deshabilitar botón temporalmente

```typescript
const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)

// Después de 429:
setRateLimitedUntil(Date.now() + retryAfter * 1000)

// En button:
<Button
  disabled={rateLimitedUntil && Date.now() < rateLimitedUntil}
  onClick={handleStartCall}
>
  {rateLimitedUntil && Date.now() < rateLimitedUntil
    ? `Espera ${Math.ceil((rateLimitedUntil - Date.now()) / 1000)}s`
    : 'Iniciar Conversación'
  }
</Button>
```

---

## 5. PROTECCIONES ADICIONALES

### A. Global Rate Limit (Anti-DDoS básico)

```typescript
// apps/demo/middleware.ts (agregar antes de auth check)
import { rateLimitByEndpoint } from "./src/lib/rate-limit";

export default auth(async (req) => {
  // Global: 100 requests/min por IP en TODAS las rutas
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const globalLimit = await rateLimit(`global:${ip}`, {
    max: 100,
    windowSec: 60,
  });

  if (!globalLimit.success) {
    return new Response("Too many requests", {
      status: 429,
      headers: {
        "Retry-After": Math.ceil(
          (globalLimit.reset - Date.now()) / 1000,
        ).toString(),
      },
    });
  }

  // ... resto de middleware
});
```

### B. IP Blacklist (Manual)

```typescript
// apps/demo/src/lib/blacklist.ts
import { kv } from "@vercel/kv";

export async function isBlacklisted(ip: string): Promise<boolean> {
  const result = await kv.get(`blacklist:${ip}`);
  return result === "true";
}

export async function blacklistIP(ip: string, durationSec: number = 86400) {
  await kv.set(`blacklist:${ip}`, "true", { ex: durationSec });
}

// En middleware:
if (await isBlacklisted(ip)) {
  return new Response("Forbidden", { status: 403 });
}
```

### C. User-Based Rate Limit (Autenticados)

```typescript
// En API routes con auth:
const session = await auth();
if (session?.user) {
  // Rate limit más estricto por usuario
  const userLimit = await rateLimit(
    `user:${session.user.email}:start-session`,
    {
      max: 3,
      windowSec: 15 * 60,
    },
  );

  if (!userLimit.success) {
    return new Response(
      JSON.stringify({
        error: "User rate limit exceeded",
        message: "Has iniciado demasiadas sesiones. Espera 15 minutos.",
      }),
      { status: 429 },
    );
  }
}
```

---

## 6. MONITORING & ALERTAS

### A. Dashboard de Rate Limits (Opcional)

```typescript
// apps/demo/app/admin/rate-limits/page.tsx
import { kv } from '@vercel/kv'

export default async function RateLimitsDashboard() {
  // Obtener top IPs by request count
  const keys = await kv.keys('ratelimit:*')

  const stats = await Promise.all(
    keys.map(async (key) => {
      const count = await kv.zcard(key) // sliding window count
      return { key, count }
    })
  )

  // Ordenar por count descendente
  const topOffenders = stats
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  return (
    <div>
      <h1>Top Rate Limited IPs</h1>
      <table>
        {topOffenders.map(({ key, count }) => (
          <tr key={key}>
            <td>{key}</td>
            <td>{count} requests</td>
            <td>
              <button onClick={() => blacklistIP(extractIP(key))}>
                Blacklist
              </button>
            </td>
          </tr>
        ))}
      </table>
    </div>
  )
}
```

### B. Alertas Automáticas

```typescript
// apps/demo/app/api/cron/check-abuse/route.ts
import { kv } from "@vercel/kv";
import { sendSlackAlert } from "@/lib/slack"; // implementar

export async function GET() {
  const keys = await kv.keys("ratelimit:*");

  for (const key of keys) {
    const count = await kv.zcard(key);

    // Si un IP tiene >80% del límite → alerta
    if (count > 40) {
      // >80% de 50 limit
      await sendSlackAlert(`🚨 Possible abuse from ${key}: ${count} requests`);
    }
  }

  return Response.json({ checked: keys.length });
}
```

---

## 7. TESTING

### Unit Tests

```typescript
// apps/demo/src/lib/__tests__/rate-limit.test.ts
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  it("allows requests under limit", async () => {
    const result = await rateLimit("test:user1", { max: 5, windowSec: 60 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests over limit", async () => {
    // Send 5 requests (limit)
    for (let i = 0; i < 5; i++) {
      await rateLimit("test:user2", { max: 5, windowSec: 60 });
    }

    // 6th request should fail
    const result = await rateLimit("test:user2", { max: 5, windowSec: 60 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    // TODO: Mock time or use short window
  });
});
```

### Integration Tests

```bash
# Probar endpoint protegido
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/start-custom-session
done

# Request #6 debe retornar 429
```

---

## 8. COSTOS & ESCALABILIDAD

### Vercel KV Hobby (GRATIS)

- **3000 comandos/día**
- Cada rate limit check = ~3-5 comandos (zadd + zcard + zremrangebyscore)
- **Capacidad:** ~600-1000 requests/día protegidas

### Si se excede límite gratuito:

- **Vercel KV Pro:** $10/mes → 100K comandos/día
- **Upstash Redis:** $0.20 per 100K comandos (pay-as-you-go)

### Optimización: Bypass para rutas estáticas

```typescript
// No aplicar rate limit a:
- /_next/* (assets)
- /api/health (monitoring)
- /login (necesario para recovery)
```

---

## 9. MIGRACIÓN PROGRESIVA

### Semana 1: Testing (No blocking)

```typescript
// Log pero no bloquear
const limitResult = await rateLimitByEndpoint(request, endpoint);
if (!limitResult.success) {
  console.warn(`Rate limit exceeded for ${endpoint}`);
  // NO retornar 429, solo log
}
// Continuar normalmente
```

### Semana 2: Enforce en endpoints menos críticos

```typescript
// Bloquear en verify-customer, shopify-customer
// Dejar start-session en warn-only
```

### Semana 3: Enforce en TODOS los endpoints

```typescript
// Full enforcement
```

---

## 10. SIGUIENTE PASO

**Acción requerida:** Aprobar creación de Vercel KV database.

**Orden de implementación:**

1. **Sprint 1:** Setup KV (30 min) - CRÍTICO
2. **Sprint 2:** Middleware (2-3h) - CRÍTICO
3. **Sprint 3:** Integrar en APIs (1-2h) - CRÍTICO
4. **Sprint 4:** UI feedback (1h) - Alta prioridad
5. **Opcional:** Monitoring dashboard (2-3h)

**Total tiempo crítico:** ~4-6 horas

**¿Proceder con Sprint 1?**

---

## 11. CHECKLIST PRE-DEPLOY

- [ ] Vercel KV database creada
- [ ] Env vars configuradas en Vercel
- [ ] Rate limit middleware implementado
- [ ] Todos los endpoints críticos protegidos
- [ ] UI muestra mensajes de error amigables
- [ ] Headers de rate limit incluidos en responses
- [ ] Tests pasando
- [ ] Monitoring configurado
- [ ] Plan de rollback definido (feature flag)

---

## ANEXO: Configuraciones Recomendadas por Endpoint

```typescript
const RATE_LIMITS = {
  // Endpoints de costo alto (HeyGen, ElevenLabs)
  "start-custom-session": {
    ip: { max: 5, windowSec: 900 }, // 5 per 15min
    user: { max: 3, windowSec: 900 }, // 3 per 15min
  },
  "elevenlabs-conversation": {
    ip: { max: 10, windowSec: 3600 }, // 10 per hour
    user: { max: 5, windowSec: 3600 }, // 5 per hour
  },

  // Endpoints de terceros con rate limits (Shopify)
  "verify-customer": {
    ip: { max: 10, windowSec: 300 }, // 10 per 5min
    user: { max: 20, windowSec: 300 }, // 20 per 5min (más permisivo)
  },
  "shopify-customer": {
    ip: { max: 10, windowSec: 300 }, // 10 per 5min
  },

  // Endpoints de bajo costo (auth, etc)
  "auth/signin": {
    ip: { max: 5, windowSec: 300 }, // 5 per 5min (anti brute-force)
  },

  // Global default
  default: {
    ip: { max: 60, windowSec: 60 }, // 60 per minute
  },
};
```
