"use client";

import { useState, useEffect } from "react";
import ClaraVoiceAgent from "../src/components/ClaraVoiceAgent";
import { CustomerData } from "../src/liveavatar/types";
import { UserMenu } from "../src/components/auth/LogoutButton";

export default function Home() {
  const [userName, setUserName] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);

  // Check URL params for personalization data
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    // Check for customer data in URL params
    const firstName = params.get("first_name");
    const lastName = params.get("last_name");
    const email = params.get("email");
    const ordersCount = params.get("orders_count");

    if (firstName || lastName || email) {
      setCustomerData({
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: email || undefined,
        ordersCount: ordersCount ? parseInt(ordersCount, 10) : undefined,
      });
    }

    // Check for simple userName
    const name = params.get("name") || params.get("userName");
    if (name) {
      setUserName(name);
    }

    // Check localStorage fallback
    if (!firstName && !name) {
      const storedName = localStorage.getItem("clara_user_name");
      if (storedName) {
        setUserName(storedName);
      }
    }
  }, []);

  return (
    <div className="min-h-screen">
      {/* User menu for logout */}
      <div className="fixed top-4 right-4 z-50">
        <UserMenu />
      </div>
      <ClaraVoiceAgent userName={userName} customerData={customerData} />
    </div>
  );
}
