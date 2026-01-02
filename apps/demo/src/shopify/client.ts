/**
 * Shopify Admin API Client
 * GraphQL client for fetching customer data from Shopify
 */

import {
  SHOPIFY_STORE_DOMAIN,
  SHOPIFY_ADMIN_ACCESS_TOKEN,
} from "@/app/api/secrets";
import { CUSTOMER_BY_EMAIL_QUERY, CUSTOMER_BY_ID_QUERY } from "./queries";
import {
  ShopifyCustomer,
  ShopifyCustomerNode,
  ShopifyCustomersResponse,
  ShopifyCustomerByIdResponse,
  ShopifyOrder,
  SKIN_TYPE_KEY,
  SKIN_CONCERNS_KEY,
} from "./types";

// Shopify Admin API URL (2024-01 version)
const SHOPIFY_API_VERSION = "2024-01";
const getShopifyApiUrl = () =>
  `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

/**
 * Execute a GraphQL query against Shopify Admin API
 */
async function shopifyGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
    throw new Error("Shopify API credentials not configured");
  }

  const response = await fetch(getShopifyApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error("Shopify GraphQL errors:", result.errors);
    throw new Error(`Shopify GraphQL error: ${result.errors[0]?.message}`);
  }

  return result.data;
}

/**
 * Transform raw Shopify customer node to our ShopifyCustomer type
 */
function transformCustomerNode(node: ShopifyCustomerNode): ShopifyCustomer {
  // Extract metafields
  const metafields = node.metafields.edges.reduce(
    (acc, { node: mf }) => {
      acc[mf.key] = mf.value;
      return acc;
    },
    {} as Record<string, string>,
  );

  // Parse skin concerns (stored as JSON array in metafield)
  let skinConcerns: string[] | undefined;
  if (metafields[SKIN_CONCERNS_KEY]) {
    try {
      const parsed = JSON.parse(metafields[SKIN_CONCERNS_KEY]);
      skinConcerns = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // If not JSON, treat as comma-separated
      skinConcerns = metafields[SKIN_CONCERNS_KEY].split(",").map((s) =>
        s.trim(),
      );
    }
  }

  // Transform orders
  const recentOrders: ShopifyOrder[] = node.orders.edges.map(
    ({ node: order }) => ({
      name: order.name,
      createdAt: order.createdAt,
      items: order.lineItems.edges.map(({ node: item }) => item.title),
      totalAmount: order.totalPriceSet?.shopMoney.amount,
      currencyCode: order.totalPriceSet?.shopMoney.currencyCode,
    }),
  );

  return {
    id: node.id.replace("gid://shopify/Customer/", ""),
    email: node.email,
    firstName: node.firstName,
    lastName: node.lastName,
    numberOfOrders: node.numberOfOrders,
    skinType: metafields[SKIN_TYPE_KEY],
    skinConcerns,
    recentOrders,
  };
}

/**
 * Fetch customer by email
 * Used for direct verification flow
 */
export async function fetchCustomerByEmail(
  email: string,
): Promise<ShopifyCustomer | null> {
  try {
    const data = await shopifyGraphQL<ShopifyCustomersResponse>(
      CUSTOMER_BY_EMAIL_QUERY,
      { query: `email:${email}` },
    );

    const customerEdge = data.customers.edges[0];
    if (!customerEdge) {
      return null;
    }

    return transformCustomerNode(customerEdge.node);
  } catch (error) {
    console.error("Error fetching customer by email:", error);
    throw error;
  }
}

/**
 * Fetch customer by ID
 * Used for Shopify iframe flow (with HMAC validation)
 */
export async function fetchCustomerById(
  customerId: string,
): Promise<ShopifyCustomer | null> {
  try {
    // Ensure proper GID format
    const gid = customerId.startsWith("gid://")
      ? customerId
      : `gid://shopify/Customer/${customerId}`;

    const data = await shopifyGraphQL<ShopifyCustomerByIdResponse>(
      CUSTOMER_BY_ID_QUERY,
      { id: gid },
    );

    if (!data.customer) {
      return null;
    }

    return transformCustomerNode(data.customer);
  } catch (error) {
    console.error("Error fetching customer by ID:", error);
    throw error;
  }
}

/**
 * Check if Shopify is properly configured
 */
export function isShopifyConfigured(): boolean {
  return Boolean(SHOPIFY_STORE_DOMAIN && SHOPIFY_ADMIN_ACCESS_TOKEN);
}
