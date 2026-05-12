"use client";

import { useState } from "react";
import type { SessionFormConfig } from "@/lib/types";

type ConfigFormProps = {
  onStart: (config: SessionFormConfig) => void;
  isLoading: boolean;
};

export const ConfigForm = ({ onStart, isLoading }: ConfigFormProps) => {
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [contextId, setContextId] = useState("");
  const [language, setLanguage] = useState("en");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({
      avatar_id: avatarId,
      voice_id: voiceId,
      context_id: contextId,
      language,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto bg-gray-800 text-gray-100 rounded-lg p-6 flex flex-col gap-4"
    >
      <h1 className="text-xl font-semibold">LiveAvatar Background Demo</h1>
      <p className="text-sm text-gray-400">
        Leave fields empty to use the defaults configured in{" "}
        <code>.env.local</code>.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Avatar ID
        <input
          type="text"
          value={avatarId}
          onChange={(e) => setAvatarId(e.target.value)}
          placeholder="(default)"
          className="bg-gray-900 border border-gray-700 rounded px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Voice ID
        <input
          type="text"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          placeholder="(default)"
          className="bg-gray-900 border border-gray-700 rounded px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Context ID
        <input
          type="text"
          value={contextId}
          onChange={(e) => setContextId(e.target.value)}
          placeholder="(default)"
          className="bg-gray-900 border border-gray-700 rounded px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Language
        <input
          type="text"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={isLoading}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded"
      >
        {isLoading ? "Starting…" : "Start session"}
      </button>
    </form>
  );
};
