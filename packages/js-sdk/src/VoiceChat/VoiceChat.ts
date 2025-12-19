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
import {
  PushToTalkCommandEvent,
  PushToTalkServerEvent,
  VoiceChatEvent,
  VoiceChatEventCallbacks,
} from "./events";
import { VoiceChatConfig, VoiceChatMode, VoiceChatState } from "./types";
import { initEventPromise } from "../utils/initEventPromise";
import { LIVEKIT_COMMAND_CHANNEL_TOPIC } from "../const";

export class VoiceChat extends (EventEmitter as new () => TypedEmitter<VoiceChatEventCallbacks>) {
  private readonly room: Room;
  private _state: VoiceChatState = VoiceChatState.INACTIVE;
  private track: LocalAudioTrack | null = null;
  private mode: VoiceChatMode | null = null;
  private pushToTalkStarted: boolean = false;

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

  public setMode(mode: VoiceChatMode): void {
    if (this.mode) {
      console.warn("Voice chat mode can only be set once");
      return;
    }
    this.mode = mode;
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
    if (!this.assertActive("Voice chat can only be muted when active")) {
      return;
    }

    if (this.track) {
      await this.track.mute();
    }
  }

  public async unmute(): Promise<void> {
    if (!this.assertActive("Voice chat can only be unmuted when active")) {
      return;
    }

    if (this.track) {
      await this.track.unmute();
    }
  }

  public async setDevice(deviceId: ConstrainDOMString): Promise<boolean> {
    if (!this.assertActive("Voice chat device can only be set when active")) {
      return false;
    }

    if (this.track) {
      return this.track.setDeviceId(deviceId);
    }
    return false;
  }

  public async startPushToTalk(): Promise<void> {
    if (
      !this.assertActive(
        "Push to talk can only be started when voice chat is active",
      )
    ) {
      return;
    }

    if (this.mode !== VoiceChatMode.PUSH_TO_TALK) {
      console.warn("Push to talk can only be started in push to talk mode");
      return;
    }

    if (this.pushToTalkStarted) {
      console.warn("Push to talk has already been started");
      return;
    }

    this.pushToTalkStarted = true;
    const promise = initEventPromise(
      this.room,
      PushToTalkServerEvent.START_SUCCESS,
      PushToTalkServerEvent.START_FAILED,
    );
    this.sendPushToTalkCommand(PushToTalkCommandEvent.START);
    try {
      await promise;
      await this.unmute();
    } catch (e) {
      console.error("Failed to start push to talk", e);
      this.pushToTalkStarted = false;
      throw e;
    }
  }

  public async stopPushToTalk(): Promise<void> {
    if (!this.pushToTalkStarted) {
      console.warn("Push to talk has not been started");
      return;
    }

    const promise = initEventPromise(
      this.room,
      PushToTalkServerEvent.STOP_SUCCESS,
      PushToTalkServerEvent.STOP_FAILED,
    );
    this.sendPushToTalkCommand(PushToTalkCommandEvent.STOP);
    try {
      await promise;
      this.pushToTalkStarted = false;
    } catch (e) {
      console.error("Failed to stop push to talk", e);
      throw e;
    }
  }

  private sendPushToTalkCommand(command: PushToTalkCommandEvent): void {
    const data = new TextEncoder().encode(JSON.stringify(command));
    this.room.localParticipant.publishData(data, {
      reliable: true,
      topic: LIVEKIT_COMMAND_CHANNEL_TOPIC,
    });
  }

  private set state(state: VoiceChatState) {
    if (this._state !== state) {
      this._state = state;
      this.emit(VoiceChatEvent.STATE_CHANGED, state);
    }
  }

  private assertActive(warnMessage?: string): boolean {
    if (this.state !== VoiceChatState.ACTIVE) {
      console.warn(warnMessage ?? "Voice chat is not active");
      return false;
    }
    return true;
  }
}
