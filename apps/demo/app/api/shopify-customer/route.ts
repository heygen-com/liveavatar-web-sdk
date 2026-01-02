/**
 * Shopify Customer Validation Endpoint
 * Validates HMAC token and returns customer data from Liquid template params
 *
 * Flow:
 * 1. Receives customer_id + shopify_token + PII from Shopify iframe URL params
 * 2. Validates HMAC signature (prevents spoofing)
 * 3. Returns customer data directly (no API call needed - Liquid provides all data)
 *
 * Security: Uses timing-safe HMAC comparison
 * Note: Works on all Shopify plans (no Admin API required)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyCustomerToken,
  isValidCustomerId,
  cleanCustomerId,
  isHmacConfigured,
} from "@/src/shopify";
import type {
  ShopifyCustomerRequest,
  ShopifyCustomerResponse,
} from "@/src/shopify";
import { rateLimitByEndpoint } from "@/src/lib/rate-limit";
import { getCachedCustomer, cacheCustomer } from "@/src/lib/db/queries";

export async function POST(request: NextRequest) {
  // === RATE LIMIT CHECK ===
  const limitResult = await rateLimitByEndpoint(request, "shopify-customer");

  if (!limitResult.success) {
    return NextResponse.json(
      {
        valid: false,
        hasOrders: false,
        customer: null,
        error: "Too many requests",
        message: "Demasiados intentos. Espera un momento antes de reintentar.",
        retryAfter: Math.ceil((limitResult.reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
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

  try {
    // Check if HMAC secret is configured
    if (!isHmacConfigured()) {
      console.error("SHOPIFY_HMAC_SECRET not configured");
      return NextResponse.json(
        {
          valid: false,
          hasOrders: false,
          customer: null,
          error: "Service not configured",
        },
        { status: 503 },
      );
    }

    // Parse request body
    const body: ShopifyCustomerRequest = await request.json();
    const {
      customer_id,
      shopify_token,
      first_name,
      last_name,
      email,
      orders_count,
    } = body;

    // === DATABASE CACHE CHECK ===
    // Try to get cached customer data to avoid HMAC validation + processing
    if (email) {
      try {
        const cached = await getCachedCustomer(email);
        if (cached) {
          console.log("[CACHE HIT] Returning cached customer data for:", email);
          return NextResponse.json({
            valid: true,
            hasOrders: (cached.ordersCount || 0) > 0,
            customer: {
              id: cached.shopifyId || customer_id,
              email: cached.shopifyEmail,
              firstName: cached.firstName,
              lastName: cached.lastName,
              ordersCount: cached.ordersCount || 0,
              skinType: cached.skinType,
              skinConcerns: cached.skinConcerns,
            },
          });
        }
        console.log("[CACHE MISS] No cache found for:", email);
      } catch (cacheError) {
        // Cache read failed - continue with normal flow
        console.error("[CACHE ERROR]", cacheError);
      }
    }

    // 1. Validate required fields
    if (!customer_id || !shopify_token) {
      return NextResponse.json(
        {
          valid: false,
          hasOrders: false,
          customer: null,
          error: "Missing required fields",
        },
        { status: 400 },
      );
    }

    // 2. Validate customer_id format
    const cleanId = cleanCustomerId(customer_id);
    if (!isValidCustomerId(cleanId)) {
      return NextResponse.json(
        {
          valid: false,
          hasOrders: false,
          customer: null,
          error: "Invalid customer_id format",
        },
        { status: 400 },
      );
    }

    // 3. Verify HMAC token (timing-safe)
    if (!verifyCustomerToken(shopify_token, cleanId)) {
      console.warn(`Invalid HMAC token for customer ${cleanId}`);
      return NextResponse.json(
        {
          valid: false,
          hasOrders: false,
          customer: null,
          error: "Invalid token",
        },
        { status: 401 },
      );
    }

    // 4. HMAC is valid - trust the data from Liquid template
    // No API call needed - Liquid has full access to customer data on all plans
    const ordersCountNum = orders_count ? parseInt(orders_count, 10) : 0;
    const hasOrders = ordersCountNum > 0;

    const response: ShopifyCustomerResponse = {
      valid: true,
      hasOrders,
      customer: {
        id: cleanId,
        email: email || null,
        firstName: first_name || null,
        lastName: last_name || null,
        ordersCount: ordersCountNum,
        // Note: skinType and skinConcerns require metafields in Liquid template
        // Can be added to the iframe URL later if needed
      },
    };

    // === DATABASE CACHE WRITE ===
    // Cache validated customer data (24 hour TTL)
    if (email) {
      try {
        await cacheCustomer({
          shopifyEmail: email,
          shopifyId: cleanId,
          firstName: first_name || undefined,
          lastName: last_name || undefined,
          ordersCount: ordersCountNum,
        });
        console.log("[CACHE WRITE] Cached customer data for:", email);
      } catch (cacheError) {
        // Cache write failed - don't fail the request
        console.error("[CACHE WRITE ERROR]", cacheError);
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Shopify customer validation error:", error);
    return NextResponse.json(
      {
        valid: false,
        hasOrders: false,
        customer: null,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
