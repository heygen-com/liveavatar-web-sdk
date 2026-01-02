/**
 * Verify Customer Endpoint
 * Checks if a user has purchased from Shopify by their email
 *
 * NOTE: This endpoint requires Shopify "Shopify" plan or higher for PII access.
 * On Basic plan, returns a specific error directing users to access via Shopify.
 *
 * Flow:
 * 1. Receives email from user (direct entry or Google Sign In)
 * 2. Searches Shopify for customer with that email
 * 3. Verifies they have at least one order
 * 4. Returns customer data for Clara personalization
 *
 * Security: No HMAC needed - validates against Shopify directly
 * Access: Public endpoint (no auth required) - allows anyone to check
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchCustomerByEmail, isShopifyConfigured } from "@/src/shopify";
import type {
  VerifyCustomerRequest,
  VerifyCustomerResponse,
} from "@/src/shopify";
import { rateLimitByEndpoint } from "@/src/lib/rate-limit";

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  // === RATE LIMIT CHECK ===
  const limitResult = await rateLimitByEndpoint(request, "verify-customer");

  if (!limitResult.success) {
    return NextResponse.json(
      {
        error: "Too many requests",
        message: "Demasiados intentos de verificación. Espera un momento.",
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
    // Check if Shopify is configured
    if (!isShopifyConfigured()) {
      console.error("Shopify API not configured");
      return NextResponse.json(
        {
          exists: false,
          hasOrders: false,
          customer: null,
          error: "Service not configured",
        },
        { status: 503 },
      );
    }

    // Parse request body
    const body: VerifyCustomerRequest = await request.json();
    const { email } = body;

    // 1. Validate email format
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        {
          exists: false,
          hasOrders: false,
          customer: null,
          error: "Email is required",
        },
        { status: 400 },
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return NextResponse.json(
        {
          exists: false,
          hasOrders: false,
          customer: null,
          error: "Invalid email format",
        },
        { status: 400 },
      );
    }

    // 2. Search for customer in Shopify
    const shopifyCustomer = await fetchCustomerByEmail(trimmedEmail);

    if (!shopifyCustomer) {
      // Customer not found - no account with this email
      return NextResponse.json({
        exists: false,
        hasOrders: false,
        customer: null,
      });
    }

    // 3. Check if customer has orders
    const hasOrders = shopifyCustomer.numberOfOrders > 0;

    // 4. Build response
    const response: VerifyCustomerResponse = {
      exists: true,
      hasOrders,
      customer: {
        id: shopifyCustomer.id,
        email: shopifyCustomer.email,
        firstName: shopifyCustomer.firstName,
        lastName: shopifyCustomer.lastName,
        ordersCount: shopifyCustomer.numberOfOrders,
        skinType: shopifyCustomer.skinType,
        skinConcerns: shopifyCustomer.skinConcerns,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Verify customer error:", error);

    // Check if it's a Shopify plan limitation error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (
      errorMessage.includes("ACCESS_DENIED") ||
      errorMessage.includes("not approved to access")
    ) {
      // Shopify Basic plan doesn't allow PII access via API
      // Return a specific error code for the frontend
      return NextResponse.json(
        {
          exists: false,
          hasOrders: false,
          customer: null,
          error: "SHOPIFY_PLAN_LIMITED",
          message:
            "Por favor accede a Clara desde tu cuenta en la tienda BetaSkintech",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        exists: false,
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
