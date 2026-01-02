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

  // === AUTH GUARD ===
  // Auth guard - allow both next-auth session AND Shopify-validated requests
  // Shopify users are validated via /api/shopify-customer before reaching here
  // We check for either: next-auth session OR a custom header set by the client
  const session = await auth();
  const isShopifyUser = request.headers.get("x-shopify-validated") === "true";

  if (!session?.user && !isShopifyUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let session_token = "";
  let session_id = "";

  // Parse request body to get device type
  let deviceType: "mobile" | "desktop" = "desktop";
  try {
    const body = await request.json();
    if (body.deviceType === "mobile") {
      deviceType = "mobile";
    }
  } catch {
    // No body or invalid JSON, use default (desktop)
  }

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
