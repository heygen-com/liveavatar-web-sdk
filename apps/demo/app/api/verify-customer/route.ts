/**
 * Verify Customer Endpoint
 * Checks if a user has purchased from Shopify by their email
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

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
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
