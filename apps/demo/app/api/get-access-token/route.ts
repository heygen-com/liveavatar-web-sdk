const API_KEY = "";

const payload = {};

const baseApiUrl = "https://api.liveavatar.com";

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
