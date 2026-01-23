import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

export const useTextChat = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef } = useLiveAvatarContext();

  const sendMessage = useCallback(
    async (message: string) => {
      const cleaned = (message ?? "").trim();
      if (!cleaned) return;

      // FULL mode: send user text directly to HeyGen
      if (mode === "FULL") {
        return sessionRef.current?.message(cleaned);
      }

      // CUSTOM mode: ask OpenAI first
      const llmRes = await fetch("/api/openai-chat-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cleaned, debug: true }),
      });

      if (!llmRes.ok) {
        const errText = await llmRes.text();
        throw new Error(
          `openai-chat-complete failed (${llmRes.status}): ${errText}`,
        );
      }

      const llmJson = await llmRes.json();
      const chatResponseText: string = llmJson?.response ?? "";

      if (!chatResponseText) {
        throw new Error("openai-chat-complete returned empty response");
      }

      // Generate TTS for the ASSISTANT reply (this is the parrot fix)
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chatResponseText }),
      });

      if (!ttsRes.ok) {
        const err = await ttsRes.text();
        throw new Error(`tts failed (${ttsRes.status}): ${err}`);
      }

      const ttsJson = await ttsRes.json();
      const audio: string = ttsJson?.audio ?? "";

      if (!audio) {
        throw new Error("tts returned empty audio");
      }

      console.log("[DEBUG repeatAudio]", typeof audio, audio.length);
      sessionRef.current?.repeatAudio(audio);
    },
    [sessionRef, mode],
  );

  return { sendMessage };
};
