import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/start-session",
    method: "GET",
    time: new Date().toISOString(),
  });
}
export async function POST() {
  try {
    const API_URL = (
      process.env.API_URL || "https://api.liveavatar.com"
    ).replace(/\/$/, "");
    const HEYGEN_API_KEY = (process.env.HEYGEN_API_KEY || "").trim();
    const AVATAR_ID = (process.env.AVATAR_ID || "").trim();
    const VOICE_ID = (process.env.VOICE_ID || "").trim();

    if (!HEYGEN_API_KEY || !AVATAR_ID) {
      return NextResponse.json(
        {
          error: "Missing required env vars",
          hasKey: !!HEYGEN_API_KEY,
          hasAvatar: !!AVATAR_ID,
          hasVoice: !!VOICE_ID,
        },
        { status: 500 },
      );
    }

    const url = `${API_URL}/v1/sessions/token`;

    // ✅ CORRECT HeyGen FULL payload
    const upstreamBody = {
      mode: "FULL",
      avatar_id: AVATAR_ID,
      avatar_persona: {
        voice_id: VOICE_ID || undefined,
        language: "en",
        prompt: "You are a helpful assistant.",
      },
    };

    const upstreamRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": HEYGEN_API_KEY,
      },
      body: JSON.stringify(upstreamBody),
    });

    const raw = await upstreamRes.text();
    const contentType = upstreamRes.headers.get("content-type") || "unknown";

    if (!upstreamRes.ok) {
      return NextResponse.json(
        {
          error: "Upstream token request failed",
          upstreamStatus: upstreamRes.status,
          upstreamContentType: contentType,
          upstreamBody: raw || "(empty)",
          sentPayload: upstreamBody,
        },
        { status: 500 },
      );
    }

    if (!raw.trim()) {
      return NextResponse.json(
        {
          error: "Upstream returned empty body",
        },
        { status: 500 },
      );
    }

    const upstreamJson = JSON.parse(raw);

    const sessionAccessToken =
      upstreamJson.sessionAccessToken ||
      upstreamJson.session_access_token ||
      upstreamJson.access_token;

    const sessionId = upstreamJson.sessionId || upstreamJson.session_id || null;

    if (!sessionAccessToken) {
      return NextResponse.json(
        {
          error: "Missing sessionAccessToken in upstream response",
          upstreamJson,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ sessionAccessToken, sessionId });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "start-session crashed",
        message: err?.message ?? String(err),
      },
      { status: 500 },
    );
  }
}
