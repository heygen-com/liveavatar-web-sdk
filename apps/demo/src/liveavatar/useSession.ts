import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

export const useSession = () => {
  const { sessionRef, sessionState, isStreamReady, connectionQuality } =
    useLiveAvatarContext();

  const startSession = useCallback(async () => {
    return await sessionRef.current.start();
  }, [sessionRef]);

  const stopSession = useCallback(async () => {
    return await sessionRef.current.stop();
  }, [sessionRef]);

  const keepAlive = useCallback(async () => {
    return await sessionRef.current.keepAlive();
  }, [sessionRef]);

  const attachElement = useCallback(
    (element: HTMLMediaElement) => {
      return sessionRef.current.attach(element);
    },
    [sessionRef],
  );

  return {
    sessionState,
    isStreamReady,
    connectionQuality,
    startSession,
    stopSession,
    keepAlive,
    attachElement,
  };
};
