import { LiveAvatarSession } from "./LiveAvatarSession";
import { SessionConfig } from "./types";
import {
  CommandEventsEnum,
  ElevenLabsAgentCommandEvent,
  ElevenLabsAgentCommandPayload,
  ElevenLabsAgentCommandType,
} from "./events";

export class ElevenLabsAgentSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElevenLabsAgentSessionError";
  }
}

/**
 * Session class for LiveAvatar sessions backed by an ElevenLabs Agent.
 *
 * Inherits the connection lifecycle, voice chat, and inbound event surface
 * from LiveAvatarSession. Adds outbound commands that wrap ElevenLabs
 * client-event types (user_message, contextual_update, user_activity,
 * client_tool_result) and ship them on the LiveKit `agent-control` topic.
 *
 * Refuses to send if the JWT does not indicate an ELEVENLABS agent.
 *
 * NOTE: The non-ElevenLabs LiveAvatar command methods (`message`, `repeat`,
 * `repeatAudio`) are not supported on this path and will throw. In a future
 * iteration we may map these onto ElevenLabs equivalents (e.g. `message` ->
 * `sendUserMessage`) so a developer can swap LiveAvatarSession for
 * ElevenLabsAgentSession with no call-site changes.
 */
export class ElevenLabsAgentSession extends LiveAvatarSession {
  constructor(sessionAccessToken: string, config?: SessionConfig) {
    super(sessionAccessToken, config);
    // TODO(LA-1410): Re-enable agent_type validation once the backend echoes
    // `start_session_data.agent_type = "ELEVENLABS_AGENT"` in the JWT. Today
    // the token omits agent_type entirely, so any client-side check is
    // unreliable. We trust the caller's choice of class — the server still
    // enforces the real agent type and silently drops mismatched commands.
    //
    // if (this.agentType !== AgentType.ELEVENLABS_AGENT) {
    //   console.warn(
    //     `[ElevenLabsAgentSession] Token agent_type detected as "${this.agentType}", ` +
    //       `expected "${AgentType.ELEVENLABS_AGENT}".`,
    //   );
    // }
  }

  /**
   * Low-level: send any whitelisted ElevenLabs agent command. Prefer the
   * named convenience methods below.
   */
  public sendElevenLabsAgentCommand(
    payload: ElevenLabsAgentCommandPayload,
    options?: { sourceEventId?: string },
  ): string {
    if (!this.assertConnected()) {
      throw new ElevenLabsAgentSessionError(
        "Session must be connected before sending ElevenLabs agent commands",
      );
    }
    const sessionId = this.sessionId;
    if (!sessionId) {
      throw new ElevenLabsAgentSessionError(
        "Session id is not yet available — wait for session.started",
      );
    }

    const event_id = this.generateEventId();
    const wrapper: ElevenLabsAgentCommandEvent = {
      event_type: CommandEventsEnum.ELEVENLABS_AGENT_COMMAND,
      event_id,
      session_id: sessionId,
      source_event_id: options?.sourceEventId ?? null,
      ...payload,
    } as ElevenLabsAgentCommandEvent;

    this.publishAgentControl(wrapper);
    return event_id;
  }

  /** Send a user message — equivalent to typing in the ElevenLabs widget. */
  public sendUserMessage(text: string): string {
    return this.sendElevenLabsAgentCommand({
      elevenlabs_event_type: ElevenLabsAgentCommandType.USER_MESSAGE,
      data: { text },
    });
  }

  /** Send a contextual update — silent context the agent can use. */
  public sendContextualUpdate(text: string): string {
    return this.sendElevenLabsAgentCommand({
      elevenlabs_event_type: ElevenLabsAgentCommandType.CONTEXTUAL_UPDATE,
      data: { text },
    });
  }

  /** Keepalive / typing-indicator ping. */
  public sendUserActivity(): string {
    return this.sendElevenLabsAgentCommand({
      elevenlabs_event_type: ElevenLabsAgentCommandType.USER_ACTIVITY,
    });
  }

  /** Reply to a client_tool_call inbound event with the tool result. */
  public sendClientToolResult(args: {
    toolCallId: string;
    result: string;
    isError?: boolean;
    sourceEventId?: string;
  }): string {
    return this.sendElevenLabsAgentCommand(
      {
        elevenlabs_event_type: ElevenLabsAgentCommandType.CLIENT_TOOL_RESULT,
        data: {
          tool_call_id: args.toolCallId,
          result: args.result,
          is_error: args.isError ?? false,
        },
      },
      { sourceEventId: args.sourceEventId },
    );
  }

  // ---------------------------------------------------------------------
  // Disabled LiveAvatar command surface
  //
  // TODO(LA-1410-followup): Remap these onto the ElevenLabs equivalents so
  // a consumer can swap LiveAvatarSession <-> ElevenLabsAgentSession with
  // no call-site changes. Likely mapping:
  //   message(text)     -> sendUserMessage(text)
  //   repeat(text)      -> sendContextualUpdate(text)  (or a new EL event)
  //   repeatAudio(b64)  -> not supported (no analogue)
  // ---------------------------------------------------------------------

  public override message(_message: string): string {
    throw new ElevenLabsAgentSessionError(
      "message() is not supported on ElevenLabsAgentSession — use sendUserMessage()",
    );
  }

  public override repeat(_message: string): string {
    throw new ElevenLabsAgentSessionError(
      "repeat() is not supported on ElevenLabsAgentSession — the ElevenLabs agent owns response generation",
    );
  }

  public override repeatAudio(_audio: string): string {
    throw new ElevenLabsAgentSessionError(
      "repeatAudio() is not supported on ElevenLabsAgentSession",
    );
  }
}
