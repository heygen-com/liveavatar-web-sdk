import { beforeAll, afterAll, vi } from "vitest";

// Mock environment variables for testing
beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-key-for-testing-only-32-chars-min";
  process.env.SHOPIFY_HMAC_SECRET = "test-shopify-secret-hmac-key-here";
  process.env.HEYGEN_API_KEY = "test-heygen-key";
  process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
  process.env.ELEVENLABS_AGENT_ID = "test-agent-id";
});

afterAll(() => {
  vi.clearAllMocks();
});
