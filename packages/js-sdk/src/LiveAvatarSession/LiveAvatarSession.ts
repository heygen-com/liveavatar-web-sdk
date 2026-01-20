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
  AgentEventCallbacks,
  AgentEvent,
  getAgentEventEmitArgs,
  CommandEvent,
  CommandEventsEnum,
  AgentEventsEnum,
} from "./events";
import {
  SessionState,
  SessionDisconnectReason,
  SessionConfig,
  SessionInfo,
} from "./types";
import {
  ConnectionQualityIndicator,
  AbstractConnectionQualityIndicator,
  ConnectionQuality,
} from "../QualityIndicator";
import { VoiceChat } from "../VoiceChat";
import {
  LIVEKIT_COMMAND_CHANNEL_TOPIC,
  LIVEKIT_SERVER_RESPONSE_CHANNEL_TOPIC,
} from "./const";
import { SessionAPIClient } from "./SessionApiClient";
import { splitPcm24kStringToChunks } from "../audio_utils";

const HEYGEN_PARTICIPANT_ID = "heygen";

export class LiveAvatarSession extends (EventEmitter as new () => TypedEmitter<
  SessionEventCallbacks & AgentEventCallbacks
>) {
  private readonly sessionClient: SessionAPIClient;
  private readonly config: SessionConfig;

  private readonly room: Room;
  private readonly _voiceChat: VoiceChat;

  private readonly connectionQualityIndicator: AbstractConnectionQualityIndicator<Room> =
    new ConnectionQualityIndicator((quality) =>
      this.emit(SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED, quality),
    );

  private _sessionInfo: SessionInfo | null = null;
  private _sessionEventSocket: WebSocket | null = null;

  private _state: SessionState = SessionState.INACTIVE;
  private _remoteAudioTrack: RemoteAudioTrack | null = null;
  private _remoteVideoTrack: RemoteVideoTrack | null = null;

  constructor(sessionAccessToken: string, config?: SessionConfig) {
    super();

    this.config = config ?? {};
    this.sessionClient = new SessionAPIClient(
      sessionAccessToken,
      this.config.apiUrl,
    );

    this.room = new Room({
      adaptiveStream: supportsAdaptiveStream()
        ? { pauseVideoInBackground: false }
        : false,
      dynacast: supportsDynacast(),
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });

    this._voiceChat = new VoiceChat(this.room);
  }

  /* =====================
     PUBLIC GETTERS
  ====================== */

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
    return this._sessionInfo?.max_session_duration ?? null;
  }

  /* =====================
     SESSION LIFECYCLE
  ====================== */

  public async start(): Promise<void> {
    if (this.state !== SessionState.INACTIVE) {
      console.warn("Session is already started");
      return;
    }

    try {
      this.state = SessionState.CONNECTING;

      this._sessionInfo = await this.sessionClient.startSession();

      const { livekit_url, livekit_client_token, ws_url } = this._sessionInfo;

      if (livekit_url && livekit_client_token) {
        this.trackEvents();
        await this.room.connect(livekit_url, livekit_client_token);
        this.connectionQualityIndicator.start(this.room);
      }

      if (ws_url) {
        await this.connectWebSocket(ws_url);
        this.setupWebSocketManagement();
      }

      await this.configureSession();

      this.state = SessionState.CONNECTED;
    } catch (error) {
      console.error("Session start failed:", error);
      await this.cleanup();
      this.postStop(SessionDisconnectReason.SESSION_START_FAILED);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.assertConnected()) return;

    this.state = SessionState.DISCONNECTING;
    await this.cleanup();
    this.postStop(SessionDisconnectReason.CLIENT_INITIATED);
  }

  public async keepAlive(): Promise<void> {
    if (!this.assertConnected()) return;
    await this.sessionClient.keepAlive();
  }

  /* =====================
     MEDIA
  ====================== */

  public attach(element: HTMLMediaElement): void {
    if (!this._remoteVideoTrack || !this._remoteAudioTrack) {
      console.warn("Stream not ready");
      return;
    }
    this._remoteVideoTrack.attach(element);
    this._remoteAudioTrack.attach(element);
  }

  /* =====================
     TEXT DISABLED
  ====================== */

  public message(_: string): void {
    console.warn("Text speak disabled. Use repeatAudio().");
  }

  public repeat(_: string): void {
    console.warn("repeat(text) disabled. Use repeatAudio().");
  }

  /* =====================
     AUDIO SPEAK
  ====================== */

  public repeatAudio(audioBase64: string): void {
    if (!this.assertConnected()) return;

    this.sendCommandEvent({
      event_type: CommandEventsEnum.AVATAR_SPEAK_AUDIO,
      audio: audioBase64,
    } as CommandEvent);
  }

  public startListening(): void {
    if (!this.assertConnected()) return;
    this.sendCommandEvent({
      event_type: CommandEventsEnum.AVATAR_START_LISTENING,
    } as CommandEvent);
  }

  public stopListening(): void {
    if (!this.assertConnected()) return;
    this.sendCommandEvent({
      event_type: CommandEventsEnum.AVATAR_STOP_LISTENING,
    } as CommandEvent);
  }

  public interrupt(): void {
    if (!this.assertConnected()) return;
    this.sendCommandEvent({
      event_type: CommandEventsEnum.AVATAR_INTERRUPT,
    } as CommandEvent);
  }

  /* =====================
     LIVEKIT EVENTS
  ====================== */

  private trackEvents(): void {
    const mediaStream = new MediaStream();

    this.room.on(RoomEvent.TrackSubscribed, (track, _, participant) => {
      if (participant.identity !== HEYGEN_PARTICIPANT_ID) return;

      if (track.kind === "video")
        this._remoteVideoTrack = track as RemoteVideoTrack;
      if (track.kind === "audio")
        this._remoteAudioTrack = track as RemoteAudioTrack;

      mediaStream.addTrack(track.mediaStreamTrack);

      if (
        mediaStream.getVideoTracks().length &&
        mediaStream.getAudioTracks().length
      ) {
        this.emit(SessionEvent.SESSION_STREAM_READY);
      }
    });

    this.room.on(RoomEvent.DataReceived, (data, _, __, topic) => {
      if (topic !== LIVEKIT_SERVER_RESPONSE_CHANNEL_TOPIC) return;

      try {
        const msg = JSON.parse(new TextDecoder().decode(data)) as AgentEvent;
        const args = getAgentEventEmitArgs(msg);
        if (args) (this.emit as any)(args[0], ...args.slice(1));
      } catch (e) {
        console.error("LiveKit parse error", e);
      }
    });

    this.room.on(RoomEvent.Disconnected, () => this.handleRoomDisconnect());
  }

  /* =====================
     WEBSOCKET
  ====================== */

  private async configureSession(): Promise<void> {
    if (this.config.voiceChat) {
      await this.voiceChat.start(
        typeof this.config.voiceChat === "boolean" ? {} : this.config.voiceChat,
      );
    }
  }
  private async connectWebSocket(url: string): Promise<void> {
    console.log("[WS] connectWebSocket() CALLED", url);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this._sessionEventSocket = ws;

      const timeout = setTimeout(() => {
        console.error("[WS] open TIMEOUT");
        try {
          ws.close();
        } catch {}
        reject(new Error("WS open timeout"));
      }, 10_000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log("[WS] open", url);
        resolve();
      };

      ws.onerror = (e) => {
        clearTimeout(timeout);
        console.error("[WS] error", e);
        reject(e instanceof Error ? e : new Error("WS error"));
      };

      // Only used to fail fast if the socket closes BEFORE it ever opens
      ws.onclose = (e) => {
        clearTimeout(timeout);
        console.log("[WS] close", {
          code: e.code,
          reason: e.reason,
          wasClean: e.wasClean,
        });

        if (this.state === SessionState.CONNECTING) {
          reject(new Error("WS closed before open"));
        }
      };
    });
  }
  private handleWebSocketDisconnect(): void {
    // If we're already stopping, ignore
    if (
      this.state === SessionState.DISCONNECTING ||
      this.state === SessionState.DISCONNECTED
    ) {
      return;
    }

    const ws = this._sessionEventSocket;
    this._sessionEventSocket = null;

    try {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    } catch {}

    // best-effort cleanup
    void this.cleanup();
    this.postStop(SessionDisconnectReason.UNKNOWN_REASON);
  }

  private setupWebSocketManagement(): void {
    const ws = this._sessionEventSocket;
    if (!ws) return;

    ws.onmessage = (e: MessageEvent) => this.handleWebSocketMessage(e);

    ws.onerror = (err) => {
      console.error("[WS] error", err);
    };

    ws.onclose = (e) => {
      console.log("[WS] close", {
        code: e.code,
        reason: e.reason,
        wasClean: e.wasClean,
      });
      this.handleWebSocketDisconnect();
    };
  }

  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const msg = JSON.parse(event.data as string);

      if (msg?.type === "agent.speak_started") {
        this.emit(AgentEventsEnum.AVATAR_SPEAK_STARTED as any, msg as any);
        return;
      }

      if (msg?.type === "agent.speak_ended") {
        this.emit(AgentEventsEnum.AVATAR_SPEAK_ENDED as any, msg as any);
        return;
      }
    } catch (e) {
      console.error("[WS] parse error", e);
    }
  }

  /* =====================
     COMMAND SEND
  ====================== */

  private sendCommandEvent(command: CommandEvent): void {
    if (
      this._sessionEventSocket &&
      this._sessionEventSocket.readyState === WebSocket.OPEN
    ) {
      this.sendCommandEventToWebSocket(command);
      return;
    }

    if (this.room.state === "connected") {
      this.room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(command)),
        { reliable: true, topic: LIVEKIT_COMMAND_CHANNEL_TOPIC },
      );
    }
  }

  private sendCommandEventToWebSocket(command: CommandEvent): void {
    if (!this._sessionEventSocket) return;

    const event_id = crypto.randomUUID();

    if (command.event_type === CommandEventsEnum.AVATAR_SPEAK_AUDIO) {
      for (const chunk of splitPcm24kStringToChunks(command.audio)) {
        this._sessionEventSocket.send(
          JSON.stringify({ type: "agent.speak", event_id, audio: chunk }),
        );
      }
      this._sessionEventSocket.send(
        JSON.stringify({ type: "agent_speak_end", event_id }),
      );
    }
  }

  /* =====================
     CLEANUP
  ====================== */

  private async cleanup(): Promise<void> {
    this.connectionQualityIndicator.stop();
    this.voiceChat.stop();
    this.room.disconnect();
    if (this._sessionEventSocket) this._sessionEventSocket.close();
    await this.sessionClient.stopSession();
  }

  private postStop(reason: SessionDisconnectReason): void {
    this.state = SessionState.DISCONNECTED;
    this.emit(SessionEvent.SESSION_DISCONNECTED, reason);
  }

  private handleRoomDisconnect(): void {
    void this.cleanup();
    this.postStop(SessionDisconnectReason.UNKNOWN_REASON);
  }

  private assertConnected(): boolean {
    return this.state === SessionState.CONNECTED;
  }

  private set state(s: SessionState) {
    this._state = s;
    this.emit(SessionEvent.SESSION_STATE_CHANGED, s);
  }
}
