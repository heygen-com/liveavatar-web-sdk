import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const API_URL = (process.env.API_URL || "https://api.liveavatar.com").replace(/\/$/, "");
    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    const AVATAR_ID = process.env.AVATAR_ID;
    const VOICE_ID = process.env.VOICE_ID;

    if (!HEYGEN_API_KEY || !AVATAR_ID) {
      return NextResponse.json(
        { error: "Missing required env vars", hasKey: !!HEYGEN_API_KEY, hasAvatar: !!AVATAR_ID },
        { status: 500 }
      );
    }

    const res = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": HEYGEN_API_KEY,
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id: AVATAR_ID,
        avatar_persona: {
          voice_id: VOICE_ID,
          language: "en",
          prompt: "You are a helpful assistant.",
        },
      }),
    });

    const text = await res.text();

    // 🚨 GUARANTEE JSON
    if (!res.ok) {
      return NextResponse.json(
        {
          error: "HeyGen token request failed",
          status: res.status,
          body: text || "(empty)",
        },
        { status: 500 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "HeyGen returned empty response" },
        { status: 500 }
      );
    }

    const data = JSON.parse(text);

    return NextResponse.json({
      sessionAccessToken: data.sessionAccessToken || data.access_token,
      sessionId: data.sessionId || null,
    });

  } catch (err: any) {
    // 🚨 ABSOLUTE SAFETY NET
    return NextResponse.json(
      { error: "start-session crashed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
