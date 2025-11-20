import { describe, it, expect, vi } from "vitest";
import { WebRTCConnectionQualityIndicator } from "./WebRTCQualityIndicator";
import { ConnectionQuality } from "./types";
import { testContext } from "../test/utils/testContext";

describe("WebRTCConnectionQualityIndicator", () => {
  it("resolves to BAD when inbound score is less than 3", () => {
    const onConnectionQualityChanged = vi.fn();
    const indicator = new WebRTCConnectionQualityIndicator(
      onConnectionQualityChanged,
    );
    indicator.start({} as globalThis.RTCPeerConnection);
    testContext.webRTCIssueDetectorInstance._triggerNetworkScoresUpdated({
      inbound: 2,
      outbound: null,
    });
    expect(onConnectionQualityChanged).toHaveBeenCalledWith(
      ConnectionQuality.BAD,
    );
  });

  it("resolves to BAD when outbound score is less than 3", () => {
    const onConnectionQualityChanged = vi.fn();
    const indicator = new WebRTCConnectionQualityIndicator(
      onConnectionQualityChanged,
    );
    indicator.start({} as globalThis.RTCPeerConnection);
    testContext.webRTCIssueDetectorInstance._triggerNetworkScoresUpdated({
      inbound: null,
      outbound: 2,
    });
  });

  it("resolves to GOOD when inbound and outbound scores are greater than or equal to 3", () => {
    const onConnectionQualityChanged = vi.fn();
    const indicator = new WebRTCConnectionQualityIndicator(
      onConnectionQualityChanged,
    );
    indicator.start({} as globalThis.RTCPeerConnection);
    testContext.webRTCIssueDetectorInstance._triggerNetworkScoresUpdated({
      inbound: 3,
      outbound: 4,
    });
  });

  it("resolves to UNKNOWN when no scores are available", () => {
    const onConnectionQualityChanged = vi.fn();
    const indicator = new WebRTCConnectionQualityIndicator(
      onConnectionQualityChanged,
    );
    indicator.start({} as globalThis.RTCPeerConnection);
    testContext.webRTCIssueDetectorInstance._triggerNetworkScoresUpdated({
      inbound: 3,
      outbound: null,
    });
    testContext.webRTCIssueDetectorInstance._triggerNetworkScoresUpdated({
      inbound: null,
      outbound: null,
    });
    expect(onConnectionQualityChanged).toHaveBeenCalledWith(
      ConnectionQuality.UNKNOWN,
    );
  });
});
