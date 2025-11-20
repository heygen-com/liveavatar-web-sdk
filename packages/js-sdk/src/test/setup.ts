import { vi } from "vitest";
import { RoomMock, LocalParticipantMock } from "./mocks/Livekit";
import { WebRTCIssueDetectorMock } from "./mocks/WebRTCIssueDetector";

vi.doMock(
  "livekit-client",
  async (orig: () => Promise<Record<string, unknown>>) => {
    const mod = await orig();

    return {
      ...mod,
      Room: RoomMock,
      LocalParticipant: LocalParticipantMock,
      supportsAdaptiveStream: () => false,
      supportsDynacast: () => false,
    };
  },
);

vi.doMock(
  "webrtc-issue-detector",
  async (orig: () => Promise<Record<string, unknown>>) => {
    const mod = await orig();

    return {
      ...mod,
      default: WebRTCIssueDetectorMock,
    };
  },
);
