import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ElevenLabsAgentSession,
  ElevenLabsAgentSessionError,
} from "./ElevenLabsAgentSession";
import { AgentType, SessionInfo } from "./types";
import { CommandEventsEnum, ElevenLabsAgentCommandType } from "./events";
import { LIVEKIT_COMMAND_CHANNEL_TOPIC } from "../const";
import { mockFetch } from "../test/utils/mockFetch";
import { testContext } from "../test/utils/testContext";
import { parseAgentTypeFromToken } from "./LiveAvatarSession";

beforeEach(() => {
  vi.resetAllMocks();
});

const sessionInfoMock: SessionInfo = {
  session_id: "mock-session-id",
  max_session_duration: null,
  livekit_url: "mock-livekit-url",
  livekit_client_token: "mock-livekit-client-token",
};

const buildJwt = (payload: Record<string, any>): string => {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const body = btoa(JSON.stringify(payload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.sig`;
};

const elevenLabsToken = buildJwt({
  start_session_data: {
    mode: "LITE",
    elevenlabs_agent_config: {
      agent_id: "agent_test",
      secret_id: "secret_test",
    },
  },
});

const fullToken = buildJwt({
  start_session_data: { mode: "FULL" },
});

const setupSession = (token: string) => {
  testContext.sessionId = sessionInfoMock.session_id;
  mockFetch(
    {
      url: "/v1/sessions/start",
      method: "POST",
      response: { data: sessionInfoMock, code: 1000 },
    },
    {
      url: "/v1/sessions/stop",
      method: "POST",
      response: { code: 1000 },
    },
  );
  return new ElevenLabsAgentSession(token);
};

describe("parseAgentTypeFromToken", () => {
  it("returns ELEVENLABS for tokens with elevenlabs_agent_config", () => {
    expect(parseAgentTypeFromToken(elevenLabsToken)).toBe(
      AgentType.ELEVENLABS_AGENT,
    );
  });

  it("returns FULL for plain full-mode tokens", () => {
    expect(parseAgentTypeFromToken(fullToken)).toBe(AgentType.FULL);
  });

  it("returns UNKNOWN for non-JWT tokens", () => {
    expect(parseAgentTypeFromToken("not-a-jwt")).toBe(AgentType.UNKNOWN);
  });
});

describe("ElevenLabsAgentSession constructor", () => {
  it("constructs successfully when JWT indicates ELEVENLABS", () => {
    const session = setupSession(elevenLabsToken);
    expect(session.agentType).toBe(AgentType.ELEVENLABS_AGENT);
  });

  it("does not throw when JWT does not indicate ELEVENLABS_AGENT (validation deferred to backend)", () => {
    const session = new ElevenLabsAgentSession(fullToken);
    expect(session.agentType).toBe(AgentType.FULL);
  });
});

describe("ElevenLabsAgentSession command publishing", () => {
  it("publishes user_message wrapper to agent-control topic", async () => {
    const session = setupSession(elevenLabsToken);
    await session.start();
    const publishData = (session as any).room.localParticipant
      .publishData as ReturnType<typeof vi.fn>;
    publishData.mockClear();

    const eventId = session.sendUserMessage("hello agent");

    expect(publishData).toHaveBeenCalledTimes(1);
    const [bytes, opts] = publishData.mock.calls[0];
    expect(opts.topic).toBe(LIVEKIT_COMMAND_CHANNEL_TOPIC);
    expect(opts.reliable).toBe(true);
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    expect(payload).toMatchObject({
      event_type: CommandEventsEnum.ELEVENLABS_AGENT_COMMAND,
      session_id: sessionInfoMock.session_id,
      elevenlabs_event_type: ElevenLabsAgentCommandType.USER_MESSAGE,
      data: { text: "hello agent" },
    });
    expect(payload.event_id).toBe(eventId);
  });

  it("publishes contextual_update with text data", async () => {
    const session = setupSession(elevenLabsToken);
    await session.start();
    const publishData = (session as any).room.localParticipant
      .publishData as ReturnType<typeof vi.fn>;
    publishData.mockClear();

    session.sendContextualUpdate("user on pricing page");

    const payload = JSON.parse(
      new TextDecoder().decode(publishData.mock.calls[0][0]),
    );
    expect(payload.elevenlabs_event_type).toBe(
      ElevenLabsAgentCommandType.CONTEXTUAL_UPDATE,
    );
    expect(payload.data).toEqual({ text: "user on pricing page" });
  });

  it("publishes user_activity with no data field required", async () => {
    const session = setupSession(elevenLabsToken);
    await session.start();
    const publishData = (session as any).room.localParticipant
      .publishData as ReturnType<typeof vi.fn>;
    publishData.mockClear();

    session.sendUserActivity();

    const payload = JSON.parse(
      new TextDecoder().decode(publishData.mock.calls[0][0]),
    );
    expect(payload.elevenlabs_event_type).toBe(
      ElevenLabsAgentCommandType.USER_ACTIVITY,
    );
  });

  it("publishes client_tool_result with tool_call_id, result, is_error", async () => {
    const session = setupSession(elevenLabsToken);
    await session.start();
    const publishData = (session as any).room.localParticipant
      .publishData as ReturnType<typeof vi.fn>;
    publishData.mockClear();

    session.sendClientToolResult({
      toolCallId: "tool_abc",
      result: '{"ok":true}',
      isError: false,
    });

    const payload = JSON.parse(
      new TextDecoder().decode(publishData.mock.calls[0][0]),
    );
    expect(payload.data).toEqual({
      tool_call_id: "tool_abc",
      result: '{"ok":true}',
      is_error: false,
    });
  });

  it("throws when session not connected", () => {
    const session = setupSession(elevenLabsToken);
    expect(() => session.sendUserMessage("hi")).toThrow(
      ElevenLabsAgentSessionError,
    );
  });

  it("throws on legacy LiveAvatar command methods", async () => {
    const session = setupSession(elevenLabsToken);
    await session.start();
    expect(() => session.message("hi")).toThrow(ElevenLabsAgentSessionError);
    expect(() => session.repeat("hi")).toThrow(ElevenLabsAgentSessionError);
    expect(() => session.repeatAudio("hi")).toThrow(
      ElevenLabsAgentSessionError,
    );
  });
});
