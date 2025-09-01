const API_KEY = "9f691626-7872-11f0-9f9a-0242c0a86102";

const payload = {
  avatar_id: "9a596fce-7946-11f0-9f9a-0242c0a86102",
  voice_id: "e706eaeb-7946-11f0-9f9a-0242c0a86102",
  context_id: "30bfad5d-7947-11f0-9f9a-0242c0a86102",
  language: "en",
};

export async function POST() {
  try {
    const baseApiUrl = "https://0569dd95029b.ngrok-free.app";

    const res = await fetch(`${baseApiUrl}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

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
