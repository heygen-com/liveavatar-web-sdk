import { SessionDisconnectReason, SessionState } from "./types";
import { ConnectionQuality } from "../QualityIndicator";

export enum SessionEvent {
  STATE_CHANGED = "STATE_CHANGED",
  CONNECTION_QUALITY_CHANGED = "CONNECTION_QUALITY_CHANGED",
  STREAM_READY = "STREAM_READY",
  USER_START_TALKING = "USER_START_TALKING",
  USER_STOP_TALKING = "USER_STOP_TALKING",
  AVATAR_START_TALKING = "AVATAR_START_TALKING",
  AVATAR_STOP_TALKING = "AVATAR_STOP_TALKING",
  AVATAR_MESSAGE = "AVATAR_MESSAGE",
  AVATAR_END_MESSAGE = "AVATAR_END_MESSAGE",
  USER_MESSAGE = "USER_MESSAGE",
  USER_END_MESSAGE = "USER_END_MESSAGE",
  INACTIVITY_DETECTED = "INACTIVITY_DETECTED",
  DISCONNECTED = "DISCONNECTED",
}

type TaskEvent<T extends Record<string, unknown> = Record<string, unknown>> = {
  task_id: string;
} & T;

export type SessionEventCallbacks = {
  [SessionEvent.STATE_CHANGED]: (state: SessionState) => void;
  [SessionEvent.CONNECTION_QUALITY_CHANGED]: (
    quality: ConnectionQuality,
  ) => void;
  [SessionEvent.STREAM_READY]: (stream: MediaStream) => void;
  [SessionEvent.USER_START_TALKING]: () => void;
  [SessionEvent.USER_STOP_TALKING]: () => void;
  [SessionEvent.AVATAR_START_TALKING]: (event: TaskEvent) => void;
  [SessionEvent.AVATAR_STOP_TALKING]: (event: TaskEvent) => void;
  [SessionEvent.AVATAR_MESSAGE]: (
    event: TaskEvent<{ message: string }>,
  ) => void;
  [SessionEvent.AVATAR_END_MESSAGE]: (event: TaskEvent) => void;
  [SessionEvent.USER_MESSAGE]: (event: TaskEvent<{ message: string }>) => void;
  [SessionEvent.USER_END_MESSAGE]: (event: TaskEvent) => void;
  [SessionEvent.INACTIVITY_DETECTED]: () => void;
  [SessionEvent.DISCONNECTED]: (reason: SessionDisconnectReason) => void;
};
