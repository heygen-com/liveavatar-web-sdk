import { LiveAvatarSession, SessionConfig } from "../LiveAvatarSession";

export class LiveAvatarClient {
  public createSession(
    config: SessionConfig,
    token: string,
  ): LiveAvatarSession {
    return new LiveAvatarSession(config, token);
  }
}
