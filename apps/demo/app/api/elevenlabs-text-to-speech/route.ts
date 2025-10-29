import { ELEVENLABS_API_KEY } from "../secrets";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, voice_id = "21m00Tcm4TlvDq8ikWAM" } = body;

    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Call ElevenLabs API
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/with-timestamps?output_format=pcm_24000`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
        }),
      },
    );

    if (!res.ok) {
      const errorData = await res.text();
      console.error("ElevenLabs API error:", errorData);
      return new Response(
        JSON.stringify({
          error: "Failed to generate speech",
          details: errorData,
        }),
        {
          status: res.status,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Convert audio to base64
    const data = await res.json();
    const audio = data.audio_base64;

    return new Response(JSON.stringify({ audio }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error generating speech:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate speech" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
