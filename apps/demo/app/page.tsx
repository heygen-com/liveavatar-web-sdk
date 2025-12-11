"use client";

import { useState, useEffect } from "react";
import { LiveAvatarDemo } from "../src/components/LiveAvatarDemo";
import ClaraWidget from "../src/components/ClaraWidget";
import { CustomerData } from "../src/liveavatar/types";

type DemoMode = "clara" | "original" | null;

export default function Home() {
  const [mode, setMode] = useState<DemoMode>(null);
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

    // Auto-select mode from URL
    const demoMode = params.get("mode");
    if (demoMode === "clara" || demoMode === "original") {
      setMode(demoMode);
    }
  }, []);

  // Mode selection screen
  if (mode === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">
            Live Avatar Web SDK Demo
          </h1>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Clara Widget Option */}
            <button
              onClick={() => setMode("clara")}
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 text-left border border-slate-200 hover:border-purple-300"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="text-2xl text-white">AI</span>
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Clara Widget
              </h2>
              <p className="text-slate-600 text-sm">
                Modern glassmorphism UI with voice-first interaction, visual
                feedback indicators, and personalization support.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                  Glassmorphism
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  Voice-first
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Responsive
                </span>
              </div>
            </button>

            {/* Original Demo Option */}
            <button
              onClick={() => setMode("original")}
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 text-left border border-slate-200 hover:border-slate-400"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="text-2xl text-white">SDK</span>
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Original Demo
              </h2>
              <p className="text-slate-600 text-sm">
                Standard SDK demonstration with all controls exposed. Supports
                both FULL and CUSTOM modes.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full">
                  Full Controls
                </span>
                <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full">
                  FULL Mode
                </span>
                <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full">
                  CUSTOM Mode
                </span>
              </div>
            </button>
          </div>

          {/* URL params hint */}
          <p className="text-center text-slate-500 text-sm mt-8">
            Tip: Add{" "}
            <code className="bg-slate-200 px-1 rounded">?mode=clara</code> or{" "}
            <code className="bg-slate-200 px-1 rounded">?mode=original</code> to
            skip this screen
          </p>
        </div>
      </div>
    );
  }

  // Clara Widget mode
  if (mode === "clara") {
    return (
      <div className="min-h-screen">
        {/* Back button */}
        <button
          onClick={() => setMode(null)}
          className="fixed top-4 right-4 z-50 bg-white/80 backdrop-blur-sm text-slate-700 px-4 py-2 rounded-lg shadow-md hover:bg-white transition-colors text-sm"
        >
          &larr; Back to Selection
        </button>
        <ClaraWidget userName={userName} customerData={customerData} />
      </div>
    );
  }

  // Original demo mode
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Back button */}
      <button
        onClick={() => setMode(null)}
        className="fixed top-4 right-4 z-50 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-md hover:bg-white/20 transition-colors text-sm"
      >
        &larr; Back to Selection
      </button>
      <LiveAvatarDemo />
    </div>
  );
}
