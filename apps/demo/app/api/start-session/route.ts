import { NextResponse } from "next/server";

export const runtime = "nodejs"; // keep it predictable on Vercel

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function safeReadBody(req: Request) {
  // Some clients POST with no body; req.json() would throw and cause 500.
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return {};
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  try {
    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    const API_URL = (process.env.API_URL || "https://api.liveavatar.com").replace(/\/$/, "");

    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: "Missing HEYGEN_API_KEY on server (Vercel env var not set for this environment)" },
        { status: 500 }
      );
    }

    // Read body safely (won’t crash if empty)
    const body = await safeReadBody(req);

    // Token endpoint
    const url = `${API_URL}/v1/sessions/token`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": HEYGEN_API_KEY,
      },
      body: JSON.stringify(body ?? {}),
    });

    const raw = await upstream.text();
    const data = safeJsonParse(raw);

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: "Upstream token request failed",
          status: upstream.status,
          contentType: upstream.headers.get("content-type"),
          raw: raw?.slice(0, 500), // helps debug without blowing logs
        },
        { status: 500 }
      );
    }

    // If upstream returned non-JSON, fail clearly (don’t crash)
    if (!data) {
      return NextResponse.json(
        {
          error: "Upstream returned non-JSON response",
          contentType: upstream.headers.get("content-type"),
          raw: raw?.slice(0, 500),
        },
        { status: 500 }
      );
    }

    // IMPORTANT: return only what the frontend expects
    // Adjust these keys ONLY if your upstream uses different names.
    const sessionAccessToken =
      data.sessionAccessToken ?? data.session_access_token ?? data.data?.sessionAccessToken;
    const sessionId = data.sessionId ?? data.session_id ?? data.data?.sessionId;

    if (!sessionAccessToken || !sessionId) {
      return NextResponse.json(
        { error: "Token response missing sessionAccessToken/sessionId", data },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionAccessToken, sessionId });
  } catch (err: any) {
    return NextResponse.json(
      { error: "start-session crashed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
