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

  // Additional session configurations that can be managed
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

    // Required to construct the room
    this.config = config ?? {};
    this.sessionClient = new SessionAPIClient(
      sessionAccessToken,
      this.config.apiUrl,
    );

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
    return this._sessionInfo?.max_session_duration ?? null;
  }

  public async start(): Promise<void> {
    if (this.state !== SessionState.INACTIVE) {
      console.warn("Session is already started");
      return;
    }

    try {
      this.state = SessionState.CONNECTING;

      this._sessionInfo = await this.sessionClient.startSession();
      const livekitRoomUrl = this._sessionInfo.livekit_url;
      const livekitClientToken = this._sessionInfo.livekit_client_token;
      const websocketUrl = this._sessionInfo.ws_url;

      // Connect to LiveKit room if provided
      if (livekitRoomUrl && livekitClientToken) {
        // Track the different events from the room, server, and websocket
        this.trackEvents();
        await this.room.connect(livekitRoomUrl, livekitClientToken);
        this.connectionQualityIndicator.start(this.room);
      }

      // Connect to WebSocket if provided
      if (websocketUrl) {
        await this.connectWebSocket(websocketUrl);
        this.setupWebSocketManagement();
      }

      // Run configurations as needed
      await this.configureSession();
      this.state = SessionState.CONNECTED;
    } catch (error) {
      console.error("Session start failed:", error);
      this.cleanup();
      this.postStop(SessionDisconnectReason.SESSION_START_FAILED);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.assertConnected()) {
      return;
    }

    this.state = SessionState.DISCONNECTING;
    this.cleanup();
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
      throw error;
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
      event_type: CommandEventsEnum.AVATAR_SPEAK_RESPONSE,
      text: message,
    };
    this.sendCommandEvent(data as CommandEvent);
  }

  public repeat(message: string): void {
    if (!this.assertConnected()) {
      return;
    }

    const data = {
      event_type: CommandEventsEnum.AVATAR_SPEAK_TEXT,
      text: message,
    };
    this.sendCommandEvent(data as CommandEvent);
  }

  public repeatAudio(audio: string): void {
    if (!this.assertConnected()) {
      return;
    }
    if (!this._sessionEventSocket) {
      console.warn(
        "Cannot repeat audio. Please check you're using a supported mode.",
      );
      return;
    }

    const data = {
      event_type: CommandEventsEnum.AVATAR_SPEAK_AUDIO,
      audio: audio,
    };
    this.sendCommandEvent(data as CommandEvent);
  }

  public startListening(): void {
    if (!this.assertConnected()) {
      return;
    }

    const data = {
      event_type: CommandEventsEnum.AVATAR_START_LISTENING,
    };
    this.sendCommandEvent(data as CommandEvent);
  }

  public stopListening(): void {
    if (!this.assertConnected()) {
      return;
    }

    const data = {
      event_type: CommandEventsEnum.AVATAR_STOP_LISTENING,
    };
    this.sendCommandEvent(data as CommandEvent);
  }

  public interrupt(): void {
    if (!this.assertConnected()) {
      return;
    }

    const data = {
      event_type: CommandEventsEnum.AVATAR_INTERRUPT,
    };
    this.sendCommandEvent(data as CommandEvent);
  }

  private trackEvents(): void {
    const mediaStream = new MediaStream();
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track, _publication, participant) => {
        // We need to actively track the HeyGen participant's tracks
        if (participant.identity !== HEYGEN_PARTICIPANT_ID) {
          return;
        }

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
            this.emit(SessionEvent.SESSION_STREAM_READY);
          }
        }
      },
    );

    this.room.on(RoomEvent.DataReceived, (roomMessage, _, __, topic) => {
      if (topic !== LIVEKIT_SERVER_RESPONSE_CHANNEL_TOPIC) {
        return;
      }

      let eventMsg: AgentEvent | null = null;
      try {
        const messageString = new TextDecoder().decode(roomMessage);
        eventMsg = JSON.parse(messageString);
      } catch (e) {
        console.error(e);
      }
      if (!eventMsg) {
        return;
      }
      const emitArgs = getAgentEventEmitArgs(eventMsg);
      if (emitArgs) {
        const [event_type, ...event_data] = emitArgs;
        this.emit(event_type, ...event_data);
      }
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.warn("participantConnected", participant);
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track) => {
      console.warn("trackUnsubscribed", track);
      const mediaTrack = track.mediaStreamTrack;
      if (mediaTrack) {
        mediaStream.removeTrack(mediaTrack);
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.handleRoomDisconnect();
    });
  }

  private async connectWebSocket(websocketUrl: string): Promise<void> {
    return new Promise((resolve, _reject) => {
      this._sessionEventSocket = new WebSocket(websocketUrl);
      this._sessionEventSocket.onopen = () => {
        resolve();
      };
    });
  }

  private setupWebSocketManagement(): void {
    if (!this._sessionEventSocket) {
      return;
    }

    this._sessionEventSocket.onmessage = (event: MessageEvent) => {
      this.handleWebSocketMessage(event);
    };

    this._sessionEventSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this._sessionEventSocket.onclose = (event) => {
      console.warn(
        "WebSocket closed - code:",
        event.code,
        "reason:",
        event.reason,
        "wasClean:",
        event.wasClean,
      );
      this.handleWebSocketDisconnect();
    };
  }

  private handleWebSocketMessage(event: MessageEvent): void {
    let eventData: any = null;
    try {
      eventData = JSON.parse(event.data);
    } catch (e) {
      console.error("Failed to parse WebSocket message:", e);
      return;
    }

    if (!eventData) {
      return;
    }

    const { type, event_id } = eventData;
    if (type === "agent.speak_started") {
      this.emit(AgentEventsEnum.AVATAR_SPEAK_STARTED, {
        event_type: AgentEventsEnum.AVATAR_SPEAK_STARTED,
        event_id: event_id,
      });
    } else if (type === "agent.speak_ended") {
      this.emit(AgentEventsEnum.AVATAR_SPEAK_ENDED, {
        event_type: AgentEventsEnum.AVATAR_SPEAK_ENDED,
        event_id: event_id,
      });
    }
  }

  private handleWebSocketDisconnect(): void {
    if (
      this.state === SessionState.DISCONNECTING ||
      this.state === SessionState.DISCONNECTED
    ) {
      return;
    }

    if (
      this._sessionEventSocket &&
      this._sessionEventSocket.readyState === WebSocket.OPEN
    ) {
      this._sessionEventSocket.close();
    }

    this._sessionEventSocket = null;
    this.cleanup();
    this.postStop(SessionDisconnectReason.UNKNOWN_REASON);
  }

  private async configureSession(): Promise<void> {
    if (this.config.voiceChat) {
      await this.voiceChat.start(
        typeof this.config.voiceChat === "boolean" ? {} : this.config.voiceChat,
      );
    }
  }

  private set state(state: SessionState) {
    if (this._state === state) {
      return;
    }
    this._state = state;
    this.emit(SessionEvent.SESSION_STATE_CHANGED, state);
  }

  private async cleanup(): Promise<void> {
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

    // Clean up WebSocket
    if (this._sessionEventSocket) {
      // Remove event listeners to prevent callbacks during cleanup
      this._sessionEventSocket.onopen = null;
      this._sessionEventSocket.onmessage = null;
      this._sessionEventSocket.onerror = null;
      this._sessionEventSocket.onclose = null;

      if (
        this._sessionEventSocket.readyState === WebSocket.OPEN ||
        this._sessionEventSocket.readyState === WebSocket.CONNECTING
      ) {
        this._sessionEventSocket.close();
      }
      this._sessionEventSocket = null;
    }
    // Disconnect from room if connected
    if (this.room.state === "connected") {
      this.room.disconnect();
    }
    // Kill the session on the server
    await this.sessionClient.stopSession();
  }

  private postStop(reason: SessionDisconnectReason): void {
    this.state = SessionState.DISCONNECTED;
    this.emit(SessionEvent.SESSION_DISCONNECTED, reason);
  }

  private handleRoomDisconnect(): void {
    this.cleanup();
    this.postStop(SessionDisconnectReason.UNKNOWN_REASON);
  }

  private sendCommandEvent(commandEvent: CommandEvent): void {
    // Use WebSocket if available, otherwise use LiveKit data channel
    if (
      this._sessionEventSocket &&
      this._sessionEventSocket.readyState === WebSocket.OPEN
    ) {
      this.sendCommandEventToWebSocket(commandEvent);
    } else if (this.room.state === "connected") {
      const data = new TextEncoder().encode(JSON.stringify(commandEvent));
      this.room.localParticipant.publishData(data, {
        reliable: true,
        topic: LIVEKIT_COMMAND_CHANNEL_TOPIC,
      });
    } else {
      console.warn("No active connection to send command event");
    }
  }

  private generateEventId(): string {
    // Use native browser crypto API
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private sendCommandEventToWebSocket(commandEvent: CommandEvent): void {
    if (
      !this._sessionEventSocket ||
      this._sessionEventSocket.readyState !== WebSocket.OPEN
    ) {
      console.warn("WebSocket not open to send command event");
      return;
    }

    const event_type = commandEvent.event_type;
    const event_id = this.generateEventId();
    let audioChunks: string[] = [];
    switch (event_type) {
      case CommandEventsEnum.AVATAR_SPEAK_AUDIO:
        audioChunks = splitPcm24kStringToChunks(commandEvent.audio);
        for (const audioChunk of audioChunks) {
          this._sessionEventSocket.send(
            JSON.stringify({
              type: "agent.speak",
              event_id: event_id,
              audio: audioChunk,
            }),
          );
        }
        this._sessionEventSocket.send(
          JSON.stringify({
            type: "agent.speak_end",
            event_id: event_id,
          }),
        );
        return;
      case CommandEventsEnum.AVATAR_INTERRUPT:
        this._sessionEventSocket.send(
          JSON.stringify({
            type: "agent.interrupt",
            event_id: event_id,
          }),
        );
        return;
      case CommandEventsEnum.AVATAR_START_LISTENING:
        this._sessionEventSocket.send(
          JSON.stringify({
            type: "agent.start_listening",
            event_id: event_id,
          }),
        );
        return;
      case CommandEventsEnum.AVATAR_STOP_LISTENING:
        this._sessionEventSocket.send(
          JSON.stringify({
            type: "agent.stop_listening",
            event_id: event_id,
          }),
        );
        return;
      default:
        console.warn("Unsupported command event type:", event_type);
        break;
    }
  }

  private assertConnected(): boolean {
    if (this.state !== SessionState.CONNECTED) {
      console.warn("Session is not connected");
      return false;
    }
    return true;
  }
}
