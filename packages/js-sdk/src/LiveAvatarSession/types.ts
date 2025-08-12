import { VoiceChatConfig } from "../VoiceChat";

export enum SessionState {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DISCONNECTING = "DISCONNECTING",
  DISCONNECTED = "DISCONNECTED",
}

export enum SessionDisconnectReason {
  UNKNOWN_REASON = "UNKNOWN_REASON",
  CLIENT_INITIATED = "CLIENT_INITIATED",
  // Consider adding other reasons: INACTIVITY_TIMEOUT, SESSION_DURATION_EXCEEDED, OUT_OF_CREDITS, etc.
}

export interface SessionConfig {
  voiceChat?: VoiceChatConfig | boolean;
}

export interface SessionInfo {
  session_id: string;
  room_url: string;
}
