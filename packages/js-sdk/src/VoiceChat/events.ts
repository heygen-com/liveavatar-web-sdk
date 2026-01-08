import { VoiceChatState } from "./types";

export enum VoiceChatEvent {
  MUTED = "MUTED",
  UNMUTED = "UNMUTED",
  // DEVICE_CHANGED = "DEVICE_CHANGED",
  STATE_CHANGED = "STATE_CHANGED",
}

export type VoiceChatEventCallbacks = {
  [VoiceChatEvent.MUTED]: () => void;
  [VoiceChatEvent.UNMUTED]: () => void;
  // [VoiceChatEvent.DEVICE_CHANGED]: (deviceId: string) => void;
  [VoiceChatEvent.STATE_CHANGED]: (state: VoiceChatState) => void;
};

export enum PushToTalkCommandEvent {
  START = "user.start_push_to_talk",
  STOP = "user.stop_push_to_talk",
}

export enum PushToTalkServerEvent {
  START_SUCCESS = "user.push_to_talk_started",
  START_FAILED = "user.push_to_talk_start_failed",
  STOP_SUCCESS = "user.push_to_talk_stopped",
  STOP_FAILED = "user.push_to_talk_stop_failed",
}
