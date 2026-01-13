import { NextResponse } from "next/server";

export const runtime = "nodejs";

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export async function POST(req: Request) {
  try {
    const API_URL = pickEnv("API_URL") || "https://api.liveavatar.com";
    const HEYGEN_API_KEY = pickEnv("HEYGEN_API_KEY");

    // These may be in Vercel as AVATAR_ID / VOICE_ID (based on your earlier setup)
    const AVATAR_ID = pickEnv("AVATAR_ID", "NEXT_PUBLIC_AVATAR_ID");
    const VOICE_ID = pickEnv("VOICE_ID", "NEXT_PUBLIC_VOICE_ID");

    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: "Missing HEYGEN_API_KEY in server environment" },
        { status: 500 },
      );
    }

    // Read body safely (your request is currently empty: content-length: 0)
    const raw = await req.text();
    let bodyFromClient: any = {};
    if (raw?.trim()) {
      try {
        bodyFromClient = JSON.parse(raw);
      } catch {
        bodyFromClient = {};
      }
    }

    // Ensure required fields exist (prevents 422)
    const payload = {
      ...bodyFromClient,
      avatarId: bodyFromClient.avatarId ?? AVATAR_ID,
      // voiceId is optional on some accounts, but include if you have it
      ...(bodyFromClient.voiceId || VOICE_ID
        ? { voiceId: bodyFromClient.voiceId ?? VOICE_ID }
        : {}),
    };

    if (!payload.avatarId) {
      return NextResponse.json(
        {
          error:
            "Missing avatarId. Set AVATAR_ID in Vercel env vars (Preview + Production).",
        },
        { status: 400 },
      );
    }

    const url = `${API_URL.replace(/\/$/, "")}/v1/sessions/token`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": HEYGEN_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "unknown";

    // Return useful errors as JSON (so the UI won’t crash)
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: "Upstream rejected token request",
          upstreamStatus: upstream.status,
          upstreamContentType: contentType,
          upstreamBody: text,
          sentPayload: payload,
        },
        { status: upstream.status },
      );
    }

    // Pass through JSON response
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "start-custom-session crashed",
        message: err?.message ?? String(err),
      },
      { status: 500 },
    );
  }
}
