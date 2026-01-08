/**
 * Secure Logger
 * Sanitizes sensitive data (tokens, emails, API keys, PII) in logs
 * - Development: Full verbose logging for debugging
 * - Production: Only warn/error, all sensitive data redacted
 */

// Sensitive data patterns to redact
const SENSITIVE_PATTERNS = [
  { pattern: /bearer\s+[\w\-._~+/]+=*/gi, replacement: "Bearer [REDACTED]" },
  { pattern: /eyJ[\w-]*\.eyJ[\w-]*\.[\w-]*/gi, replacement: "[JWT_REDACTED]" },
  {
    pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
    replacement: "[EMAIL_REDACTED]",
  },
  {
    pattern: /api[_-]?key["']?\s*[:=]\s*["']?[\w-]{20,}/gi,
    replacement: "apiKey=[REDACTED]",
  },
  {
    pattern: /gid:\/\/shopify\/\w+\/\d+/gi,
    replacement: "gid://shopify/[REDACTED]",
  },
  // Contextual tokens - keyword first (e.g., "token invalid: abc123")
  {
    pattern:
      /(token|key|secret|password|credential)\s+\w+\s*[:=]?\s*[\w\-._~+/]{6,}/gi,
    replacement: "$1: [TOKEN_REDACTED]",
  },
  // Contextual tokens - keyword in middle (e.g., "invalid token: abc123")
  {
    pattern:
      /\w+\s+(token|key|secret|password|credential)\s*[:=]\s*[\w\-._~+/]{6,}/gi,
    replacement: "$1: [TOKEN_REDACTED]",
  },
  // HMAC tokens (hex strings 40+ chars) - must come before base64
  {
    pattern: /\b[a-f0-9]{40,}\b/gi,
    replacement: "[HMAC_REDACTED]",
  },
  // Base64 tokens (32+ chars)
  {
    pattern: /\b[A-Za-z0-9+/]{32,}={0,2}\b/g,
    replacement: "[TOKEN_REDACTED]",
  },
];

// Object keys that contain sensitive data
const SENSITIVE_KEYS = [
  "password",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "authorization",
  "customer_id",
  "shopifyToken",
  "shopify_token",
  "email",
  "accessToken",
  "refreshToken",
  "sessionToken",
  "session_token",
  "AUTH_SECRET",
  "SHOPIFY_HMAC_SECRET",
  "HEYGEN_API_KEY",
  "ELEVENLABS_API_KEY",
];

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  route?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

/**
 * Sanitize a string by removing sensitive patterns
 */
function sanitizeString(str: string): string {
  let sanitized = str;

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
}

/**
 * Sanitize an object by redacting sensitive keys
 */
function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj;
  }

  // Handle Error objects
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: sanitizeString(obj.message),
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      stack: process.env.NODE_ENV === "development" ? obj.stack : undefined,
    };
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item));
  }

  // Handle plain objects
  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if key is sensitive
      const isSensitiveKey = SENSITIVE_KEYS.some((sensitiveKey) =>
        key.toLowerCase().includes(sensitiveKey.toLowerCase()),
      );

      if (isSensitiveKey) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitize(value);
      }
    }

    return sanitized;
  }

  return obj;
}

/**
 * Main sanitization function
 * Handles strings, objects, arrays, and nested structures
 */
export function sanitize(data: unknown): unknown {
  if (typeof data === "string") {
    return sanitizeString(data);
  }

  if (typeof data === "object") {
    return sanitizeObject(data);
  }

  // Numbers, booleans, etc. - return as-is
  return data;
}

/**
 * Check if we should log at this level
 */
function shouldLog(level: LogLevel): boolean {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const isProduction = process.env.NODE_ENV === "production";

  // In production, only log warn and error
  if (isProduction) {
    return level === "warn" || level === "error";
  }

  // In development, log everything
  return true;
}

/**
 * Format log message with context
 */
function formatMessage(
  level: LogLevel,
  message: string,
  data?: unknown,
  context?: LogContext,
): string {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase().padEnd(5);

  let formatted = `[${timestamp}] ${levelUpper} ${message}`;

  if (context?.route) {
    formatted += ` [route:${context.route}]`;
  }

  if (context?.userId) {
    formatted += ` [user:${context.userId}]`;
  }

  if (context?.sessionId) {
    formatted += ` [session:${context.sessionId}]`;
  }

  return formatted;
}

/**
 * Log function that sanitizes and formats output
 */
function log(
  level: LogLevel,
  message: string,
  data?: unknown,
  context?: LogContext,
): void {
  if (!shouldLog(level)) {
    return;
  }

  const sanitizedMessage = sanitize(message);
  const sanitizedData = data ? sanitize(data) : undefined;
  const sanitizedContext = context ? sanitize(context) : undefined;

  // Ensure sanitizedMessage is a string
  const messageStr =
    typeof sanitizedMessage === "string" ? sanitizedMessage : String(message);

  // Type guard for context - ensure it's LogContext or undefined
  const contextForFormat =
    sanitizedContext &&
    typeof sanitizedContext === "object" &&
    sanitizedContext !== null
      ? (sanitizedContext as LogContext)
      : undefined;

  const formattedMessage = formatMessage(
    level,
    messageStr,
    sanitizedData,
    contextForFormat,
  );

  // Use appropriate console method
  const consoleMethod = console[level] || console.log;

  if (sanitizedData) {
    consoleMethod(formattedMessage, sanitizedData);
  } else {
    consoleMethod(formattedMessage);
  }

  // If there's additional context, log it separately
  if (contextForFormat && Object.keys(contextForFormat).length > 0) {
    consoleMethod("Context:", contextForFormat);
  }
}

/**
 * Secure Logger API
 * All logs are sanitized to remove sensitive data
 */
export const logger = {
  /**
   * Debug level - only in development
   * Use for detailed debugging information
   */
  debug: (message: string, data?: unknown, context?: LogContext): void => {
    log("debug", message, data, context);
  },

  /**
   * Info level - only in development
   * Use for general informational messages
   */
  info: (message: string, data?: unknown, context?: LogContext): void => {
    log("info", message, data, context);
  },

  /**
   * Warning level - production and development
   * Use for warning messages that don't prevent operation
   */
  warn: (message: string, data?: unknown, context?: LogContext): void => {
    log("warn", message, data, context);
  },

  /**
   * Error level - production and development
   * Use for error messages
   */
  error: (
    message: string,
    error?: Error | unknown,
    context?: LogContext,
  ): void => {
    log("error", message, error, context);
  },
};

/**
 * Export sanitize function for testing
 */
export { sanitizeString, sanitizeObject };
