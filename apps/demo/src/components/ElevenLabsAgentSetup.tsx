"use client";

import { useEffect, useState } from "react";

interface Secret {
  id: string;
  secret_name: string;
  secret_type: string;
  created_at: string;
}

interface Props {
  onSessionStarted: (sessionToken: string) => void;
  onBack: () => void;
}

const IMPORT_KEY_URL = "https://app.liveavatar.com/voices/third-party/import";

export const ElevenLabsAgentSetup = ({ onSessionStarted, onBack }: Props) => {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(true);
  const [selectedSecretId, setSelectedSecretId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadSecrets = async () => {
    setSecretsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/secrets");
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Failed to load secrets");
        return;
      }
      const { secrets: list } = await res.json();
      const filtered: Secret[] = (list ?? []).filter(
        (s: Secret) => s.secret_type === "ELEVENLABS_API_KEY",
      );
      setSecrets(filtered);
      if (filtered[0]) {
        setSelectedSecretId(filtered[0].id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSecretsLoading(false);
    }
  };

  useEffect(() => {
    loadSecrets();
  }, []);

  const handleStartCall = async () => {
    if (!selectedSecretId) {
      setError("Select an ElevenLabs API key.");
      return;
    }
    if (!agentId.trim()) {
      setError("Enter an agent_id.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/start-elevenlabs-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId.trim(),
          secret_id: selectedSecretId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Failed to start session");
        return;
      }
      const { session_token } = await res.json();
      onSessionStarted(session_token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-6 p-8">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-semibold text-white mb-1">
          ElevenLabs Agent Connector
        </h1>
        <p className="text-sm text-gray-400">
          Pick an ElevenLabs API key and enter an agent_id
        </p>
      </div>

      {error && (
        <div className="w-full px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="w-full flex flex-col gap-2">
        <label className="text-xs text-gray-500 uppercase tracking-wider">
          ElevenLabs API Key
        </label>
        {secretsLoading ? (
          <div className="text-sm text-gray-400">Loading secrets...</div>
        ) : secrets.length === 0 ? (
          <a
            href={IMPORT_KEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-6 py-2.5 rounded-lg bg-white/10 text-white font-medium text-sm border border-white/20 hover:bg-white/20 transition-colors text-center"
          >
            Add ElevenLabs API Key
          </a>
        ) : (
          <>
            <select
              value={selectedSecretId}
              onChange={(e) => setSelectedSecretId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 text-white text-sm border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
            >
              {secrets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.secret_name}
                </option>
              ))}
            </select>
            <a
              href={IMPORT_KEY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-white underline self-start"
            >
              + Add ElevenLabs API Key
            </a>
          </>
        )}
      </div>

      <div className="w-full flex flex-col gap-2">
        <label className="text-xs text-gray-500 uppercase tracking-wider">
          Agent ID
        </label>
        <input
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="agent_xxxxxxxxxxxxxxxxxx"
          className="w-full px-4 py-2.5 rounded-lg bg-white/5 text-white text-sm border border-white/10 focus:outline-none focus:border-white/30 placeholder-gray-500 transition-colors"
        />
      </div>

      <div className="w-full flex flex-col gap-3">
        <button
          onClick={handleStartCall}
          disabled={starting || secretsLoading || secrets.length === 0}
          className="w-full px-6 py-2.5 rounded-lg bg-white/10 text-white font-medium text-base border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {starting ? "Starting..." : "Start Call"}
        </button>
        <button
          onClick={onBack}
          disabled={starting}
          className="w-full px-6 py-2.5 rounded-lg text-gray-400 hover:text-white text-sm transition-colors disabled:opacity-50"
        >
          Back
        </button>
      </div>
    </div>
  );
};
