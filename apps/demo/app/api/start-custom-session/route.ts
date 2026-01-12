import { NextResponse } from "next/server";

export async function POST() {
  const API_URL = process.env.API_URL || "https://api.liveavatar.com";
  const KEY = process.env.HEYGEN_API_KEY;

  if (!KEY) {
    return NextResponse.json(
      { error: "Missing HEYGEN_API_KEY in server env" },
      { status: 500 },
    );
  }

  const url = `${API_URL.replace(/\/$/, "")}/v1/sessions/token`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": KEY, // <-- THIS is the critical part
      },
      body: JSON.stringify({}), // avoid empty-body edge cases
    });

    const text = await upstream.text();

    // If upstream isn't JSON, return it as a helpful error
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        {
          error: "Upstream returned non-JSON",
          upstreamStatus: upstream.status,
          upstreamBody: text,
          url,
        },
        { status: 502 },
      );
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: "Upstream rejected request",
          upstreamStatus: upstream.status,
          upstreamData: data,
          url,
        },
        { status: upstream.status },
      );
    }

    // IMPORTANT: return only what the front-end expects
    // (Adjust keys ONLY if your UI expects different names)
    return NextResponse.json({
      sessionAccessToken:
        data?.data?.sessionAccessToken ?? data?.sessionAccessToken,
      sessionId: data?.data?.sessionId ?? data?.sessionId,
      raw: data, // keep for now; remove later once stable
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server fetch failed", message: e?.message, url },
      { status: 500 },
    );
  }
}
