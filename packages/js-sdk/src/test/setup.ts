import { vi } from "vitest";
import {
  RoomMock,
  LocalParticipantMock,
  createLocalAudioTrack,
} from "./mocks/Livekit";
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
      createLocalAudioTrack: createLocalAudioTrack,
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

Object.defineProperty(globalThis, "MediaStream", {
  value: class MediaStream {
    tracks: MediaStreamTrack[] = [];

    constructor() {
      this.tracks = [];
    }

    addTrack(track: MediaStreamTrack) {
      this.tracks.push(track);
    }

    removeTrack(track: MediaStreamTrack) {
      this.tracks = this.tracks.filter((t) => t !== track);
    }

    getTracks() {
      return this.tracks;
    }

    getAudioTracks() {
      return this.tracks.filter((t) => t.kind === "audio");
    }

    getVideoTracks() {
      return this.tracks.filter((t) => t.kind === "video");
    }
  },
});

// Object.defineProperty(globalThis, 'navigator', {
//   value: {
//     mediaDevices: {
//       getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
//         return new Promise((resolve, reject) => {
//           resolve(new MediaStream());
//         });
//       }),
//     },
//   },
// });
