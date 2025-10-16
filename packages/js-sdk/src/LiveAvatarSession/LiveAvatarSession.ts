import {
  Room,
  RoomEvent,
  VideoPresets,
  RemoteVideoTrack,
  RemoteAudioTrack,
  supportsAdaptiveStream,
  supportsDynacast,
} from "livekit-client";
import { EventEmitter } from "events";
import TypedEmitter from "typed-emitter";
import {
  SessionEvent,
  SessionEventCallbacks,
  ServerEventType,
  getEventEmitterArgs,
} from "./events";
import {
  SessionState,
  SessionDisconnectReason,
  DataMessage,
  SessionConfig,
  SessionInfo,
} from "./types";
import {
  ConnectionQualityIndicator,
  AbstractConnectionQualityIndicator,
  ConnectionQuality,
} from "../QualityIndicator";
import { VoiceChat } from "../VoiceChat";
import { LIVEKIT_DATA_CHANNEL_TOPIC } from "./const";
import { SessionAPIClient } from "./SessionApiClient";

export class LiveAvatarSession extends (EventEmitter as new () => TypedEmitter<SessionEventCallbacks>) {
  private readonly sessionClient: SessionAPIClient;

  // Additional session configurations that can be managed
  private readonly config: SessionConfig;

  private readonly room: Room;
  private readonly _voiceChat: VoiceChat;
  private readonly connectionQualityIndicator: AbstractConnectionQualityIndicator<Room> =
    new ConnectionQualityIndicator((quality) =>
      this.emit(SessionEvent.CONNECTION_QUALITY_CHANGED, quality),
    );

  private sessionInfo: SessionInfo | null = null;
  private _state: SessionState = SessionState.INACTIVE;
  private _remoteAudioTrack: RemoteAudioTrack | null = null;
  private _remoteVideoTrack: RemoteVideoTrack | null = null;

  constructor(
    sessionId: string,
    sessionAccessToken: string,
    config: SessionConfig,
  ) {
    super();

    // Required to construct the room
    this.config = config;
    this.sessionClient = new SessionAPIClient(sessionId, sessionAccessToken);

    this.room = new Room({
      adaptiveStream: supportsAdaptiveStream()
        ? {
            pauseVideoInBackground: false,
          }
        : false,
      dynacast: supportsDynacast(),
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });
    this._voiceChat = new VoiceChat(this.room);
  }

  public get state(): SessionState {
    return this._state;
  }

  public get connectionQuality(): ConnectionQuality {
    return this.connectionQualityIndicator.connectionQuality;
  }

  public get voiceChat(): VoiceChat {
    return this._voiceChat;
  }

  public get maxSessionDuration(): number | null {
    return this.sessionInfo?.max_session_duration ?? null;
  }

  public async start(): Promise<void> {
    if (this.state !== SessionState.INACTIVE) {
      console.warn("Session is already started");
      return;
    }

    try {
      this.state = SessionState.CONNECTING;
      // Track the different events from the room, server, etc.
      this.trackEvents();

      this.sessionInfo = await this.sessionClient.startSession();
      const roomUrl = this.sessionInfo.livekit_url;
      const roomToken = this.sessionInfo.room_token;

      await this.room.connect(roomUrl, roomToken);

      this.connectionQualityIndicator.start(this.room);

      // Run configurations as needed
      await this.configureSession();
      this.state = SessionState.CONNECTED;
    } catch (error) {
      console.error("Session start failed:", error);
      this.cleanup();
      this.postStop(SessionDisconnectReason.SESSION_START_FAILED);
    }
  }

