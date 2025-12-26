/**
 * Shopify Integration Types
 * Types for customer data, orders, and API responses
 */

// ============================================================================
// Shopify GraphQL Response Types
// ============================================================================

export interface ShopifyMetafieldNode {
  key: string;
  value: string;
  type: string;
}

export interface ShopifyLineItemNode {
  title: string;
  quantity: number;
}

export interface ShopifyOrderNode {
  name: string;
  createdAt: string;
  totalPriceSet?: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  lineItems: {
    edges: Array<{ node: ShopifyLineItemNode }>;
  };
}

export interface ShopifyCustomerNode {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  numberOfOrders: number;
  metafields: {
    edges: Array<{ node: ShopifyMetafieldNode }>;
  };
  orders: {
    edges: Array<{ node: ShopifyOrderNode }>;
  };
}

export interface ShopifyCustomersResponse {
  customers: {
    edges: Array<{ node: ShopifyCustomerNode }>;
  };
}

export interface ShopifyCustomerByIdResponse {
  customer: ShopifyCustomerNode | null;
}

// ============================================================================
// Processed Customer Data Types
// ============================================================================

export interface ShopifyCustomer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  numberOfOrders: number;
  skinType?: string;
  skinConcerns?: string[];
  recentOrders: ShopifyOrder[];
}

export interface ShopifyOrder {
  name: string;
  createdAt: string;
  items: string[];
  totalAmount?: string;
  currencyCode?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ShopifyCustomerRequest {
  customer_id: string;
  shopify_token: string;
  // Optional PII data from Liquid template (URL params)
  first_name?: string;
  last_name?: string;
  email?: string;
  orders_count?: string;
}

export interface VerifyCustomerRequest {
  email: string;
}

export interface ShopifyCustomerResponse {
  valid: boolean;
  hasOrders: boolean;
  customer: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    ordersCount: number;
    skinType?: string;
    skinConcerns?: string[];
    recentOrders?: ShopifyOrder[];
  } | null;
  error?: string;
}

export interface VerifyCustomerResponse {
  exists: boolean;
  hasOrders: boolean;
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    ordersCount: number;
    skinType?: string;
    skinConcerns?: string[];
  } | null;
  error?: string;
}

// ============================================================================
// Metafield Constants
// ============================================================================

export const BETA_SKINCARE_NAMESPACE = "beta_skincare";
export const SKIN_TYPE_KEY = "skin_type";
export const SKIN_CONCERNS_KEY = "skin_concerns";
