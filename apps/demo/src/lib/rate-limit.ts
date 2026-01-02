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
      const oldestTimestamp = (await kv.zrange(key, 0, 0, {
        withScores: true,
      })) as [string, number];
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