  private trackEvents(): void {
    const mediaStream = new MediaStream();
    this.room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === "video" || track.kind === "audio") {
        if (track.kind === "video") {
          this._remoteVideoTrack = track as RemoteVideoTrack;
        } else {
          this._remoteAudioTrack = track as RemoteAudioTrack;
        }
        mediaStream.addTrack(track.mediaStreamTrack);

        const hasVideoTrack = mediaStream.getVideoTracks().length > 0;
        const hasAudioTrack = mediaStream.getAudioTracks().length > 0;
        if (hasVideoTrack && hasAudioTrack) {
          this.emit(SessionEvent.STREAM_READY);
        }
      }
    });

    this.room.on(RoomEvent.DataReceived, (roomMessage, _, __, topic) => {
      if (topic !== LIVEKIT_DATA_CHANNEL_TOPIC) {
        return;
      }

      let eventMsg: ServerEventType | null = null;
      try {
        const messageString = new TextDecoder().decode(roomMessage);
        eventMsg = JSON.parse(messageString);
      } catch (e) {
        console.error(e);
      }
      if (!eventMsg) {
        return;
      }
      const args = getEventEmitterArgs(eventMsg);
      if (args) {
        const [event, ...data] = args;
        this.emit(event, ...data);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track) => {
      const mediaTrack = track.mediaStreamTrack;
      if (mediaTrack) {
        mediaStream.removeTrack(mediaTrack);
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.handleRoomDisconnect();
    });
  }

  private async configureSession(): Promise<void> {
    if (this.config.voiceChat) {
      await this.voiceChat.start(
        typeof this.config.voiceChat === "boolean" ? {} : this.config.voiceChat,
      );
    }
  }

  public async stop(): Promise<void> {
    if (!this.assertConnected()) {
      return;
    }

    this.state = SessionState.DISCONNECTING;
    this.cleanup();
    this.room.disconnect();

    try {
      await this.sessionClient.stopSession();
    } catch (error) {
      console.error("Session stop error on server:", error);
    }

    this.postStop(SessionDisconnectReason.CLIENT_INITIATED);
  }

  public async keepAlive(): Promise<void> {
    if (!this.assertConnected()) {
      return;
    }

    try {
      this.sessionClient.keepAlive();
    } catch (error) {
      console.error("Session keep alive error on server:", error);
    }
  }

  public attach(element: HTMLMediaElement): void {
    if (!this._remoteVideoTrack || !this._remoteAudioTrack) {
      console.warn("Stream is not yet ready");
      return;
    }
    this._remoteVideoTrack.attach(element);
    this._remoteAudioTrack.attach(element);
  }

  public message(message: string): void {
    if (!this.assertConnected()) {
      return;
    }

    const data = {
      type: DataMessage.USER_MESSAGE,
      message,
    };
    this.publishData(data);
  }

  public repeat(message: string): void {
    if (!this.assertConnected()) {
      return;
    }

    const data = {
      type: DataMessage.AVATAR_REPEAT,
      message,
    };
    this.publishData(data);
  }

  public startListening(): void {
    if (!this.assertConnected()) {
      return;
    }

    const data = {
      type: DataMessage.AVATAR_START_LISTENING,
    };
    this.publishData(data);
  }

  public stopListening(): void {
    if (!this.assertConnected()) {
      return;
    }

    const data = {
      type: DataMessage.AVATAR_STOP_LISTENING,
    };
    this.publishData(data);
  }

  public interrupt(): void {
    if (!this.assertConnected()) {
      return;
    }

    const data = {
      type: DataMessage.AVATAR_INTERRUPT,
    };
    this.publishData(data);
  }

  private set state(state: SessionState) {
    if (this._state === state) {
      return;
    }
    this._state = state;
    this.emit(SessionEvent.STATE_CHANGED, state);
  }

  private cleanup(): void {
    this.connectionQualityIndicator.stop();
    this.voiceChat.stop();
    if (this._remoteAudioTrack) {
      this._remoteAudioTrack.stop();
    }
    if (this._remoteVideoTrack) {
      this._remoteVideoTrack.stop();
    }
    this._remoteAudioTrack = null;
    this._remoteVideoTrack = null;
    this.room.localParticipant.removeAllListeners();
    this.room.removeAllListeners();
  }

  private postStop(reason: SessionDisconnectReason): void {
    this.state = SessionState.DISCONNECTED;
    this.emit(SessionEvent.DISCONNECTED, reason);
  }

  private handleRoomDisconnect(): void {
    this.cleanup();
    this.postStop(SessionDisconnectReason.UNKNOWN_REASON);
  }

  private publishData(message: object): void {
    const data = new TextEncoder().encode(JSON.stringify(message));
    this.room.localParticipant.publishData(data, {
      reliable: true,
      topic: LIVEKIT_DATA_CHANNEL_TOPIC,
    });
  }

  private assertConnected(): boolean {
    if (this.state !== SessionState.CONNECTED) {
      console.warn("Session is not connected");
      return false;
    }
    return true;
  }
}
