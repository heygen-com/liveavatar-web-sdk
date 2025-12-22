export interface VoiceChatConfig {
  defaultMuted?: boolean;
  deviceId?: ConstrainDOMString;
  mode?: SessionInteractivityMode;
}

export enum VoiceChatState {
  INACTIVE = "INACTIVE",
  STARTING = "STARTING",
  ACTIVE = "ACTIVE",
}

export enum SessionInteractivityMode {
  CONVERSATIONAL = "CONVERSATIONAL",
  PUSH_TO_TALK = "PUSH_TO_TALK",
}
