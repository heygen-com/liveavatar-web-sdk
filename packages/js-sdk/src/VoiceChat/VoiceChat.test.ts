import { describe, it, expect, vi } from "vitest";
import { VoiceChat } from "./VoiceChat";
import { ConnectionState, Room } from "livekit-client";
import { VoiceChatState } from "./types";
import { VoiceChatEvent } from "./events";
import { LocalAudioTrackMock } from "../test/mocks/Livekit";

const setupVoiceChat = () => {
  const room = new Room();
  const voiceChat = new VoiceChat(room);
  return { room, voiceChat };
};

describe("voice chat start", () => {
  it("does not start the voice chat when the room is disconnected", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.disconnect();
    await voiceChat.start();
    expect(voiceChat.state).toBe(VoiceChatState.INACTIVE);
  });

  it("does not start the voice chat when the room is connecting", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connecting;
    await voiceChat.start();
    expect(voiceChat.state).toBe(VoiceChatState.INACTIVE);
  });

  it("does not start the voice chat when the voice chat is already started", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start();
    expect(voiceChat.state).toBe(VoiceChatState.ACTIVE);
    const onStateChanged = vi.fn();
    voiceChat.on(VoiceChatEvent.STATE_CHANGED, onStateChanged);
    await voiceChat.start();
    expect(onStateChanged).not.toHaveBeenCalled();
    expect(voiceChat.state).toBe(VoiceChatState.ACTIVE);
  });

  it("starts the voice chat and emits state changed events", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    const onStateChanged = vi.fn();
    voiceChat.on(VoiceChatEvent.STATE_CHANGED, onStateChanged);
    await voiceChat.start();
    expect(voiceChat.state).toBe(VoiceChatState.ACTIVE);
    expect(onStateChanged).toHaveBeenCalledTimes(2);
    expect(onStateChanged).toHaveBeenNthCalledWith(1, VoiceChatState.STARTING);
    expect(onStateChanged).toHaveBeenNthCalledWith(2, VoiceChatState.ACTIVE);
  });

  it("starts the voice chat and emits unmuted event", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    const onUnmuted = vi.fn();
    voiceChat.on(VoiceChatEvent.UNMUTED, onUnmuted);
    await voiceChat.start();
    expect(onUnmuted).toHaveBeenCalledTimes(1);
  });

  it("starts the voice chat and emits muted event", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    const onMuted = vi.fn();
    voiceChat.on(VoiceChatEvent.MUTED, onMuted);
    await voiceChat.start({ defaultMuted: true });
    expect(onMuted).toHaveBeenCalledTimes(1);
  });
});

describe("voice chat mute", () => {
  it("does not mute the voice chat when the voice chat is not active", async () => {
    const { voiceChat } = setupVoiceChat();
    const onMuted = vi.fn();
    voiceChat.on(VoiceChatEvent.MUTED, onMuted);
    await voiceChat.mute();
    expect(onMuted).not.toHaveBeenCalled();
    expect(voiceChat.isMuted).toBe(true);
  });

  it("does not unmute the voice chat when the voice chat is not active", async () => {
    const { voiceChat } = setupVoiceChat();
    const onUnmuted = vi.fn();
    voiceChat.on(VoiceChatEvent.UNMUTED, onUnmuted);
    await voiceChat.unmute();
    expect(onUnmuted).not.toHaveBeenCalled();
    expect(voiceChat.isMuted).toBe(true);
  });

  it("emits muted event when the voice chat is muted", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start();
    const onMuted = vi.fn();
    voiceChat.on(VoiceChatEvent.MUTED, onMuted);
    await voiceChat.mute();
    expect(onMuted).toHaveBeenCalledTimes(1);
    expect(voiceChat.isMuted).toBe(true);
  });

  it("emits unmuted event when the voice chat is unmuted", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start({ defaultMuted: true });
    const onUnmuted = vi.fn();
    voiceChat.on(VoiceChatEvent.UNMUTED, onUnmuted);
    await voiceChat.unmute();
    expect(onUnmuted).toHaveBeenCalledTimes(1);
    expect(voiceChat.isMuted).toBe(false);
  });
});

describe("voice chat stop", () => {
  it("does not stop the voice chat when the voice chat is not active", async () => {
    const { voiceChat } = setupVoiceChat();
    const onStateChanged = vi.fn();
    voiceChat.on(VoiceChatEvent.STATE_CHANGED, onStateChanged);
    voiceChat.stop();
    expect(onStateChanged).not.toHaveBeenCalled();
  });

  it("stops the voice chat and emits state changed events", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start();
    const onStateChanged = vi.fn();
    voiceChat.on(VoiceChatEvent.STATE_CHANGED, onStateChanged);
    voiceChat.stop();
    expect(onStateChanged).toHaveBeenCalledWith(VoiceChatState.INACTIVE);
  });
});

describe("voice chat set device", () => {
  it("does not set the device when the voice chat is not active", async () => {
    const { voiceChat } = setupVoiceChat();
    const result = await voiceChat.setDevice("mock-device-id");
    expect(result).toBe(false);
  });

  it("sets the device when the voice chat is active", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start();
    const result = await voiceChat.setDevice("mock-device-id");
    expect(result).toBe(true);
    const track = room.localParticipant.getTrackPublications()[0].track;
    expect(
      (track as unknown as LocalAudioTrackMock).setDeviceId,
    ).toHaveBeenCalledWith("mock-device-id");
  });
});
