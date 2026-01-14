// apps/demo/app/api/secrets.ts

export const API_URL = (process.env.API_URL || "https://api.liveavatar.com").replace(/\/$/, "");

// HeyGen / LiveAvatar API key (what you currently store in Vercel as HEYGEN_API_KEY)
export const API_KEY = (process.env.HEYGEN_API_KEY || process.env.API_KEY || "").trim();

export const AVATAR_ID = (process.env.AVATAR_ID || "").trim();
export const VOICE_ID = (process.env.VOICE_ID || "").trim();
export const CONTEXT_ID = (process.env.CONTEXT_ID || "").trim();
export const LANGUAGE = (process.env.LANGUAGE || "en").trim();

// Optional
export const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY || "").trim();
export const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
