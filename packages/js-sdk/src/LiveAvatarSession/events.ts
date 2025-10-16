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
  USER_MESSAGE = "USER_MESSAGE",
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
  [SessionEvent.STREAM_READY]: () => void;
  [SessionEvent.USER_START_TALKING]: (event: TaskEvent) => void;
  [SessionEvent.USER_STOP_TALKING]: (event: TaskEvent) => void;
  [SessionEvent.AVATAR_START_TALKING]: (event: TaskEvent) => void;
  [SessionEvent.AVATAR_STOP_TALKING]: (event: TaskEvent) => void;
  [SessionEvent.AVATAR_MESSAGE]: (
    event: TaskEvent<{ message: string }>,
  ) => void;
  [SessionEvent.USER_MESSAGE]: (event: TaskEvent<{ message: string }>) => void;
  [SessionEvent.INACTIVITY_DETECTED]: () => void;
  [SessionEvent.DISCONNECTED]: (reason: SessionDisconnectReason) => void;
};

export type SessionEmitArgs = {
  [K in keyof SessionEventCallbacks]: [
    K,
    ...Parameters<SessionEventCallbacks[K]>,
  ];
}[keyof SessionEventCallbacks];

enum ServerEvent {
  AVATAR_START_TALKING = "avatar_start_talking",
  AVATAR_STOP_TALKING = "avatar_stop_talking",
  USER_START_TALKING = "user_start_talking",
  USER_STOP_TALKING = "user_stop_talking",
  AVATAR_TALKING_MESSAGE = "avatar_talking_message",
  USER_TALKING_MESSAGE = "user_talking_message",
}

type ServerEventData<T extends ServerEvent, U extends object = object> = {
  task_id: string;
  type: T;
} & U;

export type ServerEventType =
  | ServerEventData<
      | ServerEvent.AVATAR_START_TALKING
      | ServerEvent.AVATAR_STOP_TALKING
      | ServerEvent.USER_START_TALKING
      | ServerEvent.USER_STOP_TALKING
    >
  | ServerEventData<ServerEvent.AVATAR_TALKING_MESSAGE, { message: string }>
  | ServerEventData<ServerEvent.USER_TALKING_MESSAGE, { message: string }>;

export const getEventEmitterArgs = (
  event: ServerEventType,
): SessionEmitArgs | null => {
  if ("type" in event) {
    switch (event.type) {
      case ServerEvent.AVATAR_START_TALKING: {
        const payload: TaskEvent = { task_id: event.task_id };
        return [SessionEvent.AVATAR_START_TALKING, payload];
      }
      case ServerEvent.AVATAR_STOP_TALKING: {
        const payload: TaskEvent = { task_id: event.task_id };
        return [SessionEvent.AVATAR_STOP_TALKING, payload];
      }
      case ServerEvent.AVATAR_TALKING_MESSAGE: {
        const payload: TaskEvent<{ message: string }> = {
          task_id: event.task_id,
          message: event.message,
        };
        return [SessionEvent.AVATAR_MESSAGE, payload];
      }
      case ServerEvent.USER_TALKING_MESSAGE: {
        const payload: TaskEvent<{ message: string }> = {
          task_id: event.task_id,
          message: event.message,
        };
        return [SessionEvent.USER_MESSAGE, payload];
      }
      case ServerEvent.USER_START_TALKING: {
        const payload: TaskEvent = { task_id: event.task_id };
        return [SessionEvent.USER_START_TALKING, payload];
      }
      case ServerEvent.USER_STOP_TALKING: {
        const payload: TaskEvent = { task_id: event.task_id };
        return [SessionEvent.USER_STOP_TALKING, payload];
      }
    }
  }

  return null;
};
