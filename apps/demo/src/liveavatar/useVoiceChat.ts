import { useCallback, useMemo } from "react";
import { useLiveAvatarContext } from "./context";
import { VoiceChatState } from "@heygen/liveavatar-web-sdk";

export const useVoiceChat = () => {
  const {
    sessionRef,
    isMuted,
    voiceChatState,
    isUserTalking,
    isAvatarTalking,
  } = useLiveAvatarContext();

  const mute = useCallback(async () => {
    return await sessionRef.current.voiceChat.mute();
  }, [sessionRef]);

  const unmute = useCallback(async () => {
    return await sessionRef.current.voiceChat.unmute();
  }, [sessionRef]);

  const start = useCallback(async () => {
    return await sessionRef.current.voiceChat.start();
  }, [sessionRef]);

  const stop = useCallback(() => {
    return sessionRef.current.voiceChat.stop();
  }, [sessionRef]);

  const isLoading = useMemo(() => {
    return voiceChatState === VoiceChatState.STARTING;
  }, [voiceChatState]);

  const isActive = useMemo(() => {
    return voiceChatState === VoiceChatState.ACTIVE;
  }, [voiceChatState]);

  return {
    mute,
    unmute,
    start,
    stop,
    isLoading,
    isActive,
    isMuted,
    isUserTalking,
    isAvatarTalking,
  };
};
