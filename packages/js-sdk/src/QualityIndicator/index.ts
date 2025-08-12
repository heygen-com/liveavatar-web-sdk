import { LiveKitConnectionQualityIndicator } from "./LiveKitQualityIndicator";
import { WebRTCConnectionQualityIndicator } from "./WebRTCQualityIndicator";
import {
  QualityIndicatorComposite,
  AbstractConnectionQualityIndicator,
} from "./base";
import { Room } from "livekit-client";

export * from "./types";
export { AbstractConnectionQualityIndicator };

export const ConnectionQualityIndicator = QualityIndicatorComposite(
  {
    TrackerClass: LiveKitConnectionQualityIndicator,
    getParams: (room: Room) => room,
  },
  {
    TrackerClass: WebRTCConnectionQualityIndicator,
    getParams: (room: Room) => (room.engine.pcManager?.subscriber as any)._pc,
  },
);
