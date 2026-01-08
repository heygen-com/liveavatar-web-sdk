/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sanitize,
  sanitizeString,
  logger,
} from "@/src/lib/logger/secure-logger";

describe("Secure Logger - Sanitization", () => {
  describe("sanitizeString", () => {
    it("redacts Bearer tokens", () => {
      const input = "Authorization: Bearer abc123xyz456";
      const output = sanitizeString(input);

      expect(output).not.toContain("abc123xyz456");
      expect(output).toContain("[REDACTED]");
    });

    it("redacts JWT tokens", () => {
      const input =
        "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
      const output = sanitizeString(input);

      expect(output).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(output).toContain("[JWT_REDACTED]");
    });

    it("redacts email addresses", () => {
      const input = "User email: user@example.com";
      const output = sanitizeString(input);

      expect(output).not.toContain("user@example.com");
      expect(output).not.toContain("@");
      expect(output).toContain("[EMAIL_REDACTED]");
    });

    it("redacts API keys", () => {
      const input = "api_key: test_key_abcdefghijklmnopqrstuvwxyz123456";
      const output = sanitizeString(input);

      expect(output).not.toContain("test_key_abcdefghijklmnopqrstuvwxyz123456");
      expect(output).toContain("[REDACTED]");
    });

    it("redacts Shopify GIDs", () => {
      const input = "Customer: gid://shopify/Customer/123456789";
      const output = sanitizeString(input);

      expect(output).not.toContain("123456789");
      expect(output).toContain("gid://shopify/[REDACTED]");
    });

    it("redacts HMAC tokens (long hex strings)", () => {
      const input =
        "HMAC: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0";
      const output = sanitizeString(input);

      expect(output).toContain("[HMAC_REDACTED]");
    });

    it("redacts base64 tokens", () => {
      const input = "Session: TlRDFBd2I4dJQbrmzesBFLNeRpZKEbA+3QmD+HqH/vo=";
      const output = sanitizeString(input);

      expect(output).toContain("[TOKEN_REDACTED]");
    });

    it("preserves non-sensitive data", () => {
      const input = "Username: john_doe, Age: 30, Status: active";
      const output = sanitizeString(input);

      expect(output).toBe(input);
    });
  });

  describe("sanitize - Objects", () => {
    it("redacts sensitive keys in objects", () => {
      const input = {
        username: "john",
        password: "secret123",
        apiKey: "sk_test_12345",
        age: 30,
      };

      const output = sanitize(input) as Record<string, any>;

      expect(output.username).toBe("john");
      expect(output.age).toBe(30);
      expect(output.password).toBe("[REDACTED]");
      expect(output.apiKey).toBe("[REDACTED]");
    });

    it("redacts nested sensitive keys", () => {
      const input = {
        user: {
          name: "John",
          email: "john@example.com",
          auth: {
            token: "abc123",
            secret: "xyz789",
          },
        },
      };

      const output = sanitize(input) as any;

      expect(output.user.name).toBe("John");
      expect(output.user.email).toBe("[REDACTED]");
      expect(output.user.auth.token).toBe("[REDACTED]");
      expect(output.user.auth.secret).toBe("[REDACTED]");
    });

    it("handles arrays with sensitive data", () => {
      const input = [
        { name: "User1", email: "user1@test.com" },
        { name: "User2", email: "user2@test.com" },
      ];

      const output = sanitize(input) as any[];

      expect(output[0].name).toBe("User1");
      expect(output[0].email).toBe("[REDACTED]");
      expect(output[1].name).toBe("User2");
      expect(output[1].email).toBe("[REDACTED]");
    });

    it("handles Error objects", () => {
      const input = new Error("Invalid token: abc123xyz");
      const output = sanitize(input) as { name: string; message: string };

      expect(output.name).toBe("Error");
      expect(output.message).toContain("[TOKEN_REDACTED]");
      expect(output.message).not.toContain("abc123xyz");
    });

    it("handles null and undefined", () => {
      expect(sanitize(null)).toBeNull();
      expect(sanitize(undefined)).toBeUndefined();
    });

    it("handles Date objects", () => {
      const date = new Date("2024-01-01");
      const output = sanitize(date);

      expect(output).toEqual(date);
    });

    it("preserves non-object primitives", () => {
      expect(sanitize(123)).toBe(123);
      expect(sanitize(true)).toBe(true);
      expect(sanitize(false)).toBe(false);
    });
  });

  describe("sanitize - Shopify Specific", () => {
    it("redacts shopify_token in request body", () => {
      const input = {
        customer_id: "123456",
        shopify_token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
        deviceType: "mobile",
      };

      const output = sanitize(input) as Record<string, any>;

      expect(output.customer_id).toBe("[REDACTED]");
      expect(output.shopify_token).toBe("[REDACTED]");
      expect(output.deviceType).toBe("mobile");
    });

    it("redacts customer GIDs in strings", () => {
      const input = "Validated customer: gid://shopify/Customer/987654321";
      const output = sanitize(input);

      expect(output).not.toContain("987654321");
      expect(output).toContain("gid://shopify/[REDACTED]");
    });
  });

  describe("sanitize - Auth Specific", () => {
    it("redacts AUTH_SECRET from env-like objects", () => {
      const input = {
        NODE_ENV: "production",
        AUTH_SECRET: "super-secret-key-here",
        PORT: 3000,
      };

      const output = sanitize(input) as Record<string, any>;

      expect(output.NODE_ENV).toBe("production");
      expect(output.PORT).toBe(3000);
      expect(output.AUTH_SECRET).toBe("[REDACTED]");
    });

    it("redacts session tokens", () => {
      const input = {
        sessionToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature",
        userId: "user123",
      };

      const output = sanitize(input) as Record<string, any>;

      expect(output.sessionToken).toBe("[REDACTED]");
      expect(output.userId).toBe("user123");
    });
  });
});

