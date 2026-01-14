import { NextResponse } from "next/server";
import { API_URL, API_KEY, AVATAR_ID } from "../secrets"; // adjust if your path differs

export async function POST() {
  try {
    const upstreamRes = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY,
      },
      body: JSON.stringify({
        avatar_id: AVATAR_ID,
      }),
    });

    const raw = await upstreamRes.text();

    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Upstream did not return JSON", raw },
        { status: 502 },
      );
    }

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: "Upstream request failed", status: upstreamRes.status, json },
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
