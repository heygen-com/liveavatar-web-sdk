export interface VoiceChatConfig {
  defaultMuted?: boolean;
  deviceId?: ConstrainDOMString;
}

export enum VoiceChatState {
  INACTIVE = "INACTIVE",
  STARTING = "STARTING",
  ACTIVE = "ACTIVE",
}
