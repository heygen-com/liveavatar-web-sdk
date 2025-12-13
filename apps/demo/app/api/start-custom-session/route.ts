import { API_KEY, API_URL, AVATAR_ID } from "../secrets";

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
    if (!res.ok) {
      let errorMessage = "Failed to retrieve session token";
      try {
        const resp = await res.json();
        // Try different error response formats
        if (resp.data && Array.isArray(resp.data) && resp.data[0]?.message) {
          errorMessage = resp.data[0].message;
        } else if (resp.message) {
          errorMessage = resp.message;
        } else if (resp.error) {
          errorMessage = resp.error;
        }
      } catch (parseError) {
        // If JSON parsing fails, use default error message
        console.error("Failed to parse error response:", parseError);
      }
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: res.status,
      });
    }
    const data = await res.json();
    console.log(data);

    session_token = data.data.session_token;
    session_id = data.data.session_id;
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
    });
  }

  if (!session_token) {
    return new Response(
      JSON.stringify({ error: "Failed to retrieve session token" }),
      {
        status: 500,
      },
    );
  }
  return new Response(JSON.stringify({ session_token, session_id }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
