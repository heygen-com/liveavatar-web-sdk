import crypto from "crypto";

export interface MockCustomer {
  customer_id: string;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  shopify_token: string;
  last_order_date?: string;
  last_product?: string;
  skin_type?: string;
  skin_concerns?: string[];
}

/**
 * Generate HMAC token for mock testing
 * Uses same algorithm as Shopify Liquid: customer_id | hmac_sha256: secret
 */
function generateMockToken(customerId: string): string {
  const secret = process.env.SHOPIFY_HMAC_SECRET;

  if (!secret) {
    console.warn("SHOPIFY_HMAC_SECRET not configured, using test token");
    return "mock_token_" + customerId;
  }

  return crypto
    .createHmac("sha256", secret)
    .update(customerId)
    .digest("hex");
}

/**
 * Mock customers for testing different scenarios
 * Use query param: ?mock=valid_customer
 */
export const MOCK_CUSTOMERS: Record<string, MockCustomer> = {
  // ✅ Valid customer with orders (ACCESS GRANTED)
  valid_customer: {
    customer_id: "7890123456",
    email: "maria.gonzalez@ejemplo.com",
    first_name: "María",
    last_name: "González",
    orders_count: 3,
    last_order_date: "2024-12-15",
    last_product: "Hydrating Serum",
    skin_type: "dry",
    skin_concerns: ["sensitivity", "aging"],
    shopify_token: generateMockToken("7890123456"),
  },

  // ❌ Customer without orders (ACCESS DENIED - no_orders)
  no_orders_customer: {
    customer_id: "1234567890",
    email: "juan.perez@ejemplo.com",
    first_name: "Juan",
    last_name: "Pérez",
    orders_count: 0,
    shopify_token: generateMockToken("1234567890"),
  },

  // ❌ Invalid token (ACCESS DENIED - invalid_token)
  invalid_token_customer: {
    customer_id: "5555555555",
    email: "fake@ejemplo.com",
    first_name: "Fake",
    last_name: "User",
    orders_count: 5,
    shopify_token: "invalid_token_abc123_this_will_fail_verification",
  },

  // ✅ VIP customer with many orders
  vip_customer: {
    customer_id: "9999999999",
    email: "vip.cliente@ejemplo.com",
    first_name: "Ana",
    last_name: "Martínez",
    orders_count: 15,
    last_order_date: "2025-01-05",
    last_product: "Anti-Aging Night Cream",
    skin_type: "combination",
    skin_concerns: ["aging", "hyperpigmentation"],
    shopify_token: generateMockToken("9999999999"),
  },
};

/**
 * Get mock customer data by scenario name
 */
export function getMockCustomer(scenario: string): MockCustomer | null {
  return MOCK_CUSTOMERS[scenario] || null;
}

/**
 * Build mock URL params for testing
 * Usage: /demo?mock=valid_customer
 */
export function buildMockParams(scenario: string): URLSearchParams {
  const customer = getMockCustomer(scenario);

  if (!customer) {
    throw new Error(`Mock scenario "${scenario}" not found`);
  }

  const params = new URLSearchParams({
    customer_id: customer.customer_id,
    shopify_token: customer.shopify_token,
    email: customer.email,
    first_name: customer.first_name,
    last_name: customer.last_name,
    orders_count: customer.orders_count.toString(),
  });

  if (customer.last_order_date) {
    params.set("last_order_date", customer.last_order_date);
  }
  if (customer.last_product) {
    params.set("last_product", customer.last_product);
  }
  if (customer.skin_type) {
    params.set("skin_type", customer.skin_type);
  }

  return params;
}

/**
 * Check if current URL is using mock data
 */
export function isMockMode(searchParams: URLSearchParams): boolean {
  return searchParams.has("mock");
}

/**
 * Get mock scenario from URL
 */
export function getMockScenario(searchParams: URLSearchParams): string | null {
  return searchParams.get("mock");
}
