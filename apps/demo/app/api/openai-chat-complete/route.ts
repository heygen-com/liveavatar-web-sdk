import { OPENAI_API_KEY } from "../secrets";

const SYSTEM_PROMPT = `
You are the SAFFI assistant.

CRITICAL RULES:
- You may ONLY answer questions using information contained in the SAFFI project materials.
- You are NOT allowed to use general knowledge.

Behavior rules:
- Speak naturally to an end user.
- Never mention files, uploads, documents, vector stores, embeddings, tools, or retrieval.
- Do not explain how you know something.
- Be confident, warm, and concise.

Role:
- Answer questions as the product itself, not as a demo assistant.
`.trim();

// ✅ Master prompt is editable via Vercel env var (Carolina controls this)
// ✅ Client cannot override because we never accept a system prompt from request body
const MASTER_SYSTEM_PROMPT =
  (process.env.SAFFI_SYSTEM_PROMPT && process.env.SAFFI_SYSTEM_PROMPT.trim()) ||
  SYSTEM_PROMPT;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const model = "gpt-5.2";

    // ✅ IMPORTANT: vector store id from request OR env
    const vector_store_id =
      body?.vector_store_id || process.env.OPENAI_VECTOR_STORE_ID;

    const debug = Boolean(body?.debug);

    if (!message) return json({ error: "message is required" }, 400);
    if (!OPENAI_API_KEY)
      return json({ error: "OpenAI API key not configured" }, 500);

    console.log(
      "[openai-chat-complete] OPENAI_VECTOR_STORE_ID =",
      vector_store_id,
    );

    // Optional but very helpful: confirm which prompt is being used (avoid logging the whole thing)
    console.log(
      "[openai-chat-complete] SAFFI_SYSTEM_PROMPT env set =",
      Boolean(
        process.env.SAFFI_SYSTEM_PROMPT &&
          process.env.SAFFI_SYSTEM_PROMPT.trim(),
      ),
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
        { role: "system", content: MASTER_SYSTEM_PROMPT },
        { role: "user", content: String(message) },
      ],
      tools: [
        {
          type: "file_search",
          vector_store_ids: [String(vector_store_id)],
        },
      ],
    };

    // 🔍 DEBUG: include file_search results so we can verify retrieval
    if (debug) {
      payload.include = ["file_search_call.results"];
    }

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
