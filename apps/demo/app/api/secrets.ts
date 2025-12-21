// HeyGen API Configuration
export const API_KEY = process.env.HEYGEN_API_KEY || "";
export const API_URL = "https://api.liveavatar.com";

// Avatar IDs - Responsive configuration
// Mobile: Portrait aspect ratio (9:16) - optimized for vertical screens
export const AVATAR_ID_MOBILE =
  process.env.HEYGEN_AVATAR_ID_MOBILE || "65cca4cf-b7c8-4619-871f-84e2cf8b21d4";
// Desktop: Landscape aspect ratio (16:9) - optimized for horizontal screens
export const AVATAR_ID_DESKTOP =
  process.env.HEYGEN_AVATAR_ID_DESKTOP ||
  "073b60a9-89a8-45aa-8902-c358f64d2852";
// Default fallback (used when no device type specified)
export const AVATAR_ID = AVATAR_ID_DESKTOP;

// FULL MODE Customizations
export const VOICE_ID =
  process.env.HEYGEN_VOICE_ID || "864a26b8-bfba-4435-9cc5-1dd593de5ca7";
export const CONTEXT_ID =
  process.env.HEYGEN_CONTEXT_ID || "a467805d-524f-4435-a578-97ea76f446b1";
export const LANGUAGE = process.env.HEYGEN_LANGUAGE || "es";

// CUSTOM MODE Customizations
export const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ELEVENLABS VOICE AGENT
export const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || "";
