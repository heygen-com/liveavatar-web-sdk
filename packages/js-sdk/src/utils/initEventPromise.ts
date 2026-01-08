import {
  DataPacket_Kind,
  RemoteParticipant,
  Room,
  RoomEvent,
} from "livekit-client";
import { LIVEKIT_SERVER_RESPONSE_CHANNEL_TOPIC } from "../const";

export const initEventPromise = (
  room: Room,
  eventType: string,
  rejectionEventType?: string,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const messageHandler = (
      roomMessage: Uint8Array,
      _?: RemoteParticipant,
      __?: DataPacket_Kind,
      topic?: string,
    ): void => {
      if (topic !== LIVEKIT_SERVER_RESPONSE_CHANNEL_TOPIC) {
        return;
      }

      let eventData: { event_type: string } | null = null;
      try {
        const messageString = new TextDecoder().decode(roomMessage);
        eventData = JSON.parse(messageString);
      } catch {
        return;
      }

      if (eventData && "event_type" in eventData) {
        const type = eventData.event_type;
        if (type === eventType || type === rejectionEventType) {
          room.removeListener(RoomEvent.DataReceived, messageHandler);
          const isRejection = type === rejectionEventType;
          if (isRejection) {
            reject();
          } else {
            resolve();
          }
        }
      }
    };
    room.on(RoomEvent.DataReceived, messageHandler);
  });
};
