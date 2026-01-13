import { NextResponse } from "next/server";

export async function POST() {
  const API_URL = process.env.API_URL;
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  const AVATAR_ID = process.env.AVATAR_ID;
  const VOICE_ID = process.env.VOICE_ID;

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
    mode: "FULL",
    avatar_id: AVATAR_ID,
    avatar_persona: {
      voice_id: VOICE_ID,
      language: "en",
      // Add either context_id OR prompt for the LLM behavior
      prompt: "You are a helpful assistant.", // or use context_id if you have one
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": HEYGEN_API_KEY, // This should be correct
    },
    body: JSON.stringify(upstreamBody),
  });

  // ... rest of your code
}
