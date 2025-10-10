import { API_KEY, API_URL } from "../secrets";

const AVATAR_ID = "d63b120e-8a77-11f0-9a3d-06ce79efcd67";
const VOICE_ID = "f580a236-1a86-4d6a-a581-c21e6357aedd";
const CONTEXT_ID = "bfa51c5d-1036-4879-bac9-f50c9a315ef7";
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
