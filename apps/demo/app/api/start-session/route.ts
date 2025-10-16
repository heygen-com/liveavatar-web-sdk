import { API_KEY, API_URL } from "../secrets";

// Talk to Wayne's avatar
const AVATAR_ID = "da25b1c5-d789-4683-b435-fed9f8d25e25";
const VOICE_ID = "c2527536-6d1f-4412-a643-53a3497dada9";
const CONTEXT_ID = "5b9dba8a-aa31-11f0-a6ee-066a7fa2e369";
const LANGUAGE = "en";

export async function POST() {
  let session_token = "";
  let session_id = "";
  try {
    const res = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        avatar_id: AVATAR_ID,
        voice_id: VOICE_ID,
        context_id: CONTEXT_ID,
        language: LANGUAGE,
      }),
    });
    const data = await res.json();

    session_token = data.data.session_token;
    session_id = data.data.session_id;
  } catch (error) {
    console.error("Error retrieving session token:", error);
    return new Response("Failed to retrieve session token", {
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
