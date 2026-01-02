/**
 * Shopify GraphQL Queries
 * Admin API queries for customer data retrieval
 */

import { BETA_SKINCARE_NAMESPACE } from "./types";

/**
 * Query to find customer by email
 * Used for direct verification flow (when user enters email)
 *
 * Note: On Shopify Basic plan, PII fields (firstName, lastName, email)
 * may return null. We use Liquid template workaround for those.
 */
export const CUSTOMER_BY_EMAIL_QUERY = `
  query customerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          email
          firstName
          lastName
          numberOfOrders
          metafields(first: 10, namespace: "${BETA_SKINCARE_NAMESPACE}") {
            edges {
              node {
                key
                value
                type
              }
            }
          }
          orders(first: 5, reverse: true) {
            edges {
              node {
                name
                createdAt
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                lineItems(first: 10) {
                  edges {
                    node {
                      title
                      quantity
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Query to get customer by ID
 * Used for Shopify iframe flow (when customer_id comes from URL)
 */
export const CUSTOMER_BY_ID_QUERY = `
  query customerById($id: ID!) {
    customer(id: $id) {
      id
      email
      firstName
      lastName
      numberOfOrders
      metafields(first: 10, namespace: "${BETA_SKINCARE_NAMESPACE}") {
        edges {
          node {
            key
            value
            type
          }
        }
      }
      orders(first: 5, reverse: true) {
        edges {
          node {
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            lineItems(first: 10) {
              edges {
                node {
                  title
                  quantity
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Simple query to check if customer exists and has orders
 * Lighter query for quick verification
 */
export const CUSTOMER_EXISTS_QUERY = `
  query customerExists($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          numberOfOrders
        }
      }
    }
  }
`;
