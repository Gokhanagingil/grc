/**
 * Log Sanitization Utility
 *
 * Provides functions to sanitize sensitive data from log entries to prevent
 * accidental exposure of PII, tokens, and credentials in logs.
 *
 * Risk Level: P1 (High) - Prevents credential/PII leakage in logs
 *
 * Sanitized patterns:
 * - Authorization headers (Bearer tokens, Basic auth)
 * - Email addresses
 * - JWT-like tokens
 * - API keys and secrets
 * - Password fields
 *
 * Usage:
 *   import { sanitizeLogData, sanitizeString } from './log-sanitizer';
 *   const safeData = sanitizeLogData(sensitiveObject);
 *   const safeString = sanitizeString(sensitiveString);
 */

/**
 * Patterns for sensitive data detection
 */
const SENSITIVE_PATTERNS = {
  // Authorization header values (Bearer, Basic, etc.)
  authHeader: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi,
  basicAuth: /Basic\s+[A-Za-z0-9+/=]+/gi,

  // JWT tokens (three base64 segments separated by dots)
  jwt: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,

  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // API keys (common patterns: 32+ character alphanumeric strings)
  apiKey:
    /(?:api[_-]?key|apikey|secret|token)['":\s]*[=:]\s*['"]?([A-Za-z0-9\-_]{32,})['"]?/gi,

  // Password values in JSON or query strings
  password: /(?:password|passwd|pwd)['":\s]*[=:]\s*['"]?([^'"\s&]+)['"]?/gi,

  // Generic long tokens (40+ chars that look like secrets)
  longToken: /(?<![A-Za-z0-9])[A-Za-z0-9]{40,}(?![A-Za-z0-9])/g,
};

/**
 * Keys that should have their values masked
 */
const SENSITIVE_KEYS = new Set([
  'authorization',
  'auth',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'password',
  'passwd',
  'pwd',
  'secret',
  'apikey',
  'api_key',
  'apiSecret',
  'api_secret',
  'privatekey',
  'private_key',
  'credentials',
  'cookie',
  'session',
  'sessionid',
  'session_id',
]);

/**
 * Mask a sensitive string value
 */
function maskValue(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars * 2) {
    return '[REDACTED]';
  }
  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  return `${start}...${end}[REDACTED]`;
}

/**
 * Sanitize a string by replacing sensitive patterns
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  let result = input;

  // Replace JWT tokens
  result = result.replace(SENSITIVE_PATTERNS.jwt, '[JWT_REDACTED]');

  // Replace Authorization headers
  result = result.replace(
    SENSITIVE_PATTERNS.authHeader,
    'Bearer [TOKEN_REDACTED]',
  );
  result = result.replace(
    SENSITIVE_PATTERNS.basicAuth,
    'Basic [CREDENTIALS_REDACTED]',
  );

  // Replace email addresses (keep domain for debugging context)
  result = result.replace(SENSITIVE_PATTERNS.email, (match) => {
    const atIndex = match.indexOf('@');
    if (atIndex > 0) {
      const domain = match.substring(atIndex);
      return `[EMAIL_REDACTED]${domain}`;
    }
    return '[EMAIL_REDACTED]';
  });

  // Replace password values
  result = result.replace(
    SENSITIVE_PATTERNS.password,
    (match: string, value: string) => {
      return match.replace(value, '[PASSWORD_REDACTED]');
    },
  );

  // Replace API keys
  result = result.replace(
    SENSITIVE_PATTERNS.apiKey,
    (match: string, value: string) => {
      if (value) {
        return match.replace(value, '[KEY_REDACTED]');
      }
      return match;
    },
  );

  return result;
}

/**
 * Check if a key name indicates sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_KEYS.has(normalizedKey);
}

/**
 * Recursively sanitize an object, masking sensitive values
 */
export function sanitizeLogData<T>(data: T, depth = 0): T {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_EXCEEDED]' as unknown as T;
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeString(data) as unknown as T;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    const sanitizedArray = data.map((item: unknown) =>
      sanitizeLogData(item, depth + 1),
    );
    return sanitizedArray as unknown as T;
  }

  // Handle Error objects specially
  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeString(data.message),
      stack: data.stack ? sanitizeString(data.stack) : undefined,
    } as unknown as T;
  }

  // Handle plain objects
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      // Mask the entire value for sensitive keys
      if (typeof value === 'string') {
        result[key] = maskValue(value);
      } else if (value !== null && value !== undefined) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeLogData(value, depth + 1);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Sanitize HTTP headers object
 */
export function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    if (
      lowerKey === 'authorization' ||
      lowerKey === 'cookie' ||
      lowerKey === 'x-api-key'
    ) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) => sanitizeString(v));
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Create a sanitized copy of request metadata for logging
 */
export function sanitizeRequestMetadata(metadata: {
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
}): {
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
} {
  return {
    headers: metadata.headers ? sanitizeHeaders(metadata.headers) : undefined,
    body: metadata.body ? sanitizeLogData(metadata.body) : undefined,
    query: metadata.query ? sanitizeLogData(metadata.query) : undefined,
    params: metadata.params ? sanitizeLogData(metadata.params) : undefined,
  };
}
