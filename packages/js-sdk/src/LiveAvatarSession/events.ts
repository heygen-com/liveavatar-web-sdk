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

// Build a discriminated union of emit argument tuples from the callbacks map
export type SessionEmitArgs = {
  [K in keyof SessionEventCallbacks]: [
    K,
    ...Parameters<SessionEventCallbacks[K]>,
  ];
}[keyof SessionEventCallbacks];

enum LegacyWSEvent {
  USER_START = "user_start",
  USER_STOP = "user_stop",
}

interface WSEvent<T extends LegacyWSEvent> {
  event_type: T;
}

type WSEventType =
  | WSEvent<LegacyWSEvent.USER_START>
  | WSEvent<LegacyWSEvent.USER_STOP>;

enum LivekitChannelEvent {
  AVATAR_START_TALKING = "avatar_start_talking",
  AVATAR_STOP_TALKING = "avatar_stop_talking",
  AVATAR_TALKING_MESSAGE = "avatar_talking_message",
  AVATAR_END_MESSAGE = "avatar_end_message",
  USER_TALKING_MESSAGE = "user_talking_message",
  USER_END_MESSAGE = "user_end_message",
}

interface LivekitEvent<T extends LivekitChannelEvent> {
  task_id: string;
  type: T;
}

interface AvatarTalkingMessageEvent
  extends LivekitEvent<LivekitChannelEvent.AVATAR_TALKING_MESSAGE> {
  message: string;
}

interface UserTalkingMessageEvent
  extends LivekitEvent<LivekitChannelEvent.USER_TALKING_MESSAGE> {
  message: string;
}

type LivekitEventType =
  | LivekitEvent<LivekitChannelEvent.AVATAR_START_TALKING>
  | LivekitEvent<LivekitChannelEvent.AVATAR_STOP_TALKING>
  | AvatarTalkingMessageEvent
  | LivekitEvent<LivekitChannelEvent.AVATAR_END_MESSAGE>
  | UserTalkingMessageEvent
  | LivekitEvent<LivekitChannelEvent.USER_END_MESSAGE>;

export const getEventEmitterArgs = (
  event: WSEventType | LivekitEventType,
): SessionEmitArgs | null => {
  if ("event_type" in event) {
    switch (event.event_type) {
      case LegacyWSEvent.USER_START:
        return [SessionEvent.USER_START_TALKING];
      case LegacyWSEvent.USER_STOP:
        return [SessionEvent.USER_STOP_TALKING];
    }
  }

  if ("type" in event) {
    switch (event.type) {
      case LivekitChannelEvent.AVATAR_START_TALKING: {
        const payload: TaskEvent = { task_id: event.task_id };
        return [SessionEvent.AVATAR_START_TALKING, payload];
      }
      case LivekitChannelEvent.AVATAR_STOP_TALKING: {
        const payload: TaskEvent = { task_id: event.task_id };
        return [SessionEvent.AVATAR_STOP_TALKING, payload];
      }
      case LivekitChannelEvent.AVATAR_TALKING_MESSAGE: {
        const payload: TaskEvent<{ message: string }> = {
          task_id: event.task_id,
          message: event.message,
        };
        return [SessionEvent.AVATAR_MESSAGE, payload];
      }
      case LivekitChannelEvent.AVATAR_END_MESSAGE: {
        const payload: TaskEvent = { task_id: event.task_id };
        return [SessionEvent.AVATAR_END_MESSAGE, payload];
      }
      case LivekitChannelEvent.USER_TALKING_MESSAGE: {
        const payload: TaskEvent<{ message: string }> = {
          task_id: event.task_id,
          message: event.message,
        };
        return [SessionEvent.USER_MESSAGE, payload];
      }
      case LivekitChannelEvent.USER_END_MESSAGE: {
        const payload: TaskEvent = { task_id: event.task_id };
        return [SessionEvent.USER_END_MESSAGE, payload];
      }
    }
  }

  return null;
};

export type ServerEvent = WSEventType | LivekitEventType;
