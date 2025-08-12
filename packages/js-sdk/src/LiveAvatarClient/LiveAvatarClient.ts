import { LiveAvatarSession, SessionConfig } from "../LiveAvatarSession";

export class LiveAvatarClient {
  public async createSession(
    config: SessionConfig,
    token: string,
  ): Promise<LiveAvatarSession> {
    return new LiveAvatarSession(config, token);
  }
}
