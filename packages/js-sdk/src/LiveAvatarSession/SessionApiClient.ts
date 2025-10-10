import { API_URL } from "../const";
import { SessionInfo } from "./types";

const DEFAULT_ERROR_CODE = 500;
const SUCCESS_CODE = 1000;

class SessionApiError extends Error {
  errorCode: number;
  status: number | null = null;

  constructor(message: string, errorCode?: number, status?: number) {
    super(message);
    this.errorCode = errorCode ?? DEFAULT_ERROR_CODE;
    this.status = status ?? null;
  }
}

export class SessionAPIClient {
  private readonly sessionId: string;
  private readonly sessionToken: string;

  constructor(sessionId: string, sessionToken: string) {
    this.sessionId = sessionId;
    this.sessionToken = sessionToken;
  }

  private async request<T = any>(
    path: string,
    params: RequestInit,
  ): Promise<T> {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...params,
        headers: {
          Authorization: `Bearer ${this.sessionToken}`,
          "Content-Type": "application/json",
          ...params.headers,
        },
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

      if (data.code !== SUCCESS_CODE) {
        throw new SessionApiError(data.data?.message || "API request failed");
      }

      return data.data as T;
    } catch (err) {
      if (err instanceof SessionApiError) {
        throw err;
      }
      throw new SessionApiError("API request failed");
    }
  }

  public async startSession(): Promise<SessionInfo> {
    return await this.request(`/v1/sessions`, {
      method: "POST",
    });
  }

  public async stopSession(): Promise<void> {
    return await this.request(`/v1/sessions`, {
      method: "DELETE",
      body: JSON.stringify({
        session_id: this.sessionId,
      }),
    });
  }

  public async keepAlive(): Promise<void> {
    return await this.request(`/v1/sessions/keep-alive`, {
      method: "POST",
      body: JSON.stringify({
        session_id: this.sessionId,
      }),
    });
  }
}
