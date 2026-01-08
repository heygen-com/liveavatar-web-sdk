import { auth } from "@/auth";
import {
  API_KEY,
  API_URL,
  AVATAR_ID_MOBILE,
  AVATAR_ID_DESKTOP,
} from "../secrets";
import { NextRequest } from "next/server";
import { rateLimitByEndpoint } from "@/src/lib/rate-limit";
import { createSession } from "@/src/lib/db/queries";
import {
  verifyCustomerToken,
  isValidCustomerId,
  cleanCustomerId,
} from "@/src/shopify";
import { logger } from "@/src/lib/logger/secure-logger";

export async function POST(request: Request) {
  // === RATE LIMIT CHECK ===
  // Cast to NextRequest for rate limiting (headers are compatible)
  const limitResult = await rateLimitByEndpoint(
    request as NextRequest,
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

  // === PARSE REQUEST BODY ===
  let deviceType: "mobile" | "desktop" = "desktop";
  let shopifyCustomerId: string | undefined;
  let shopifyToken: string | undefined;

  try {
    const body = await request.json();
    if (body.deviceType === "mobile") {
      deviceType = "mobile";
    }
    // Optional Shopify credentials for iframe users
    shopifyCustomerId = body.customer_id;
    shopifyToken = body.shopify_token;
  } catch {
    // No body or invalid JSON, use default (desktop)
  }

  // === AUTH GUARD ===
  // Allow either:
  // 1. NextAuth session (Google/Credentials login)
  // 2. Valid Shopify HMAC token (iframe users)
  const session = await auth();
  let isShopifyUser = false;

  // Validate Shopify credentials if provided
  if (shopifyCustomerId && shopifyToken) {
    const cleanId = cleanCustomerId(shopifyCustomerId);
    if (
      isValidCustomerId(cleanId) &&
      verifyCustomerToken(shopifyToken, cleanId)
    ) {
      isShopifyUser = true;
      logger.info(
        "Valid Shopify HMAC",
        { customerId: cleanId },
        { route: "/api/start-custom-session" },
      );
    } else {
      logger.warn(
        "Invalid Shopify HMAC attempt",
        { customerId: cleanId },
        { route: "/api/start-custom-session" },
      );
    }
  }

  if (!session?.user && !isShopifyUser) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Valid session or Shopify credentials required",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let session_token = "";
  let session_id = "";

  // Select avatar based on device type
  const avatarId =
    deviceType === "desktop" ? AVATAR_ID_DESKTOP : AVATAR_ID_MOBILE;
  logger.info(
    "Starting CUSTOM session",
    { avatarId, deviceType },
    { route: "/api/start-custom-session" },
  );

  try {
    const res = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "CUSTOM",
        avatar_id: avatarId,
      }),
    });
    if (!res.ok) {
      const error = await res.json();
      if (error.error) {
        const resp = await res.json();
        const errorMessage =
          resp.data[0].message ?? "Failed to retrieve session token";
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: res.status,
        });
      }

      return new Response(
        JSON.stringify({ error: "Failed to retrieve session token" }),
        {
          status: res.status,
        },
      );
    }
    const data = await res.json();
    logger.debug("Session token received", data, {
      route: "/api/start-custom-session",
    });

    session_token = data.data.session_token;
    session_id = data.data.session_id;
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
    });
  }

  if (!session_token) {
    return new Response(
      JSON.stringify({ error: "Failed to retrieve session token" }),
      {
        status: 500,
      },
    );
  }

  // === DATABASE TRACKING ===
  // Track session in database for analytics
  try {
    await createSession({
      sessionToken: session_token,
      deviceType,
      userId: session?.user?.id,
      shopifyEmail: session?.user?.email || undefined,
    });
    logger.info(
      "Session tracked in database",
      {
        sessionToken: session_token,
        deviceType,
        userEmail: session?.user?.email || "anonymous",
      },
      { route: "/api/start-custom-session" },
    );
  } catch (dbError) {
    // Don't fail the request if DB tracking fails - just log it
    logger.error("Failed to track session in database", dbError, {
      route: "/api/start-custom-session",
    });
  }

  return new Response(JSON.stringify({ session_token, session_id }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
