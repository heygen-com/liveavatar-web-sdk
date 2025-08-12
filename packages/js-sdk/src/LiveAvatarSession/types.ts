import { VoiceChatConfig } from "../VoiceChat";

export enum SessionState {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DISCONNECTING = "DISCONNECTING",
  DISCONNECTED = "DISCONNECTED",
}

export interface SessionConfig {
  voiceChat?: VoiceChatConfig | boolean;
}

export interface SessionInfo {
  session_id: string;
  room_url: string;
}
