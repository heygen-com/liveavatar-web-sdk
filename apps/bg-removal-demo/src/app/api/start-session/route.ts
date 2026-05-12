import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.API_KEY!;
const API_URL = process.env.API_URL!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      avatar_id = process.env.DEFAULT_AVATAR_ID,
      voice_id = process.env.DEFAULT_VOICE_ID,
      context_id = process.env.DEFAULT_CONTEXT_ID,
      language = process.env.DEFAULT_LANGUAGE || "en",
      video_quality = "high",
      video_encoding = "H264",
      max_session_duration,
    } = body;

    const res = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id,
        avatar_persona: {
          voice_id,
          context_id,
          language,
        },
        video_settings: {
          quality: video_quality,
          encoding: video_encoding,
        },
        is_sandbox: false,
        ...(typeof max_session_duration === "number" && max_session_duration > 0
          ? { max_session_duration }
          : {}),
      }),
    });

    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      let errorMessage = "Failed to retrieve session token";

      if (contentType && contentType.includes("application/json")) {
        try {
          const resp = await res.json();
          if (resp.data && resp.data.length > 0) {
            errorMessage = resp.data[0].message;
          } else if (resp.error) {
            errorMessage = resp.error;
          } else if (resp.message) {
            errorMessage = resp.message;
          }
        } catch {
          // ignore parse error
        }
      } else {
        const text = await res.text();
        errorMessage = text || errorMessage;
      }

      return NextResponse.json({ error: errorMessage }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      session_token: data.data.session_token,
      session_id: data.data.session_id,
    });
  } catch (error) {
    console.error("Error retrieving session token:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
