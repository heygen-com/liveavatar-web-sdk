import { NextResponse } from "next/server";

export async function POST() {
  const API_URL = process.env.API_URL;
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  if (!API_URL || !HEYGEN_API_KEY) {
    return NextResponse.json(
      {
        error: "Missing env vars",
        hasApiUrl: !!API_URL,
        hasHeygenKey: !!HEYGEN_API_KEY,
      },
      { status: 500 },
    );
  }

  const url = `${API_URL.replace(/\/$/, "")}/v1/sessions/token`;

  const upstreamBody = {
    mode: "CUSTOM",
    avatar_id: process.env.AVATAR_ID,      // required
  // voice_id: process.env.VOICE_ID,     // optional if your setup uses it
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": HEYGEN_API_KEY,
    },
    body: JSON.stringify(upstreamBody),
  });

  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();

  console.log("CUSTOM_TOKEN_URL:", url);
  console.log("CUSTOM_TOKEN_STATUS:", res.status);
  console.log("CUSTOM_TOKEN_CONTENT_TYPE:", contentType);
  console.log("CUSTOM_TOKEN_REQ_BODY:", JSON.stringify(upstreamBody));
  console.log("CUSTOM_TOKEN_RAW_BODY:", raw.slice(0, 2000));

  if (!res.ok) {
    return NextResponse.json(
      {
        error: "Failed to retrieve session token",
        status: res.status,
        contentType,
        raw,
      },
      { status: 500 },
    );
  }

 const json = JSON.parse(raw);

return NextResponse.json({
  sessionAccessToken: json.data.session_token,
  sessionId: json.data.session_id,
});
}