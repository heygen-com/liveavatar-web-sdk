export type BackgroundConfig =
  | { kind: "none" }
  | { kind: "transparent" }
  | { kind: "color"; value: string }
  | { kind: "image"; url: string }
  | { kind: "video"; url: string };

export type SessionFormConfig = {
  avatar_id: string;
  voice_id: string;
  context_id: string;
  language: string;
};

export type ChromaKeyOptions = {
  minHue: number;
  maxHue: number;
  minSaturation: number;
  threshold: number;
};

export const DEFAULT_CHROMA_KEY_OPTIONS: ChromaKeyOptions = {
  minHue: 60,
  maxHue: 180,
  minSaturation: 0.1,
  threshold: 1.0,
};