describe("Secure Logger - Logging", () => {
  let consoleSpy: {
    debug: any;
    info: any;
    warn: any;
    error: any;
    log: any;
  };

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks();
  });

  describe("logger.debug", () => {
    it("logs debug messages in development", () => {
      vi.stubEnv("NODE_ENV", "development");

      logger.debug("Test debug message");

      expect(consoleSpy.debug).toHaveBeenCalled();

      vi.unstubAllEnvs();
    });

    it("sanitizes sensitive data in debug logs", () => {
      vi.stubEnv("NODE_ENV", "development");

      logger.debug("Auth attempt", {
        email: "user@test.com",
        token: "secret123",
      });

      // Check that the call was made
      expect(consoleSpy.debug).toHaveBeenCalled();

      // Get the actual logged data (second argument)
      const loggedData = consoleSpy.debug.mock.calls[0][1] as any;
      expect(loggedData.email).toBe("[REDACTED]");
      expect(loggedData.token).toBe("[REDACTED]");

      vi.unstubAllEnvs();
    });
  });

  describe("logger.warn", () => {
    it("logs warnings", () => {
      logger.warn("Warning message");

      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it("sanitizes sensitive data in warnings", () => {
      logger.warn("Invalid token attempt", {
        shopify_token: "fake-token-here",
      });

      expect(consoleSpy.warn).toHaveBeenCalled();
      const loggedData = consoleSpy.warn.mock.calls[0][1] as any;
      expect(loggedData.shopify_token).toBe("[REDACTED]");
    });
  });

  describe("logger.error", () => {
    it("logs errors", () => {
      logger.error("Error occurred");

      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it("sanitizes Error objects", () => {
      const error = new Error("Token invalid: abc123xyz");

      logger.error("Auth failed", error);

      expect(consoleSpy.error).toHaveBeenCalled();
      const loggedError = consoleSpy.error.mock.calls[0][1] as any;
      expect(loggedError.message).not.toContain("abc123xyz");
      expect(loggedError.message).toContain("[TOKEN_REDACTED]");
    });
  });

  describe("logger context", () => {
    it("includes route context in logs", () => {
      vi.stubEnv("NODE_ENV", "development");

      logger.info("Request received", null, {
        route: "/api/start-custom-session",
      });

      expect(consoleSpy.info).toHaveBeenCalled();
      const logMessage = consoleSpy.info.mock.calls[0][0];
      expect(logMessage).toContain("/api/start-custom-session");

      vi.unstubAllEnvs();
    });

    it("sanitizes sensitive context data", () => {
      vi.stubEnv("NODE_ENV", "development");

      logger.info("User action", null, {
        route: "/api/test",
        email: "user@test.com",
      });

      expect(consoleSpy.info).toHaveBeenCalled();

      vi.unstubAllEnvs();
    });
  });
});
