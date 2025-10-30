import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

export const useTextChat = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef } = useLiveAvatarContext();

  const sendMessage = useCallback(
    async (message: string) => {
      if (mode === "FULL") {
        return sessionRef.current.message(message);
      } else if (mode === "CUSTOM") {
        const response = await fetch("/api/openai-chat-complete", {
          method: "POST",
          body: JSON.stringify({ message }),
        });
        const { response: chatResponseText } = await response.json();
        const res = await fetch("/api/elevenlabs-text-to-speech", {
          method: "POST",
          body: JSON.stringify({ text: chatResponseText }),
        });
        const { audio } = await res.json();
        // Have the avatar repeat the audio
        return sessionRef.current.repeatAudio(audio);
      }
    },
    [sessionRef, mode],
  );

  return {
    sendMessage,
  };
};
