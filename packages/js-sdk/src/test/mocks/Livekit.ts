import { EventEmitter } from "events";
import { vi } from "vitest";
import {
  ConnectionQuality,
  ConnectionState,
  ParticipantEvent,
  RoomEvent,
  TrackEvent,
  TrackPublication,
} from "livekit-client";
import { testContext } from "../utils/testContext";
import { LIVEKIT_SERVER_RESPONSE_CHANNEL_TOPIC } from "../../LiveAvatarSession/const";

export class LocalAudioTrackMock extends EventEmitter {
  isMuted = false;

  constructor() {
    super();
  }

  async mute() {
    this.isMuted = true;
    this.emit(TrackEvent.Muted);
  }

  async unmute() {
    this.isMuted = false;
    this.emit(TrackEvent.Unmuted);
  }

  setDeviceId = vi.fn(async () => {
    return true;
  });

  stop = vi.fn(async () => {
    return true;
  });
}

export class LocalParticipantMock extends EventEmitter {
  trackPublications: TrackPublication[] = [];

  constructor() {
    super();
  }
  async publishTrack(track: LocalAudioTrackMock) {
    this.trackPublications.push({
      track: track as LocalAudioTrackMock,
    } as unknown as TrackPublication);
  }
  getTrackPublications() {
    return this.trackPublications;
  }
  publishData = vi.fn(() => {});

  _triggerConnectionQualityChanged = (quality: ConnectionQuality) => {
    this.emit(ParticipantEvent.ConnectionQualityChanged, quality);
  };
}

export class RoomMock extends EventEmitter {
  constructor() {
    super();
    testContext.roomInstance = this;
  }

  name = "mock-room";
  sid = "mock-room-sid";
  remoteParticipants = new Map();
  localParticipant = new LocalParticipantMock();
  participants = new Map();
  state = "disconnected";
  connect = vi.fn(async () => {
    this.state = "connecting";
    await new Promise((resolve) => setTimeout(resolve, 10));
    this.state = "connected";
    this.emit(RoomEvent.Connected);
    this.emit(RoomEvent.ActiveSpeakersChanged, [this.localParticipant]);
    this.emit(RoomEvent.ConnectionStateChanged, ConnectionState.Connected);
    return this;
  });
  prepareConnection = vi.fn(async () => {
    return Promise.resolve();
  });
  disconnect = vi.fn(async () => {
    this.state = "disconnected";
    this.emit(RoomEvent.Disconnected);
    return Promise.resolve();
  });
  engine = {
    pcManager: { subscriber: { _pc: {} } },
  };

  _triggerTrackSubscribed(kind: string) {
    this.emit(
      RoomEvent.TrackSubscribed,
      { kind, mediaStreamTrack: { kind } },
      null,
      {
        identity: "heygen",
      },
    );
  }

  _triggerDataReceived(data: any) {
    const message = new TextEncoder().encode(JSON.stringify(data));
    this.emit(
      RoomEvent.DataReceived,
      message,
      null,
      null,
      LIVEKIT_SERVER_RESPONSE_CHANNEL_TOPIC,
    );
  }

  _triggerConnectionStateChanged(state: ConnectionState) {
    this.emit(RoomEvent.ConnectionStateChanged, state);
  }

  _triggerConnectionQualityChanged(quality: ConnectionQuality) {
    this.localParticipant._triggerConnectionQualityChanged(quality);
  }

  _triggerDisconnected() {
    this.emit(RoomEvent.Disconnected);
  }
}

export const createLocalAudioTrack = async () => {
  return new LocalAudioTrackMock();
};

// export const Room = vi.fn(RoomMock);
