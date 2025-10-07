import {
  Room,
  RoomEvent,
  ParticipantEvent,
  ConnectionQuality as LiveKitConnectionQuality,
  ConnectionState as LiveKitConnectionState,
} from "livekit-client";
import { AbstractConnectionQualityIndicator } from "./base";
import { ConnectionQuality } from "./types";

export class LiveKitConnectionQualityIndicator extends AbstractConnectionQualityIndicator<Room> {
  private room: Room | null = null;
  private liveKitConnectionQuality: LiveKitConnectionQuality =
    LiveKitConnectionQuality.Unknown;
  private liveKitConnectionState: LiveKitConnectionState | null = null;

  private handleConnectionQualityChanged = (
    quality: LiveKitConnectionQuality,
  ): void => {
    this.liveKitConnectionQuality = quality;
    this.handleStatsChanged();
  };

  private handleConnectionStateChanged = (
    state: LiveKitConnectionState,
  ): void => {
    this.liveKitConnectionState = state;
    this.handleStatsChanged();
  };

  protected _start(room: Room): void {
    this.room = room;
    this.room.localParticipant.on(
      ParticipantEvent.ConnectionQualityChanged,
      this.handleConnectionQualityChanged,
    );
    this.room.on(
      RoomEvent.ConnectionStateChanged,
      this.handleConnectionStateChanged,
    );
  }

  protected _stop(): void {
    if (this.room) {
      this.room.localParticipant.off(
        ParticipantEvent.ConnectionQualityChanged,
        this.handleConnectionQualityChanged,
      );
      this.room.off(
        RoomEvent.ConnectionStateChanged,
        this.handleConnectionStateChanged,
      );
    }
  }

  protected calculateConnectionQuality(): ConnectionQuality {
    if (
      [LiveKitConnectionQuality.Lost, LiveKitConnectionQuality.Poor].includes(
        this.liveKitConnectionQuality,
      )
    ) {
      return ConnectionQuality.BAD;
    }

    if (
      this.liveKitConnectionState &&
      [
        LiveKitConnectionState.Disconnected,
        LiveKitConnectionState.Reconnecting,
        LiveKitConnectionState.SignalReconnecting,
      ].includes(this.liveKitConnectionState)
    ) {
      return ConnectionQuality.BAD;
    }

    return ConnectionQuality.GOOD;
  }
}
