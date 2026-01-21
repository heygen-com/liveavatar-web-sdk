import { OPENAI_API_KEY } from "../secrets";

const SYSTEM_PROMPT = `
You are the SAFFI assistant.

CRITICAL RULES:
- You may ONLY answer questions using information contained in the SAFFI project materials.
- You are NOT allowed to use general knowledge.
- If the answer is not explicitly supported by the SAFFI materials, respond exactly with:
  "I don’t have that information yet."

Behavior rules:
- Speak naturally to an end user.
- Never mention files, uploads, documents, vector stores, embeddings, tools, or retrieval.
- Do not explain how you know something.
- Be confident, warm, and concise.

Role:
- Answer questions as the product itself, not as a demo assistant.
`.trim();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const message = body?.message;
    const model = body?.model ?? "gpt-4o-mini";

    // ✅ Recommended: lock the SAFFI prompt so the client cannot override it
    const system_prompt = SYSTEM_PROMPT;

    // IMPORTANT: read vector store id from request OR env
    const vector_store_id =
      body?.vector_store_id || process.env.OPENAI_VECTOR_STORE_ID;

    const debug = Boolean(body?.debug);

    if (!message) return json({ error: "message is required" }, 400);
    if (!OPENAI_API_KEY)
      return json({ error: "OpenAI API key not configured" }, 500);

    // Log what the server actually sees (helps catch env var typos)
    console.log(
      "[openai-chat-complete] OPENAI_VECTOR_STORE_ID =",
      vector_store_id,
    );

    if (!vector_store_id) {
      return json(
        {
          error:
            "Missing vector_store_id. Set OPENAI_VECTOR_STORE_ID or pass vector_store_id in the request body.",
        },
        500,
      );
    }

    // ✅ Responses API + file_search tool
    const payload: any = {
      model,
      input: [
        { role: "system", content: system_prompt },
        { role: "user", content: String(message) },
      ],
      tools: [
        {
          type: "file_search",
          vector_store_ids: [String(vector_store_id)],
        },
      ],
    };

    // Optional: include the file_search_call results so you can *prove* it searched
    if (debug) payload.include = ["file_search_call.results"];

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI Responses API error:", errText);
      return json(
        { error: "Failed to generate response", details: errText },
        res.status,
      );
    }

    const data = await res.json();

    // Extract output text in a tolerant way
    let responseText = "";

    // Common: "output" array contains message items
    if (Array.isArray(data?.output)) {
      for (const item of data.output) {
        if (item?.type === "message" && Array.isArray(item?.content)) {
          for (const part of item.content) {
            if (part?.type === "output_text" && typeof part.text === "string") {
              responseText += part.text;
            }
          }
        }
      }
    }

    // Fallback: some SDK helpers put text in output_text
    if (!responseText && typeof data?.output_text === "string") {
      responseText = data.output_text;
    }

    return json({
      response: responseText || "(No text returned)",
      ...(debug ? { raw: data } : {}),
    });
  } catch (error) {
    console.error("Error generating response:", error);
    return json({ error: "Failed to generate response" }, 500);
  }
}
