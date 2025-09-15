const API_KEY = "b918fce0-8a83-11f0-9a3d-06ce79efcd67";

const payload = {
  avatar_id: "d63b120e-8a77-11f0-9a3d-06ce79efcd67",
  context_id: "6210cccd-e84c-4df5-bbdc-a932c0c90189",
  language: "en",
  voice_id: "4aad65a8-8a77-11f0-9a3d-06ce79efcd67",
};

const baseApiUrl = "https://api.liveavatar.dev";

export async function POST() {
  try {
    const res = await fetch(`${baseApiUrl}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    console.log("Data:", data);

    return new Response(data.data.session_token, {
      status: 200,
    });
  } catch (error) {
    console.error("Error retrieving access token:", error);

    return new Response("Failed to retrieve access token", {
      status: 500,
    });
  }
}
