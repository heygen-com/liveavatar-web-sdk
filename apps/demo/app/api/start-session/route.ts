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

    // Upstream requires: body -> FULL -> avatar_id + avatar_persona
    const upstreamBody: any = {
      mode: "FULL",
      FULL: {
        avatar_id: AVATAR_ID,
        avatar_persona: {
          ...(VOICE_ID ? { voice_id: VOICE_ID } : {}),
          language: "en",
          prompt: "You are a helpful assistant.",
        },
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
