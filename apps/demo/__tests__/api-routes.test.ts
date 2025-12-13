import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as startSessionPost } from "../app/api/start-session/route";
import { POST as startCustomSessionPost } from "../app/api/start-custom-session/route";

// Mock the secrets module
vi.mock("../app/api/secrets", () => ({
  API_KEY: "test-api-key",
  API_URL: "https://api.example.com",
  AVATAR_ID: "test-avatar-id",
  VOICE_ID: "test-voice-id",
  CONTEXT_ID: "test-context-id",
  LANGUAGE: "en",
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("start-session route", () => {
  it("should handle successful response", async () => {
    // Mock successful fetch response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          session_token: "test-token",
          session_id: "test-session-id",
        },
      }),
    });

    const response = await startSessionPost();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      session_token: "test-token",
      session_id: "test-session-id",
    });
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("should handle error response with data[0].message shape", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          data: [{ message: "Invalid API key" }],
        }),
    });

    const response = await startSessionPost();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Invalid API key" });
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Upstream error: status=401"),
    );

    consoleErrorSpy.mockRestore();
  });

  it("should handle error response with data.message shape", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          data: { message: "Bad request" },
        }),
    });

    const response = await startSessionPost();
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Bad request" });
    expect(response.headers.get("Content-Type")).toBe("application/json");

    consoleErrorSpy.mockRestore();
  });

  it("should handle error response with message shape", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () =>
        JSON.stringify({
          message: "Internal server error",
        }),
    });

    const response = await startSessionPost();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Internal server error" });
    expect(response.headers.get("Content-Type")).toBe("application/json");

    consoleErrorSpy.mockRestore();
  });

  it("should handle error response with error shape", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({
          error: "Forbidden",
        }),
    });

    const response = await startSessionPost();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({ error: "Forbidden" });
    expect(response.headers.get("Content-Type")).toBe("application/json");

    consoleErrorSpy.mockRestore();
  });

  it("should handle plain text error response", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "Bad Gateway",
    });

    const response = await startSessionPost();
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data).toEqual({ error: "Bad Gateway" });
    expect(response.headers.get("Content-Type")).toBe("application/json");

    consoleErrorSpy.mockRestore();
  });

  it("should handle missing session_token in success response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {},
      }),
    });

    const response = await startSessionPost();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to retrieve session token" });
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("should handle fetch exception", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const response = await startSessionPost();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Network error" });
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should use optional chaining for nested success response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          session_token: "token",
          session_id: "id",
        },
      }),
    });

    const response = await startSessionPost();
    const data = await response.json();

    expect(data.session_token).toBe("token");
    expect(data.session_id).toBe("id");
  });
});

describe("start-custom-session route", () => {
  it("should handle successful response", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          session_token: "custom-token",
          session_id: "custom-session-id",
        },
      }),
    });

    const response = await startCustomSessionPost();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      session_token: "custom-token",
      session_id: "custom-session-id",
    });
    expect(response.headers.get("Content-Type")).toBe("application/json");

    consoleLogSpy.mockRestore();
  });

  it("should handle error response with data[0].message shape", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          data: [{ message: "Invalid API key for custom session" }],
        }),
    });

    const response = await startCustomSessionPost();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Invalid API key for custom session" });
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Upstream error: status=401"),
    );

    consoleErrorSpy.mockRestore();
  });

  it("should handle error response with data.message shape", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          data: { message: "Bad request for custom session" },
        }),
    });

    const response = await startCustomSessionPost();
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Bad request for custom session" });
    expect(response.headers.get("Content-Type")).toBe("application/json");

    consoleErrorSpy.mockRestore();
  });

  it("should handle error response with message shape", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () =>
        JSON.stringify({
          message: "Internal server error",
        }),
    });

    const response = await startCustomSessionPost();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Internal server error" });
    expect(response.headers.get("Content-Type")).toBe("application/json");

    consoleErrorSpy.mockRestore();
  });

  it("should handle plain text error response", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "Bad Gateway",
    });

    const response = await startCustomSessionPost();
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data).toEqual({ error: "Bad Gateway" });
    expect(response.headers.get("Content-Type")).toBe("application/json");

    consoleErrorSpy.mockRestore();
  });

  it("should handle missing session_token in success response", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {},
      }),
    });

    const response = await startCustomSessionPost();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to retrieve session token" });
    expect(response.headers.get("Content-Type")).toBe("application/json");

    consoleLogSpy.mockRestore();
  });

  it("should handle fetch exception", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const response = await startCustomSessionPost();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Network error" });
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should use optional chaining for nested success response", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          session_token: "custom-token",
          session_id: "custom-id",
        },
      }),
    });

    const response = await startCustomSessionPost();
    const data = await response.json();

    expect(data.session_token).toBe("custom-token");
    expect(data.session_id).toBe("custom-id");

    consoleLogSpy.mockRestore();
  });
});
