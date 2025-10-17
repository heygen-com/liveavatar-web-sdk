import { API_KEY, API_URL } from "../secrets";

// Talk to Wayne's avatar
const AVATAR_ID = "d63b120e-8a77-11f0-9a3d-06ce79efcd67";

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
        mode: "CUSTOM",
        avatar_id: AVATAR_ID,
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
