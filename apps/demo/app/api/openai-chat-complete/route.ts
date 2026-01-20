import { OPENAI_API_KEY } from "../secrets";

const SYSTEM_PROMPT =
  "You are a helpful assistant. You are being used in a demo. Please act courteously and helpfully.";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      message,
      model = "gpt-4o-mini",
      system_prompt = SYSTEM_PROMPT,
      // allow passing in body, but default to env for Vercel
      vector_store_id = process.env.OPENAI_VECTOR_STORE_ID,
      debug = false,
    } = body ?? {};

    if (!message) return json({ error: "message is required" }, 400);
    if (!OPENAI_API_KEY) return json({ error: "OpenAI API key not configured" }, 500);

    // IMPORTANT: must exist for file_search
    if (!vector_store_id) {
      return json(
        {
          error:
            "Missing vector_store_id. Set OPENAI_VECTOR_STORE_ID or pass vector_store_id in request body.",
        },
        500,
      );
    }

    // Helpful log to confirm env is being read
    console.log("[openai-chat-complete] OPENAI_VECTOR_STORE_ID =", vector_store_id);

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system_prompt },
          { role: "user", content: String(message) },
        ],
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_store_ids: [String(vector_store_id)],
          },
        },
        ...(debug ? { include: ["file_search_call.results"] } : {}),
      }),
    });

    const raw = await res.text();

    if (!res.ok) {
      console.error("OpenAI Responses API error:", raw);
      return json({ error: "Failed to generate response", details: raw }, res.status);
    }

    // Responses API returns JSON; parse it
    const data = JSON.parse(raw);

    // Best-effort extract text
    const responseText =
      data.output_text ??
      data?.output?.find((o: any) => o?.type === "message")?.content?.[0]?.text ??
      "";

    return json({ response: responseText, debug: debug ? data : undefined }, 200);
  } catch (error: any) {
    console.error("Error generating response:", error);
    return json({ error: "Failed to generate response", details: String(error?.message ?? error) }, 500);
  }
}
