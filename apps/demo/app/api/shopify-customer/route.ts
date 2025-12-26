/**
 * Shopify Customer Validation Endpoint
 * Validates HMAC token and returns customer data
 *
 * Flow:
 * 1. Receives customer_id + shopify_token from Shopify iframe URL params
 * 2. Validates HMAC signature (prevents spoofing)
 * 3. Fetches customer data from Shopify Admin API
 * 4. Returns merged customer data for Clara personalization
 *
 * Security: Uses timing-safe HMAC comparison
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyCustomerToken,
  isValidCustomerId,
  cleanCustomerId,
  fetchCustomerById,
  isShopifyConfigured,
} from "@/src/shopify";
import type {
  ShopifyCustomerRequest,
  ShopifyCustomerResponse,
} from "@/src/shopify";

export async function POST(request: NextRequest) {
  try {
    // Check if Shopify is configured
    if (!isShopifyConfigured()) {
      console.error("Shopify API not configured");
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

    // 4. Fetch customer from Shopify API
    const shopifyCustomer = await fetchCustomerById(cleanId);

    if (!shopifyCustomer) {
      return NextResponse.json(
        {
          valid: false,
          hasOrders: false,
          customer: null,
          error: "Customer not found",
        },
        { status: 404 },
      );
    }

    // 5. Merge PII from URL params (Liquid) with API data
    // On Shopify Basic plan, API may return null for PII fields
    const response: ShopifyCustomerResponse = {
      valid: true,
      hasOrders: shopifyCustomer.numberOfOrders > 0,
      customer: {
        id: cleanId,
        // Prefer Liquid data for PII (more reliable on Basic plan)
        email: email || shopifyCustomer.email,
        firstName: first_name || shopifyCustomer.firstName,
        lastName: last_name || shopifyCustomer.lastName,
        ordersCount: orders_count
          ? parseInt(orders_count, 10)
          : shopifyCustomer.numberOfOrders,
        // API data for non-PII
        skinType: shopifyCustomer.skinType,
        skinConcerns: shopifyCustomer.skinConcerns,
        recentOrders: shopifyCustomer.recentOrders,
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
