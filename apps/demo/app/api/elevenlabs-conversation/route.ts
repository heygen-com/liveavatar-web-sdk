import { auth } from "@/auth";
import { ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID } from "../secrets";
import { NextRequest } from "next/server";
import { rateLimitByEndpoint } from "@/src/lib/rate-limit";
import {
  verifyCustomerToken,
  isValidCustomerId,
  cleanCustomerId,
} from "@/src/shopify";

export async function POST(request: Request) {
  // === RATE LIMIT CHECK ===
  const limitResult = await rateLimitByEndpoint(
    request as NextRequest,
    "elevenlabs-conversation",
  );

  if (!limitResult.success) {
    return new Response(
      JSON.stringify({
        error: "Too many requests",
        message: "Por favor espera antes de solicitar una nueva conversación",
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
  let agentId = ELEVENLABS_AGENT_ID;
  let shopifyCustomerId: string | undefined;
  let shopifyToken: string | undefined;

  try {
    const body = await request.json();
    if (body.agentId) {
      agentId = body.agentId;
    }
    // Optional Shopify credentials for iframe users
    shopifyCustomerId = body.customer_id;
    shopifyToken = body.shopify_token;
  } catch {
    // No body or invalid JSON, use defaults
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

  console.log("=== ElevenLabs Auth Check ===");
  console.log("session?.user:", !!session?.user);
  console.log("isShopifyUser (HMAC validated):", isShopifyUser);

  if (!session?.user && !isShopifyUser) {
    console.log("UNAUTHORIZED - no session and no valid Shopify HMAC");
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

  console.log("=== ElevenLabs Conversation API Called ===");
  console.log("ELEVENLABS_API_KEY exists:", !!ELEVENLABS_API_KEY);
  console.log("ELEVENLABS_AGENT_ID:", ELEVENLABS_AGENT_ID);

  try {
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs Agent ID not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get signed URL from ElevenLabs Conversational AI API
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      },
    );

    if (!res.ok) {
      const errorData = await res.text();
      console.error("ElevenLabs API error:", errorData);
      return new Response(
        JSON.stringify({
          error: "Failed to get signed URL",
          details: errorData,
        }),
        {
          status: res.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = await res.json();
    console.log("ElevenLabs signed URL obtained successfully");

    return new Response(
      JSON.stringify({
        signedUrl: data.signed_url,
        agentId: agentId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error getting signed URL:", error);
    return new Response(JSON.stringify({ error: "Failed to get signed URL" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
