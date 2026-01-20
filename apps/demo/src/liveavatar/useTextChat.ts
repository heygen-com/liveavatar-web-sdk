import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

export const useTextChat = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef } = useLiveAvatarContext();

  const sendMessage = useCallback(
    async (message: string) => {
      // FULL mode (no OpenAI): send user text directly to HeyGen
      if (mode === "FULL") {
        return sessionRef.current?.message(message);
      }
      // Always get the AI response first (for BOTH modes)
      const llmRes = await fetch("/api/openai-chat-complete", {
        method: "POST",
        body: JSON.stringify({ message }),
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
      // CUSTOM mode: send the OpenAI reply to HeyGen using repeat()
      if (mode === "CUSTOM") {
        // 1) Ask server to generate TTS audio for the OpenAI reply text
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
        const audio: string = ttsJson.audio ?? "";

        if (!audio) {
          throw new Error("tts returned empty audio");
        }

        // 2) Send audio to HeyGen (this is the ONLY supported speak path)
        console.log(
          "[DEBUG repeatAudio]",
          typeof audio,
          audio?.length,
          audio?.slice?.(0, 40),
        );
        console.log(
          "[CLIENT] calling repeatAudio",
          typeof audio,
          audio?.length,
        );

        sessionRef.current?.repeatAudio(audio);
        return;
      }
      // Should never hit, but keeps TS happy if mode expands later
      throw new Error(`Unsupported mode: ${mode}`);
    },
    [sessionRef, mode],
  );

  return {
    sendMessage,
  };
};
