import { Room, RoomEvent, VideoPresets } from "livekit-client";
import { EventEmitter } from "events";
import TypedEmitter from "typed-emitter";
import {
  SessionEvent,
  SessionEventCallbacks,
  ServerEvent,
  getEventEmitterArgs,
} from "./events";
import {
  SessionState,
  SessionConfig,
  SessionInfo,
  SessionDisconnectReason,
} from "./types";
import {
  ConnectionQualityIndicator,
  AbstractConnectionQualityIndicator,
  ConnectionQuality,
} from "../QualityIndicator";
import { SessionApiClient } from "./SessionApiClient";
import { VoiceChat } from "../VoiceChat";

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
  private ws: WebSocket | null = null;

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

      this.room.on(RoomEvent.DataReceived, (roomMessage) => {
        let eventMsg: ServerEvent | null = null;
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
        this._sessionInfo.access_token,
      );
      await this.__legacy_ws_connect__();

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
    this.state = SessionState.DISCONNECTING;
    this.cleanup();
    this.room.disconnect();
    await this.api.stopSession();
    this.postStop(SessionDisconnectReason.CLIENT_INITIATED);
  }

  public async keepAlive(): Promise<void> {}

  public message(message: string): void {
    if (this.state !== SessionState.CONNECTED) {
      console.warn("Session is not connected");
      return;
    }

    const data = new TextEncoder().encode(JSON.stringify(message));
    this.room.localParticipant.publishData(data, { reliable: true });
  }

  public repeat(): void {}

  public startListening(): void {}

  public stopListening(): void {}

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
    // TODO: remove
    this.ws?.close();
    this.ws = null;
  }

  private postStop(reason: SessionDisconnectReason): void {
    this.state = SessionState.DISCONNECTED;
    this.emit(SessionEvent.DISCONNECTED, reason);
  }

  private handleRoomDisconnect(): void {
    this.cleanup();
    this.postStop(SessionDisconnectReason.UNKNOWN_REASON);
  }

  private __legacy_ws_connect__(): Promise<boolean> {
    const websocketUrl = `wss://api.dev.heygen.com/v1/ws/streaming.chat?session_id=${this.sessionId}&session_token=${this.sessionInfo?.access_token}&arch_version=v2`;
    this.ws = new WebSocket(websocketUrl);
    this.ws.addEventListener("close", () => {
      this.ws = null;
    });
    this.ws.addEventListener("message", (event) => {
      let eventData: ServerEvent | null = null;
      try {
        eventData = JSON.parse(event.data);
      } catch (e) {
        console.error(e);
        return;
      }
      if (eventData) {
        const args = getEventEmitterArgs(eventData);
        if (args) {
          const [event, ...data] = args;
          this.emit(event, ...data);
        }
      }
    });
    return new Promise((resolve, reject) => {
      this.ws?.addEventListener("error", (event) => {
        console.error("WS Error:", event);
        this.ws = null;
        reject(event);
      });
      this.ws?.addEventListener("open", () => {
        resolve(true);
      });
    });
  }
}
