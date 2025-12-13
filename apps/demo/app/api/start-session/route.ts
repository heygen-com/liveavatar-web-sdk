import {
  API_KEY,
  API_URL,
  AVATAR_ID,
  VOICE_ID,
  CONTEXT_ID,
  LANGUAGE,
} from "../secrets";

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
        mode: "FULL",
        avatar_id: AVATAR_ID,
        avatar_persona: {
          voice_id: VOICE_ID,
          context_id: CONTEXT_ID,
          language: LANGUAGE,
        },
      }),
    });
    if (!res.ok) {
      // Read response body only once using text, then parse
      const bodyText = await res.text();
      console.error(`Upstream error: status=${res.status}, body=${bodyText}`);

      // Try to parse as JSON and extract error message defensively
      let errorMessage = "Failed to retrieve session token";
      try {
        const resp = JSON.parse(bodyText);
        // Check multiple possible error message shapes
        errorMessage =
          resp?.data?.[0]?.message ??
          resp?.data?.message ??
          resp?.message ??
          resp?.error ??
          errorMessage;
      } catch {
        // If parsing fails, use bodyText or default message
        errorMessage = bodyText || errorMessage;
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: res.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    const data = await res.json();

    // Use optional chaining to safely access nested properties
    session_token = data?.data?.session_token ?? "";
    session_id = data?.data?.session_id ?? "";
  } catch (error) {
    console.error("Error retrieving session token:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  if (!session_token) {
    return new Response(
      JSON.stringify({ error: "Failed to retrieve session token" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
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
