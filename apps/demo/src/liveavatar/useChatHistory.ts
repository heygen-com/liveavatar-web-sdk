import { useLiveAvatarContext } from "./context";

export const useChatHistory = () => {
  const { messages } = useLiveAvatarContext();

  return messages;
};
