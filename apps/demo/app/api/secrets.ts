export const API_KEY = process.env.API_KEY ?? "";
export const API_URL = process.env.API_URL ?? "https://api.liveavatar.com";
export const AVATAR_ID =
  process.env.DEFAULT_AVATAR_ID ?? "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a";

// When true, we will call everything in Sandbox mode.
// Useful for integration and development.
// Env vars are strings: any value other than "false" keeps sandbox on.
export const IS_SANDBOX = process.env.IS_SANDBOX !== "false";

// FULL MODE Customizations
// Wayne's avatar voice and context
export const VOICE_ID =
  process.env.DEFAULT_VOICE_ID ?? "c2527536-6d1f-4412-a643-53a3497dada9";
export const CONTEXT_ID =
  process.env.DEFAULT_CONTEXT_ID ?? "5b9dba8a-aa31-11f0-a6ee-066a7fa2e369";
export const LANGUAGE = process.env.DEFAULT_LANGUAGE ?? "en";

// LITE MODE Customizations
export const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? "";
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
