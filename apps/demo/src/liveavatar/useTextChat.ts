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
        await sessionRef.current.repeat(chatResponseText);
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
