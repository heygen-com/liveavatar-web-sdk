import { auth } from "@/auth";
import {
  API_KEY,
  API_URL,
  AVATAR_ID_MOBILE,
  AVATAR_ID_DESKTOP,
  VOICE_ID,
  CONTEXT_ID,
  LANGUAGE,
} from "../secrets";

export async function POST(request: Request) {
  // Auth guard
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let session_token = "";
  let session_id = "";

  // Parse request body to get device type
  let deviceType: "mobile" | "desktop" = "mobile";
  try {
    const body = await request.json();
    if (body.deviceType === "desktop") {
      deviceType = "desktop";
    }
  } catch {
    // No body or invalid JSON, use default (mobile)
  }

  // Select avatar based on device type
  const avatarId =
    deviceType === "desktop" ? AVATAR_ID_DESKTOP : AVATAR_ID_MOBILE;

  try {
    const res = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id: avatarId,
        avatar_persona: {
          voice_id: VOICE_ID,
          context_id: CONTEXT_ID,
          language: LANGUAGE,
        },
      }),
    });
    if (!res.ok) {
      const resp = await res.json();
      const errorMessage =
        resp.data[0].message ?? "Failed to retrieve session token";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: res.status,
      });
    }
    const data = await res.json();

    session_token = data.data.session_token;
    session_id = data.data.session_id;
  } catch (error) {
    console.error("Error retrieving session token:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
    });
  }

  if (!session_token) {
    return new Response("Failed to retrieve session token", {
      status: 500,
    });
  }
  return new Response(JSON.stringify({ session_token, session_id }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
