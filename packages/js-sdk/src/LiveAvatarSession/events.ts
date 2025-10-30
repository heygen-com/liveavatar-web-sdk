import { SessionDisconnectReason, SessionState } from "./types";
import { ConnectionQuality } from "../QualityIndicator";

export enum SessionEvent {
  SESSION_STATE_CHANGED = "session.state_changed",
  SESSION_STREAM_READY = "session.stream_ready",
  SESSION_CONNECTION_QUALITY_CHANGED = "session.connection_quality_changed",
  SESSION_DISCONNECTED = "session.disconnected",
}

export type SessionEventCallbacks = {
  [SessionEvent.SESSION_STATE_CHANGED]: (state: SessionState) => void;
  [SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED]: (
    quality: ConnectionQuality,
  ) => void;
  [SessionEvent.SESSION_STREAM_READY]: () => void;
  [SessionEvent.SESSION_DISCONNECTED]: (
    reason: SessionDisconnectReason,
  ) => void;
};

export enum AgentEventsEnum {
  SESSION_UPDATED = "session.updated",
  SESSION_STATE_UPDATED = "session.state_updated",

  USER_SPEAK_STARTED = "user.speak_started",
  USER_SPEAK_ENDED = "user.speak_ended",
  USER_TRANSCRIPTION = "user.transcription",
  AVATAR_TRANSCRIPTION = "avatar.transcription",

  AVATAR_SPEAK_STARTED = "avatar.speak_started",
  AVATAR_SPEAK_ENDED = "avatar.speak_ended",
}

export type AgentEventData<
  T extends AgentEventsEnum,
  U extends object = object,
> = {
  event_id: string;
  event_type: T;
} & U;

export type AgentEvent =
  | AgentEventData<AgentEventsEnum.USER_SPEAK_STARTED>
  | AgentEventData<AgentEventsEnum.USER_SPEAK_ENDED>
  | AgentEventData<AgentEventsEnum.USER_TRANSCRIPTION, { text: string }>
  | AgentEventData<AgentEventsEnum.AVATAR_TRANSCRIPTION, { text: string }>
  | AgentEventData<AgentEventsEnum.AVATAR_SPEAK_STARTED>
  | AgentEventData<AgentEventsEnum.AVATAR_SPEAK_ENDED>;

export type AgentEventCallbacks = {
  [AgentEventsEnum.USER_SPEAK_STARTED]: (
    event: AgentEventData<AgentEventsEnum.USER_SPEAK_STARTED>,
  ) => void;
  [AgentEventsEnum.USER_SPEAK_ENDED]: (
    event: AgentEventData<AgentEventsEnum.USER_SPEAK_ENDED>,
  ) => void;
  [AgentEventsEnum.AVATAR_SPEAK_STARTED]: (
    event: AgentEventData<AgentEventsEnum.AVATAR_SPEAK_STARTED>,
  ) => void;
  [AgentEventsEnum.AVATAR_SPEAK_ENDED]: (
    event: AgentEventData<AgentEventsEnum.AVATAR_SPEAK_ENDED>,
  ) => void;
  [AgentEventsEnum.USER_TRANSCRIPTION]: (
    event: AgentEventData<AgentEventsEnum.USER_TRANSCRIPTION, { text: string }>,
  ) => void;
  [AgentEventsEnum.AVATAR_TRANSCRIPTION]: (
    event: AgentEventData<
      AgentEventsEnum.AVATAR_TRANSCRIPTION,
      { text: string }
    >,
  ) => void;
};

export const getAgentEventEmitArgs = (
  event: AgentEvent,
): AgentEventEmitArgs | null => {
  if ("event_type" in event) {
    switch (event.event_type) {
      case AgentEventsEnum.USER_SPEAK_STARTED: {
        const payload: AgentEventData<AgentEventsEnum.USER_SPEAK_STARTED> = {
          event_id: event.event_id,
          event_type: event.event_type,
        };
        return [AgentEventsEnum.USER_SPEAK_STARTED, payload];
      }
      case AgentEventsEnum.USER_SPEAK_ENDED: {
        const payload: AgentEventData<AgentEventsEnum.USER_SPEAK_ENDED> = {
          event_id: event.event_id,
          event_type: event.event_type,
        };
        return [AgentEventsEnum.USER_SPEAK_ENDED, payload];
      }
      case AgentEventsEnum.USER_TRANSCRIPTION: {
        const payload: AgentEventData<
          AgentEventsEnum.USER_TRANSCRIPTION,
          { text: string }
        > = {
          event_id: event.event_id,
          event_type: event.event_type,
          text: event.text,
        };
        return [AgentEventsEnum.USER_TRANSCRIPTION, payload];
      }
      case AgentEventsEnum.AVATAR_SPEAK_STARTED: {
        const payload: AgentEventData<AgentEventsEnum.AVATAR_SPEAK_STARTED> = {
          event_id: event.event_id,
          event_type: event.event_type,
        };
        return [AgentEventsEnum.AVATAR_SPEAK_STARTED, payload];
      }
      case AgentEventsEnum.AVATAR_SPEAK_ENDED: {
        const payload: AgentEventData<AgentEventsEnum.AVATAR_SPEAK_ENDED> = {
          event_id: event.event_id,
          event_type: event.event_type,
        };
        return [AgentEventsEnum.AVATAR_SPEAK_ENDED, payload];
      }
      case AgentEventsEnum.AVATAR_TRANSCRIPTION: {
        const payload: AgentEventData<
          AgentEventsEnum.AVATAR_TRANSCRIPTION,
          { text: string }
        > = {
          event_id: event.event_id,
          event_type: event.event_type,
          text: event.text,
        };
        return [AgentEventsEnum.AVATAR_TRANSCRIPTION, payload];
      }
      default:
        console.warn("New unsupported event type");
        return null;
    }
  }
  return null;
};

export enum CommandEventsEnum {
  SESSION_UPDATE = "session.update",
  SESSION_STOP = "session.stop",

  AVATAR_INTERRUPT = "avatar.interrupt",
  // AVATAR_INTERRUPT_VIDEO = "avatar.interrupt_video",

  AVATAR_SPEAK_TEXT = "avatar.speak_text",
  AVATAR_SPEAK_RESPONSE = "avatar.speak_response",
  AVATAR_SPEAK_AUDIO = "avatar.speak_audio",

  AVATAR_START_LISTENING = "avatar.start_listening",
  AVATAR_STOP_LISTENING = "avatar.stop_listening",
}

type CommandEventData<
  T extends CommandEventsEnum,
  U extends object = object,
> = {
  event_type: T;
} & U;

export type CommandEvent =
  | CommandEventData<CommandEventsEnum.SESSION_UPDATE>
  | CommandEventData<CommandEventsEnum.SESSION_STOP>
  | CommandEventData<CommandEventsEnum.AVATAR_INTERRUPT>
  // | CommandEventData<CommandEventsEnum.AVATAR_INTERRUPT_VIDEO>
  | CommandEventData<CommandEventsEnum.AVATAR_SPEAK_TEXT, { text: string }>
  | CommandEventData<CommandEventsEnum.AVATAR_SPEAK_RESPONSE, { text: string }>
  | CommandEventData<CommandEventsEnum.AVATAR_SPEAK_AUDIO, { audio: string }>
  | CommandEventData<CommandEventsEnum.AVATAR_START_LISTENING>
  | CommandEventData<CommandEventsEnum.AVATAR_STOP_LISTENING>;

export type AgentEventEmitArgs = {
  [K in keyof AgentEventCallbacks]: [K, ...Parameters<AgentEventCallbacks[K]>];
}[keyof AgentEventCallbacks];
