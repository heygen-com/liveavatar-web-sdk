export enum MessageSender {
  USER = "user",
  AVATAR = "avatar",
}

export interface LiveAvatarSessionMessage {
  sender: MessageSender;
  message: string;
  timestamp: number;
}
