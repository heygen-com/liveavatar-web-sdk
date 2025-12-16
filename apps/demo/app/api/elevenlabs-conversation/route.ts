import { ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID } from "../secrets";

export async function POST(request: Request) {
  console.log("=== ElevenLabs Conversation API Called ===");
  console.log("ELEVENLABS_API_KEY exists:", !!ELEVENLABS_API_KEY);
  console.log("ELEVENLABS_AGENT_ID:", ELEVENLABS_AGENT_ID);

  try {
    // Parse optional agentId from request body, fallback to default
    let agentId = ELEVENLABS_AGENT_ID;
    try {
      const body = await request.json();
      if (body.agentId) {
        agentId = body.agentId;
      }
    } catch {
      // No body or invalid JSON, use default agent ID
    }

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs Agent ID not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get signed URL from ElevenLabs Conversational AI API
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      },
    );

    if (!res.ok) {
      const errorData = await res.text();
      console.error("ElevenLabs API error:", errorData);
      return new Response(
        JSON.stringify({
          error: "Failed to get signed URL",
          details: errorData,
        }),
        {
          status: res.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = await res.json();
    console.log("ElevenLabs signed URL obtained successfully");

    return new Response(
      JSON.stringify({
        signedUrl: data.signed_url,
        agentId: agentId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error getting signed URL:", error);
    return new Response(JSON.stringify({ error: "Failed to get signed URL" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
