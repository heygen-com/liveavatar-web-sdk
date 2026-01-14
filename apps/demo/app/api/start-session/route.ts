import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const API_URL = (
      process.env.API_URL || "https://api.liveavatar.com"
    ).replace(/\/$/, "");
    const API_KEY = (process.env.HEYGEN_API_KEY || "").trim();
    const AVATAR_ID = (process.env.AVATAR_ID || "").trim();
    const VOICE_ID = (process.env.VOICE_ID || "").trim();
    const CONTEXT_ID = (process.env.CONTEXT_ID || "").trim(); // optional

    if (!API_KEY || !AVATAR_ID) {
      return NextResponse.json(
        {
          error: "Missing required env vars",
          hasApiKey: !!API_KEY,
          hasAvatarId: !!AVATAR_ID,
        },
        { status: 500 },
      );
    }

    // IMPORTANT: include mode (discriminator) + expected shape
    const upstreamBody = {
      mode: "FULL",
      avatar_id: AVATAR_ID,
      is_sandbox: false,
      avatar_persona: {
        language: "en",
        voice_id: VOICE_ID || undefined,
        context_id: CONTEXT_ID || undefined,
      },
    };

    const upstreamRes = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY,
      },
      body: JSON.stringify(upstreamBody),
    });

    const raw = await upstreamRes.text();

    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          error: "Upstream did not return JSON",
          status: upstreamRes.status,
          raw,
        },
        { status: 502 },
      );
    }

    if (!upstreamRes.ok) {
      return NextResponse.json(
        {
          error: "Upstream request failed",
          status: upstreamRes.status,
          json,
          sent: upstreamBody,
        },
        { status: 502 },
      );
    }

    const data = json?.data;
    const sessionAccessToken = data?.session_token;
    const sessionId = data?.session_id;

    if (!sessionAccessToken || !sessionId) {
      return NextResponse.json(
        {
          error: "Missing session_token or session_id in upstream response",
          json,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ sessionAccessToken, sessionId });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
