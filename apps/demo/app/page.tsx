"use client";

import { useState, useEffect } from "react";
import { LiveAvatarDemo } from "../src/components/LiveAvatarDemo";
import ClaraWidget from "../src/components/ClaraWidget";
import ClaraVoiceAgent from "../src/components/ClaraVoiceAgent";
import { CustomerData } from "../src/liveavatar/types";

type DemoMode = "clara" | "clara-agent" | "original" | null;

export default function Home() {
  // Default to "clara-agent" (ClaraVoiceAgent) as the primary experience
  const [mode, setMode] = useState<DemoMode>("clara-agent");
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
    if (
      demoMode === "clara" ||
      demoMode === "clara-agent" ||
      demoMode === "original"
    ) {
      setMode(demoMode);
    } else if (demoMode === "select") {
      // Show mode selector
      setMode(null);
    }
    // If no mode param and default is set, keep the default (clara-agent)
  }, []);

  // Mode selection screen
  if (mode === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">
            Live Avatar Web SDK Demo
          </h1>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Clara Widget Option */}
            <button
              onClick={() => setMode("clara")}
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 text-left border border-slate-200 hover:border-purple-300"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="text-2xl text-white">AI</span>
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Clara FULL
              </h2>
              <p className="text-slate-600 text-sm">
                HeyGen&apos;s built-in STT, LLM, and TTS pipeline with
                voice-first interaction and visual feedback.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                  HeyGen Pipeline
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  Voice-first
                </span>
              </div>
            </button>

            {/* Clara Voice Agent Option (Recommended) */}
            <button
              onClick={() => setMode("clara-agent")}
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 text-left border-2 border-indigo-300 hover:border-indigo-500 relative"
            >
              {/* Recommended badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 text-white text-xs font-medium rounded-full">
                Recommended
              </div>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="text-2xl text-white">VA</span>
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Clara Voice Agent
              </h2>
              <p className="text-slate-600 text-sm">
                ElevenLabs Conversational AI with built-in VAD, STT, LLM and
                TTS. Ultra-low latency (&lt;1s response).
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                  ElevenLabs
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  VAD Included
                </span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                  &lt;1s Latency
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
            <code className="bg-slate-200 px-1 rounded">?mode=clara</code>,{" "}
            <code className="bg-slate-200 px-1 rounded">?mode=clara-agent</code>
            , or{" "}
            <code className="bg-slate-200 px-1 rounded">?mode=original</code> to
            skip this screen
          </p>
        </div>
      </div>
    );
  }

  // Clara Widget mode (FULL - HeyGen pipeline)
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

  // Clara Voice Agent mode (ElevenLabs Conversational AI)
  if (mode === "clara-agent") {
    return (
      <div className="min-h-screen">
        {/* Back button */}
        <button
          onClick={() => setMode(null)}
          className="fixed top-4 right-4 z-50 bg-white/80 backdrop-blur-sm text-slate-700 px-4 py-2 rounded-lg shadow-md hover:bg-white transition-colors text-sm"
        >
          &larr; Back to Selection
        </button>
        <ClaraVoiceAgent userName={userName} customerData={customerData} />
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
