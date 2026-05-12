"use client";

import { useState } from "react";
import type { BackgroundConfig } from "@/lib/types";

type BackgroundPickerProps = {
  value: BackgroundConfig;
  onChange: (next: BackgroundConfig) => void;
};

const PRESETS: { label: string; url: string }[] = [
  { label: "Office", url: "/backgrounds/office.jpg" },
  { label: "Beach", url: "/backgrounds/beach.jpg" },
  { label: "Gradient", url: "/backgrounds/gradient.jpg" },
  { label: "Studio", url: "/backgrounds/studio.jpg" },
];

export const BackgroundPicker = ({
  value,
  onChange,
}: BackgroundPickerProps) => {
  const [customUrl, setCustomUrl] = useState("");
  const [customType, setCustomType] = useState<"image" | "video">("image");

  const chromaEnabled = value.kind !== "none";

  const handleChromaToggle = (checked: boolean) => {
    if (checked) {
      onChange({ kind: "transparent" });
    } else {
      onChange({ kind: "none" });
    }
  };

  const handleColor = (color: string) => {
    onChange({ kind: "color", value: color });
  };

  const handlePreset = (url: string) => {
    onChange({ kind: "image", url });
  };

  const handleApplyCustom = () => {
    if (!customUrl) return;
    onChange({ kind: customType, url: customUrl });
  };

  const currentColor = value.kind === "color" ? value.value : "#1e3a8a";

  return (
    <div className="w-72 bg-gray-800 text-gray-100 rounded-lg p-4 flex flex-col gap-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
        Background
      </h2>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={chromaEnabled}
          onChange={(e) => handleChromaToggle(e.target.checked)}
        />
        Remove green background (chroma key)
      </label>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onChange({ kind: "transparent" })}
          disabled={!chromaEnabled}
          className={`text-left text-sm px-3 py-2 rounded border ${
            value.kind === "transparent"
              ? "border-blue-500 bg-blue-950"
              : "border-gray-700 bg-gray-900"
          } disabled:opacity-50`}
        >
          Transparent (show page behind)
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-gray-400">Solid color</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => handleColor(e.target.value)}
            disabled={!chromaEnabled}
            className="h-9 w-12 bg-transparent cursor-pointer"
          />
          <button
            type="button"
            onClick={() => handleColor(currentColor)}
            disabled={!chromaEnabled}
            className={`text-sm px-3 py-1.5 rounded border ${
              value.kind === "color"
                ? "border-blue-500 bg-blue-950"
                : "border-gray-700 bg-gray-900"
            } disabled:opacity-50`}
          >
            Apply color
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-gray-400">Presets</span>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.url}
              type="button"
              onClick={() => handlePreset(p.url)}
              disabled={!chromaEnabled}
              className={`relative h-16 rounded border overflow-hidden bg-gray-900 ${
                value.kind === "image" && value.url === p.url
                  ? "border-blue-500"
                  : "border-gray-700"
              } disabled:opacity-50`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.label}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="absolute bottom-0 left-0 right-0 text-[10px] uppercase tracking-wide bg-black/60 px-1 py-0.5">
                {p.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-gray-400">Custom URL</span>
        <div className="flex gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="custom-type"
              checked={customType === "image"}
              onChange={() => setCustomType("image")}
            />
            Image
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="custom-type"
              checked={customType === "video"}
              onChange={() => setCustomType("video")}
            />
            Video
          </label>
        </div>
        <input
          type="url"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="https://…"
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={handleApplyCustom}
          disabled={!chromaEnabled || !customUrl}
          className="text-sm px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
        >
          Apply URL
        </button>
      </div>
    </div>
  );
};
