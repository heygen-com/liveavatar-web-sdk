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

export async function POST(request: NextRequest) {
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
