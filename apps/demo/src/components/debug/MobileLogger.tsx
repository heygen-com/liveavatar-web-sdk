"use client";

import React, { useState, useEffect, useRef } from "react";

interface LogEntry {
  id: number;
  type: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: string;
}

interface MobileLoggerProps {
  enabled?: boolean;
  maxLogs?: number;
  filter?: string; // Solo mostrar logs que contengan este string (empty = show all)
}

export const MobileLogger: React.FC<MobileLoggerProps> = ({
  enabled = true,
  maxLogs = 100, // Increased to show more history
  filter = "", // Empty = show ALL logs
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const logIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    // Guardar referencias originales
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    // Función para agregar log
    const addLog = (type: LogEntry["type"], args: unknown[]) => {
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
        )
        .join(" ");

      // Filtrar si es necesario
      if (filter && !message.includes(filter)) {
        return;
      }

      const entry: LogEntry = {
        id: logIdRef.current++,
        type,
        message,
        timestamp: new Date().toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
        }),
      };

      setLogs((prev) => [...prev.slice(-maxLogs + 1), entry]);
    };

    // Override console methods
    console.log = (...args) => {
      originalConsole.log(...args);
      addLog("log", args);
    };
    console.warn = (...args) => {
      originalConsole.warn(...args);
      addLog("warn", args);
    };
    console.error = (...args) => {
      originalConsole.error(...args);
      addLog("error", args);
    };
    console.info = (...args) => {
      originalConsole.info(...args);
      addLog("info", args);
    };

    // Cleanup
    return () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.info = originalConsole.info;
    };
  }, [enabled, maxLogs, filter]);

  // Auto-scroll al final
  useEffect(() => {
    if (containerRef.current && !isMinimized) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, isMinimized]);

  if (!enabled || !isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-black/80 text-white px-3 py-2 rounded-full text-xs font-mono"
      >
        📋 Logs
      </button>
    );
  }

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "error":
        return "text-red-400";
      case "warn":
        return "text-yellow-400";
      case "info":
        return "text-blue-400";
      default:
        return "text-green-400";
    }
  };

  const copyAllLogs = async () => {
    const logText = logs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`,
      )
      .join("\n");

    try {
      await navigator.clipboard.writeText(logText);
      // Visual feedback
      const btn = document.getElementById("copy-logs-btn");
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = originalText;
        }, 1500);
      }
    } catch {
      // Fallback for mobile browsers that don't support clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = logText;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  return (
    <div
      className={`fixed z-[9999] bg-black/90 backdrop-blur-sm text-white font-mono text-[10px] leading-tight rounded-lg shadow-2xl border border-white/20 ${
        isMinimized
          ? "bottom-4 right-4 w-auto"
          : "bottom-0 left-0 right-0 h-[40vh] max-h-[300px]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/20 bg-black/50">
        <span className="font-bold">
          📱 Mobile Logs {filter && `(${filter})`}
        </span>
        <div className="flex gap-2">
          <button
            id="copy-logs-btn"
            onClick={copyAllLogs}
            className="px-2 py-1 bg-blue-500/30 rounded text-[9px] hover:bg-blue-500/50"
          >
            Copy All
          </button>
          <button
            onClick={() => setLogs([])}
            className="px-2 py-1 bg-red-500/30 rounded text-[9px] hover:bg-red-500/50"
          >
            Clear
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="px-2 py-1 bg-white/20 rounded text-[9px] hover:bg-white/30"
          >
            {isMinimized ? "Expand" : "Minimize"}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="px-2 py-1 bg-white/20 rounded text-[9px] hover:bg-white/30"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div
          ref={containerRef}
          className="overflow-y-auto p-2 h-[calc(100%-40px)]"
        >
          {logs.length === 0 ? (
            <div className="text-white/50 text-center py-4">
              Waiting for logs...
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`py-0.5 border-b border-white/5 ${getLogColor(log.type)}`}
              >
                <span className="text-white/40 mr-2">{log.timestamp}</span>
                <span className="break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Minimized: Show last log */}
      {isMinimized && logs.length > 0 && (
        <div className="px-3 py-1 max-w-[200px] truncate text-[9px]">
          {logs[logs.length - 1]?.message.substring(0, 50)}...
        </div>
      )}
    </div>
  );
};

export default MobileLogger;
