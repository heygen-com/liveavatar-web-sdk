import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

export const useTextChat = () => {
  const { sessionRef } = useLiveAvatarContext();

  const sendMessage = useCallback(
    async (message: string) => {
      return sessionRef.current.message(message);
    },
    [sessionRef],
  );

  return {
    sendMessage,
  };
};
