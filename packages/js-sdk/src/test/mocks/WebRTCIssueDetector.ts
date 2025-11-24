import { testContext } from "../utils/testContext";

export type NetworkScores = { inbound: number | null; outbound: number | null };

export class WebRTCIssueDetectorMock {
  private onNetworkScoresUpdated?: (scores: NetworkScores) => void;

  constructor(params: {
    onNetworkScoresUpdated?: (scores: NetworkScores) => void;
  }) {
    this.onNetworkScoresUpdated = params.onNetworkScoresUpdated;
    testContext.webRTCIssueDetectorInstance = this;
  }

  handleNewPeerConnection(_pc: globalThis.RTCPeerConnection) {}

  stopWatchingNewPeerConnections() {}

  _triggerNetworkScoresUpdated(scores: NetworkScores) {
    if (this.onNetworkScoresUpdated) {
      this.onNetworkScoresUpdated(scores);
    }
  }
}
