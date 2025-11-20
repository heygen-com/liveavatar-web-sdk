import { EventEmitter } from "events";
import { vi } from "vitest";
import {
  ConnectionQuality,
  ConnectionState,
  ParticipantEvent,
  RoomEvent,
} from "livekit-client";
import { testContext } from "../utils/testContext";

export class LocalParticipantMock extends EventEmitter {
  constructor() {
    super();
  }
  publishTrack = vi.fn<() => Promise<void>>();
  getTrackPublications() {
    return [];
  }

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
    this.emit(RoomEvent.TrackSubscribed, {
      kind,
      mediaStreamTrack: new MediaStreamTrack(),
    });
  }

  _triggerDataReceived(data: any) {
    const message = new TextEncoder().encode(JSON.stringify(data));
    this.emit(RoomEvent.DataReceived, message);
  }

  _triggerConnectionStateChanged(state: ConnectionState) {
    this.emit(RoomEvent.ConnectionStateChanged, state);
  }

  _triggerConnectionQualityChanged(quality: ConnectionQuality) {
    this.localParticipant._triggerConnectionQualityChanged(quality);
  }
}

// export const Room = vi.fn(RoomMock);
