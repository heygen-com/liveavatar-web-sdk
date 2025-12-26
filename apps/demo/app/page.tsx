"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import ClaraVoiceAgent from "../src/components/ClaraVoiceAgent";
import CustomerVerification from "../src/components/CustomerVerification";
import { CustomerData } from "../src/liveavatar/types";
import { UserMenu } from "../src/components/auth/LogoutButton";
import type {
  ShopifyCustomerResponse,
  VerifyCustomerResponse,
} from "@/src/shopify";

type PageState =
  | "loading"
  | "verifying_shopify"
  | "verifying_session"
  | "needs_verification"
  | "verified"
  | "error";

export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Verify customer via Shopify API (for users coming from Shopify iframe)
  const verifyShopifyCustomer = useCallback(async (params: URLSearchParams) => {
    setPageState("verifying_shopify");

    try {
      const response = await fetch("/api/shopify-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: params.get("customer_id"),
          shopify_token: params.get("shopify_token"),
          first_name: params.get("first_name"),
          last_name: params.get("last_name"),
          email: params.get("email"),
          orders_count: params.get("orders_count"),
        }),
      });

      const data: ShopifyCustomerResponse = await response.json();

      if (!response.ok || !data.valid) {
        throw new Error(data.error || "Invalid Shopify token");
      }

      if (!data.hasOrders) {
        setError("Debes realizar una compra para acceder a Clara");
        setPageState("error");
        return;
      }

      if (data.customer) {
        setCustomerData({
          firstName: data.customer.firstName || undefined,
          lastName: data.customer.lastName || undefined,
          email: data.customer.email || undefined,
          ordersCount: data.customer.ordersCount,
          skinType: data.customer.skinType as CustomerData["skinType"],
          skinConcerns: data.customer.skinConcerns,
        });
        setPageState("verified");
      }
    } catch (err) {
      console.error("Shopify verification error:", err);
      setError(err instanceof Error ? err.message : "Error de verificacion");
      setPageState("error");
    }
  }, []);

  // Verify customer via email (for users with session)
  const verifySessionEmail = useCallback(async (email: string) => {
    setPageState("verifying_session");

    try {
      const response = await fetch("/api/verify-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data: VerifyCustomerResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error verifying customer");
      }

      if (!data.exists || !data.hasOrders) {
        // User has Google session but hasn't purchased
        // Show verification screen so they can try another email
        setPageState("needs_verification");
        return;
      }

      if (data.customer) {
        setCustomerData({
          firstName: data.customer.firstName || undefined,
          lastName: data.customer.lastName || undefined,
          email: data.customer.email || undefined,
          ordersCount: data.customer.ordersCount,
          skinType: data.customer.skinType as CustomerData["skinType"],
          skinConcerns: data.customer.skinConcerns,
        });
        setPageState("verified");
      }
    } catch (err) {
      console.error("Session verification error:", err);
      // On error, let user try manual verification
      setPageState("needs_verification");
    }
  }, []);

  // Main effect to handle page load and determine flow
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    // Flow A: User coming from Shopify iframe with token
    if (params.has("shopify_token") && params.has("customer_id")) {
      verifyShopifyCustomer(params);
      return;
    }

    // Flow B: Check URL params for direct customer data (legacy support)
    const firstName = params.get("first_name");
    const skinType = params.get("skin_type");
    const skinConcerns = params.get("skin_concerns");

    if (firstName || skinType || skinConcerns) {
      // Direct URL params without Shopify token - set data directly
      setCustomerData({
        firstName: firstName || undefined,
        lastName: params.get("last_name") || undefined,
        email: params.get("email") || undefined,
        ordersCount: params.get("orders_count")
          ? parseInt(params.get("orders_count")!, 10)
          : undefined,
        skinType: (skinType as CustomerData["skinType"]) || undefined,
        skinConcerns: skinConcerns
          ? skinConcerns.split(",").map((s) => s.trim())
          : undefined,
      });
      setPageState("verified");
      return;
    }

    // Flow C: Check session status
    if (sessionStatus === "loading") {
      setPageState("loading");
      return;
    }

    if (session?.user?.email) {
      // User has session - verify their email against Shopify
      verifySessionEmail(session.user.email);
      return;
    }

    // Flow D: No session, no Shopify token - show verification form
    // Note: middleware redirects to /login if no session and no shopify_token
    // This state shouldn't normally be reached unless middleware allows it
    setPageState("needs_verification");
  }, [session, sessionStatus, verifyShopifyCustomer, verifySessionEmail]);

  // Handle successful verification from CustomerVerification component
  const handleVerified = (data: CustomerData) => {
    setCustomerData(data);
    setPageState("verified");
  };

  // Loading state
  if (
    pageState === "loading" ||
    pageState === "verifying_shopify" ||
    pageState === "verifying_session"
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg animate-pulse">
            <span className="text-2xl font-bold text-white">C</span>
          </div>
          <p className="text-gray-500">
            {pageState === "verifying_shopify"
              ? "Verificando desde Shopify..."
              : pageState === "verifying_session"
                ? "Verificando tu cuenta..."
                : "Cargando..."}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Error de verificacion
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => (window.location.href = "/login")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // Needs verification - show CustomerVerification component
  if (pageState === "needs_verification") {
    return <CustomerVerification onVerified={handleVerified} />;
  }

  // Verified - show Clara
  return (
    <div className="min-h-screen">
      {/* User menu for logout */}
      <div className="fixed top-4 right-4 z-50">
        <UserMenu />
      </div>
      <ClaraVoiceAgent
        userName={customerData?.firstName || session?.user?.name || null}
        customerData={customerData}
      />
    </div>
  );
}
