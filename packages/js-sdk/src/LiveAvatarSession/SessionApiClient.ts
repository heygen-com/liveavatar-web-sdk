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
  private readonly sessionToken: string;
  private readonly apiUrl: string;

  constructor(sessionToken: string, apiUrl: string = API_URL) {
    this.sessionToken = sessionToken;
    this.apiUrl = apiUrl ?? API_URL;
  }

  private async request<T = any>(
    path: string,
    params: RequestInit,
  ): Promise<T> {
    try {
      const response = await fetch(`${this.apiUrl}${path}`, {
        ...params,
        credentials: "include",
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
    return await this.request(`/v1/sessions/start`, { method: "POST" });
  }

  public async stopSession(): Promise<void> {
    return await this.request(`/v1/sessions/stop`, { method: "POST" });
  }

  public async keepAlive(): Promise<void> {
    return await this.request(`/v1/sessions/keep-alive`, { method: "POST" });
  }
}
