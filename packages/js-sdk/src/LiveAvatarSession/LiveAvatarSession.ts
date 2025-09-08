import { Room, RoomEvent, VideoPresets } from "livekit-client";
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
  SessionConfig,
  SessionInfo,
  SessionDisconnectReason,
  DataMessage,
} from "./types";
import {
  ConnectionQualityIndicator,
  AbstractConnectionQualityIndicator,
  ConnectionQuality,
} from "../QualityIndicator";
import { SessionApiClient } from "./SessionApiClient";
import { VoiceChat } from "../VoiceChat";
import { LIVEKIT_DATA_CHANNEL_TOPIC } from "./const";

export class LiveAvatarSession extends (EventEmitter as new () => TypedEmitter<SessionEventCallbacks>) {
  private readonly config: SessionConfig;
  // private readonly sessionToken: string;
  private readonly api: SessionApiClient;
  private readonly room: Room;
  private readonly _voiceChat: VoiceChat;
  private readonly connectionQualityIndicator: AbstractConnectionQualityIndicator<Room> =
    new ConnectionQualityIndicator((quality) =>
      this.emit(SessionEvent.CONNECTION_QUALITY_CHANGED, quality),
    );
  private _sessionInfo: SessionInfo | null = null;
  private _state: SessionState = SessionState.INACTIVE;
  private _mediaStream: MediaStream | null = null;

  constructor(config: SessionConfig, sessionToken: string) {
    super();
    this.config = config;
    // this.sessionToken = sessionToken;
    this.api = new SessionApiClient(sessionToken);
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
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

  public get sessionInfo(): SessionInfo | null {
    return this._sessionInfo;
  }

  public get sessionId(): string | null {
    return this._sessionInfo?.session_id ?? null;
  }

  public get mediaStream(): MediaStream | null {
    return this._mediaStream;
  }

  public get voiceChat(): VoiceChat {
    return this._voiceChat;
  }

  public async start(): Promise<void> {
    if (this.state !== SessionState.INACTIVE) {
      console.warn("Session is already started");
      return;
    }

    try {
      this.state = SessionState.CONNECTING;

      const mediaStream = new MediaStream();
      this.room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "video" || track.kind === "audio") {
          mediaStream.addTrack(track.mediaStreamTrack);

          const hasVideoTrack = mediaStream.getVideoTracks().length > 0;
          const hasAudioTrack = mediaStream.getAudioTracks().length > 0;
          if (hasVideoTrack && hasAudioTrack) {
            this.stream = mediaStream;
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

      this._sessionInfo = await this.api.startSession({});

      await this.room.connect(
        this._sessionInfo.livekit_url,
        this._sessionInfo.room_token,
      );

      this.connectionQualityIndicator.start(this.room);

      if (this.config.voiceChat) {
        await this.voiceChat.start(
          typeof this.config.voiceChat === "boolean"
            ? {}
            : this.config.voiceChat,
        );
      }

      this.state = SessionState.CONNECTED;
    } catch (error) {
      console.error("Session start failed:", error);
      this.cleanup();
      this.postStop(SessionDisconnectReason.SESSION_START_FAILED);
    }
  }

  public async stop(): Promise<void> {
    if (!this.assertConnexted()) {
      return;
    }

    this.state = SessionState.DISCONNECTING;
    this.cleanup();
    this.room.disconnect();
    await this.api.stopSession();
    this.postStop(SessionDisconnectReason.CLIENT_INITIATED);
  }

  public async keepAlive(): Promise<void> {
    if (!this.assertConnexted()) {
      return;
    }

    return this.api.keepAlive();
  }

  public message(message: string): void {
    if (!this.assertConnexted()) {
      return;
    }

    const data = {
      type: DataMessage.USER_MESSAGE,
      message,
    };
    this.publishData(data);
  }

  public repeat(message: string): void {
    if (!this.assertConnexted()) {
      return;
    }

    const data = {
      type: DataMessage.AVATAR_REPEAT,
      message,
    };
    this.publishData(data);
  }

  public startListening(): void {
    if (!this.assertConnexted()) {
      return;
    }

    const data = {
      type: DataMessage.AVATAR_START_LISTENING,
    };
    this.publishData(data);
  }

  public stopListening(): void {
    if (!this.assertConnexted()) {
      return;
    }

    const data = {
      type: DataMessage.AVATAR_STOP_LISTENING,
    };
    this.publishData(data);
  }

  public interrupt(): void {
    if (!this.assertConnexted()) {
      return;
    }

    const data = {
      type: DataMessage.AVATAR_INTERRUPT,
    };
    this.publishData(data);
  }

  private set stream(stream: MediaStream) {
    if (this._mediaStream) {
      return;
    }
    this._mediaStream = stream;
    this.emit(SessionEvent.STREAM_READY, stream);
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

  private assertConnexted(): boolean {
    if (this.state !== SessionState.CONNECTED) {
      console.warn("Session is not connected");
      return false;
    }
    return true;
  }
}
