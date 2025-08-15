import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

export const useSession = () => {
  const { sessionRef, sessionState, stream, connectionQuality } =
    useLiveAvatarContext();

  const startSession = useCallback(async () => {
    return await sessionRef.current.start();
  }, [sessionRef]);

  const stopSession = useCallback(async () => {
    return await sessionRef.current.stop();
  }, [sessionRef]);

  return {
    sessionState,
    stream,
    connectionQuality,
    startSession,
    stopSession,
  };
};
