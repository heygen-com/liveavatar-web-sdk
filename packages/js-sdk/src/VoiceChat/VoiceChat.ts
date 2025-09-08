import { EventEmitter } from "events";
import TypedEmitter from "typed-emitter";
import {
  createLocalAudioTrack,
  LocalAudioTrack,
  Room,
  TrackEvent,
  Track,
  ConnectionState,
} from "livekit-client";
import { VoiceChatEvent, VoiceChatEventCallbacks } from "./events";
import { VoiceChatConfig, VoiceChatState } from "./types";

export class VoiceChat extends (EventEmitter as new () => TypedEmitter<VoiceChatEventCallbacks>) {
  private readonly room: Room;
  private _state: VoiceChatState = VoiceChatState.INACTIVE;
  private track: LocalAudioTrack | null = null;

  constructor(room: Room) {
    super();
    this.room = room;
  }

  private get isConnected(): boolean {
    return (
      this.room.state !== ConnectionState.Disconnected &&
      this.room.state !== ConnectionState.Connecting
    );
  }

  public get state(): VoiceChatState {
    return this._state;
  }

  public get isMuted(): boolean {
    return this.track?.isMuted ?? true;
  }

  public async start(config: VoiceChatConfig = {}): Promise<void> {
    if (!this.isConnected) {
      console.warn("Voice chat can only be started when session is active");
      return;
    }

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
      this.emit(VoiceChatEvent.MUTED);
    } else {
      this.emit(VoiceChatEvent.UNMUTED);
    }

    await this.room.localParticipant.publishTrack(this.track);

    this.track.on(TrackEvent.Muted, () => {
      this.emit(VoiceChatEvent.MUTED);
    });

    this.track.on(TrackEvent.Unmuted, () => {
      this.emit(VoiceChatEvent.UNMUTED);
    });

    this.state = VoiceChatState.ACTIVE;
  }

  public stop(): void {
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
    if (this.state !== VoiceChatState.ACTIVE) {
      console.warn("Voice chat can only be muted when active");
      return;
    }

    if (this.track) {
      this.track.mute();
    }
  }

  public async unmute(): Promise<void> {
    if (this.state !== VoiceChatState.ACTIVE) {
      console.warn("Voice chat can only be unmuted when active");
      return;
    }

    if (this.track) {
      this.track.unmute();
    }
  }

  public async setDevice(deviceId: ConstrainDOMString): Promise<boolean> {
    if (this.state !== VoiceChatState.ACTIVE) {
      console.warn("Voice chat device can only be set when active");
      return false;
    }

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
