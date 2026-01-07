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
      console.log("[AUTH] Valid Shopify HMAC for customer:", cleanId);
    } else {
      console.warn("[AUTH] Invalid Shopify HMAC attempt for:", cleanId);
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
  console.log(
    "Starting CUSTOM session with avatar:",
    avatarId,
    "deviceType:",
    deviceType,
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
    console.log(data);

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
    console.log(
      "[DB] Session tracked:",
      session_token,
      "Device:",
      deviceType,
      "User:",
      session?.user?.email || "anonymous",
    );
  } catch (dbError) {
    // Don't fail the request if DB tracking fails - just log it
    console.error("[DB] Failed to track session:", dbError);
  }

  return new Response(JSON.stringify({ session_token, session_id }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
