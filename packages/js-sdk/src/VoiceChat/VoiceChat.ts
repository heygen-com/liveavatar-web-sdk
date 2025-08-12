import { EventEmitter } from "events";
import TypedEmitter from "typed-emitter";
import {
  createLocalAudioTrack,
  LocalAudioTrack,
  Room,
  TrackEvent,
  RoomEvent,
  Track,
} from "livekit-client";
import { VoiceChatEvent, VoiceChatEventCallbacks } from "./events";
import { VoiceChatConfig, VoiceChatState } from "./types";

// TODO: investigate if RoomEvent.ActiveDeviceChanged is fired when device is set on local audio track.
// If not, then investigate other options or implement custom device change logic.

// TODO: add checks for voice chat methods to ensure that session is active.
export class VoiceChat extends (EventEmitter as new () => TypedEmitter<VoiceChatEventCallbacks>) {
  private readonly room: Room;
  private _state: VoiceChatState = VoiceChatState.INACTIVE;
  private track: LocalAudioTrack | null = null;

  constructor(room: Room) {
    super();
    this.room = room;
  }

  public get state(): VoiceChatState {
    return this._state;
  }

  public async start(config: VoiceChatConfig = {}): Promise<void> {
    if (this._state !== VoiceChatState.INACTIVE) {
      console.warn("Voice chat is already started");
      return;
    }

    this.state = VoiceChatState.STARTING;

    const { defaultMuted, deviceId } = config;

    this.track = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      deviceId,
    });

    if (defaultMuted) {
      await this.track.mute();
    }

    await this.room.localParticipant.publishTrack(this.track);

    this.track.on(TrackEvent.Muted, () => {
      this.emit(VoiceChatEvent.MUTED);
    });

    this.track.on(TrackEvent.Unmuted, () => {
      this.emit(VoiceChatEvent.UNMUTED);
    });

    this.room.on(RoomEvent.ActiveDeviceChanged, (kind, deviceId) => {
      if (kind === "audioinput") {
        this.emit(VoiceChatEvent.DEVICE_CHANGED, deviceId);
      }
    });

    this.state = VoiceChatState.ACTIVE;
  }

  public async stop(): Promise<void> {
    this.room.localParticipant.getTrackPublications().forEach((publication) => {
      if (publication.track && publication.track.kind === Track.Kind.Audio) {
        publication.track.stop();
      }
    });

    if (this.track) {
      this.track.removeAllListeners();
      this.track.stop();
      this.track = null;
    }

    this.state = VoiceChatState.INACTIVE;
  }

  public async mute(): Promise<void> {
    if (this.track) {
      this.track.mute();
    }
  }

  public async unmute(): Promise<void> {
    if (this.track) {
      this.track.unmute();
    }
  }

  public async setDevice(deviceId: ConstrainDOMString): Promise<boolean> {
    if (this.track) {
      return this.track.setDeviceId(deviceId);
    }
    return false;
  }

  private set state(state: VoiceChatState) {
    if (this._state !== state) {
      this._state = state;
      this.emit(VoiceChatEvent.STATE_CHANGED, state);
    }
  }
}
