import { API_URL } from "../const";
import { SessionInfo, SessionConfig } from "./types";

const DEFAULT_ERROR_CODE = 500;

class SessionApiError extends Error {
  errorCode: number;
  status: number | null = null;

  constructor(message: string, errorCode?: number, status?: number) {
    super(message);
    this.errorCode = errorCode ?? DEFAULT_ERROR_CODE;
    this.status = status ?? null;
  }
}

export class SessionApiClient {
  private readonly sessionToken: string;

  constructor(sessionToken: string) {
    this.sessionToken = sessionToken;
  }

  private async post(path: string, body: any = {}): Promise<any> {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new SessionApiError(
          data.data?.message ||
            `API request failed with status ${response.status}`,
          data.code,
          response.status,
        );
      }

      const data = await response.json();
      return data.data;
    } catch (err) {
      if (err instanceof SessionApiError) {
        throw err;
      }
      throw new SessionApiError("API request failed");
    }
  }

  public async startSession(config: SessionConfig): Promise<SessionInfo> {
    return await this.post(`/start-session`, config);
  }

  public async stopSession(): Promise<void> {
    return await this.post(`/stop-session`);
  }

  public async keepAlive(): Promise<void> {
    return await this.post(`/keep-alive`);
  }
}
