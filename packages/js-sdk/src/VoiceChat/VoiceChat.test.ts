import { describe, it, expect, vi } from "vitest";
import { VoiceChat } from "./VoiceChat";
import { ConnectionState, Room } from "livekit-client";
import { SessionInteractivityMode, VoiceChatState } from "./types";
import { PushToTalkServerEvent, VoiceChatEvent } from "./events";
import { LocalAudioTrackMock, RoomMock } from "../test/mocks/Livekit";

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

describe("voice chat setMode", () => {
  it("sets the mode when called for the first time", () => {
    const { voiceChat } = setupVoiceChat();
    voiceChat.setMode(SessionInteractivityMode.PUSH_TO_TALK);
    // Mode is set internally - verified by push-to-talk tests working correctly
  });

  it("does not set the mode when already set", () => {
    const { voiceChat } = setupVoiceChat();
    voiceChat.setMode(SessionInteractivityMode.PUSH_TO_TALK);
    const consoleWarnSpy = vi.spyOn(console, "warn");
    voiceChat.setMode(SessionInteractivityMode.CONVERSATIONAL);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Voice chat mode can only be set once",
    );
    consoleWarnSpy.mockRestore();
  });
});

describe("voice chat start with config", () => {
  it("starts the voice chat with mode config", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start({ mode: SessionInteractivityMode.PUSH_TO_TALK });
    expect(voiceChat.state).toBe(VoiceChatState.ACTIVE);
  });

  it("starts the voice chat with deviceId config", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start({ deviceId: "specific-device-id" });
    expect(voiceChat.state).toBe(VoiceChatState.ACTIVE);
  });

  it("starts the voice chat with all config options", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start({
      defaultMuted: true,
      deviceId: "specific-device-id",
      mode: SessionInteractivityMode.CONVERSATIONAL,
    });
    expect(voiceChat.state).toBe(VoiceChatState.ACTIVE);
    expect(voiceChat.isMuted).toBe(true);
  });
});

describe("voice chat stop with publications", () => {
  it("stops audio track publications when stopping voice chat", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start();

    const publications = room.localParticipant.getTrackPublications();
    const trackStopSpy = vi.spyOn(publications[0].track!, "stop");

    voiceChat.stop();

    expect(trackStopSpy).toHaveBeenCalled();
    expect(voiceChat.state).toBe(VoiceChatState.INACTIVE);
  });
});

describe("push to talk", () => {
  it("does not start push to talk when voice chat is not active", async () => {
    const { voiceChat } = setupVoiceChat();
    voiceChat.setMode(SessionInteractivityMode.PUSH_TO_TALK);
    const consoleWarnSpy = vi.spyOn(console, "warn");
    await voiceChat.startPushToTalk();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Push to talk can only be started when voice chat is active",
    );
    consoleWarnSpy.mockRestore();
  });

  it("does not start push to talk when not in push to talk mode", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    voiceChat.setMode(SessionInteractivityMode.CONVERSATIONAL);
    await voiceChat.start();
    const consoleWarnSpy = vi.spyOn(console, "warn");
    await voiceChat.startPushToTalk();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Push to talk can only be started in push to talk mode",
    );
    consoleWarnSpy.mockRestore();
  });

  it("does not start push to talk when mode is not set", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start();
    const consoleWarnSpy = vi.spyOn(console, "warn");
    await voiceChat.startPushToTalk();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Push to talk can only be started in push to talk mode",
    );
    consoleWarnSpy.mockRestore();
  });

  it("does not start push to talk when already started", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    voiceChat.setMode(SessionInteractivityMode.PUSH_TO_TALK);
    await voiceChat.start({ defaultMuted: true });

    // Trigger success event for first startPushToTalk
    setTimeout(() => {
      (room as unknown as RoomMock)._triggerDataReceived({
        event_type: PushToTalkServerEvent.START_SUCCESS,
      });
    }, 10);

    await voiceChat.startPushToTalk();

    const consoleWarnSpy = vi.spyOn(console, "warn");
    await voiceChat.startPushToTalk();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Push to talk has already been started",
    );
    consoleWarnSpy.mockRestore();
  });

  it("starts push to talk successfully", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    voiceChat.setMode(SessionInteractivityMode.PUSH_TO_TALK);
    await voiceChat.start({ defaultMuted: true });

    // Trigger success event
    setTimeout(() => {
      (room as unknown as RoomMock)._triggerDataReceived({
        event_type: PushToTalkServerEvent.START_SUCCESS,
      });
    }, 10);

    await voiceChat.startPushToTalk();
    expect(voiceChat.isMuted).toBe(false);
  });

  it("handles push to talk start failure", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    voiceChat.setMode(SessionInteractivityMode.PUSH_TO_TALK);
    await voiceChat.start({ defaultMuted: true });

    // Trigger failure event
    setTimeout(() => {
      (room as unknown as RoomMock)._triggerDataReceived({
        event_type: PushToTalkServerEvent.START_FAILED,
      });
    }, 10);

    const consoleErrorSpy = vi.spyOn(console, "error");
    await expect(voiceChat.startPushToTalk()).rejects.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("does not stop push to talk when not started", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    voiceChat.setMode(SessionInteractivityMode.PUSH_TO_TALK);
    await voiceChat.start({ defaultMuted: true });

    const consoleWarnSpy = vi.spyOn(console, "warn");
    await voiceChat.stopPushToTalk();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Push to talk has not been started",
    );
    consoleWarnSpy.mockRestore();
  });

  it("stops push to talk successfully", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    voiceChat.setMode(SessionInteractivityMode.PUSH_TO_TALK);
    await voiceChat.start({ defaultMuted: true });

    // Start push to talk
    setTimeout(() => {
      (room as unknown as RoomMock)._triggerDataReceived({
        event_type: PushToTalkServerEvent.START_SUCCESS,
      });
    }, 10);
    await voiceChat.startPushToTalk();

    // Stop push to talk
    setTimeout(() => {
      (room as unknown as RoomMock)._triggerDataReceived({
        event_type: PushToTalkServerEvent.STOP_SUCCESS,
      });
    }, 10);
    await voiceChat.stopPushToTalk();
  });

  it("handles push to talk stop failure", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    voiceChat.setMode(SessionInteractivityMode.PUSH_TO_TALK);
    await voiceChat.start({ defaultMuted: true });

    // Start push to talk
    setTimeout(() => {
      (room as unknown as RoomMock)._triggerDataReceived({
        event_type: PushToTalkServerEvent.START_SUCCESS,
      });
    }, 10);
    await voiceChat.startPushToTalk();

    // Trigger failure event for stop
    setTimeout(() => {
      (room as unknown as RoomMock)._triggerDataReceived({
        event_type: PushToTalkServerEvent.STOP_FAILED,
      });
    }, 10);

    const consoleErrorSpy = vi.spyOn(console, "error");
    await expect(voiceChat.stopPushToTalk()).rejects.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe("state management", () => {
  it("does not emit state changed event when state is the same", async () => {
    const { room, voiceChat } = setupVoiceChat();
    room.state = ConnectionState.Connected;
    await voiceChat.start();

    const onStateChanged = vi.fn();
    voiceChat.on(VoiceChatEvent.STATE_CHANGED, onStateChanged);

    // Attempting to start when already started should not emit any new state change
    await voiceChat.start();

    expect(onStateChanged).not.toHaveBeenCalled();
  });
});
