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

    // ✅ HeyGen LiveAvatar FULL mode payload
    const upstreamBody = {
      mode: "FULL",
      avatar_id: AVATAR_ID,
      avatar_persona: {
        voice_id: VOICE_ID || undefined,
        language: "en",
        prompt: "You are a helpful assistant.",
        // If your account requires CONTEXT_ID instead of prompt:
        // context_id: (process.env.CONTEXT_ID || "").trim() || undefined,
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
          upstreamStatus: upstreamRes.status,
          upstreamContentType: contentType,
          sentPayload: upstreamBody,
        },
        { status: 500 },
      );
    }

    let upstreamJson: unknown;
    try {
      upstreamJson = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          error: "Upstream returned non-JSON",
          upstreamStatus: upstreamRes.status,
          upstreamContentType: contentType,
          upstreamBody: raw,
          sentPayload: upstreamBody,
        },
        { status: 500 },
      );
    }

    const u = upstreamJson as Record<string, unknown>;

    const sessionAccessToken =
      (u["sessionAccessToken"] as string) ||
      (u["session_access_token"] as string) ||
      (u["access_token"] as string);

    const sessionId =
      (u["sessionId"] as string) || (u["session_id"] as string) || null;

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    return NextResponse.json(
      { error: "start-session crashed", message },
      { status: 500 },
    );
  }
}
