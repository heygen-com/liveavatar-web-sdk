import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

// Simple probe to confirm the route is alive in production:
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
    const API_URL = (pickEnv("API_URL") || "https://api.liveavatar.com").replace(
      /\/$/,
      "",
    );
    const HEYGEN_API_KEY = pickEnv("HEYGEN_API_KEY");

    // Prefer server env vars, but also allow NEXT_PUBLIC_* as fallback
    const AVATAR_ID = pickEnv("AVATAR_ID", "NEXT_PUBLIC_AVATAR_ID");
    const VOICE_ID = pickEnv("VOICE_ID", "NEXT_PUBLIC_VOICE_ID");

    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: "Missing HEYGEN_API_KEY in server environment" },
        { status: 500 },
      );
    }

    if (!AVATAR_ID) {
      return NextResponse.json(
        {
          error:
            "Missing AVATAR_ID. Set AVATAR_ID in Vercel env vars (Preview + Production).",
        },
        { status: 400 },
      );
    }

    const url = `${API_URL}/v1/sessions/token`;

    /**
     * IMPORTANT:
     * Your 422 error shows the token endpoint is validating a FULL-mode schema
     * that does NOT accept avatar_id + avatar_persona.
     *
     * This payload matches the other working pattern you used:
     * camelCase keys: avatarId / voiceId
     */
    const upstreamBody: any = {
      mode: "FULL",
      avatarId: AVATAR_ID,
      ...(VOICE_ID ? { voiceId: VOICE_ID } : {}),
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

    // Always return JSON so the browser never crashes on res.json()
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

    // Pass through upstream JSON, but normalize the fields the SDK expects
    let upstreamJson: any;
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
      { error: "start-session crashed", message: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
