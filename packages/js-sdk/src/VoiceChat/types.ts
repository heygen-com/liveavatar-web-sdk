export interface VoiceChatConfig {
  defaultMuted?: boolean;
  deviceId?: ConstrainDOMString;
}

export enum VoiceChatState {
  INACTIVE = "INACTIVE",
  STARTING = "STARTING",
  ACTIVE = "ACTIVE",
}

export enum VoiceChatMode {
  DEFAULT = "DEFAULT",
  PUSH_TO_TALK = "PUSH_TO_TALK",
}
