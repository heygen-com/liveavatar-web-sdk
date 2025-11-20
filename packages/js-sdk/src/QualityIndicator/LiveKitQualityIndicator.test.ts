import { describe, it, expect, vi } from "vitest";
import {
  ConnectionState,
  Room,
  ConnectionQuality as LiveKitConnectionQuality,
} from "livekit-client";
import { LiveKitConnectionQualityIndicator } from "./LiveKitQualityIndicator";
import { ConnectionQuality } from "./types";
import { testContext } from "../test/utils/testContext";

describe("LiveKitConnectionQualityIndicator", () => {
  for (const state of [
    ConnectionState.Disconnected,
    ConnectionState.Reconnecting,
    ConnectionState.SignalReconnecting,
  ]) {
    it(`resolves to BAD when connection state is ${state}`, () => {
      const onConnectionQualityChanged = vi.fn();
      const room = new Room();
      const indicator = new LiveKitConnectionQualityIndicator(
        onConnectionQualityChanged,
      );
      indicator.start(room);
      testContext.roomInstance._triggerConnectionStateChanged(state);
      expect(onConnectionQualityChanged).toHaveBeenCalledWith(
        ConnectionQuality.BAD,
      );
    });
  }

  for (const quality of [
    LiveKitConnectionQuality.Lost,
    LiveKitConnectionQuality.Poor,
  ]) {
    it(`resolves to BAD when participant connection quality is ${quality}`, () => {
      const onConnectionQualityChanged = vi.fn();
      const room = new Room();
      const indicator = new LiveKitConnectionQualityIndicator(
        onConnectionQualityChanged,
      );
      indicator.start(room);
      testContext.roomInstance._triggerConnectionQualityChanged(quality);
      expect(onConnectionQualityChanged).toHaveBeenCalledWith(
        ConnectionQuality.BAD,
      );
    });
  }

  it("resolves to GOOD when participant connection quality is good", () => {
    const onConnectionQualityChanged = vi.fn();
    const room = new Room();
    const indicator = new LiveKitConnectionQualityIndicator(
      onConnectionQualityChanged,
    );
    indicator.start(room);
    testContext.roomInstance._triggerConnectionQualityChanged(
      LiveKitConnectionQuality.Good,
    );
    expect(onConnectionQualityChanged).toHaveBeenCalledWith(
      ConnectionQuality.GOOD,
    );
  });

  it("resolves to GOOD when connection state is connected", () => {
    const onConnectionQualityChanged = vi.fn();
    const room = new Room();
    const indicator = new LiveKitConnectionQualityIndicator(
      onConnectionQualityChanged,
    );
    indicator.start(room);
    testContext.roomInstance._triggerConnectionStateChanged(
      ConnectionState.Connected,
    );
    expect(onConnectionQualityChanged).toHaveBeenCalledWith(
      ConnectionQuality.GOOD,
    );
  });
});
