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
 * Security Notes:
 * - Uses O(n) scanning functions instead of regex for JWT detection to prevent ReDoS
 * - Input strings are truncated to MAX_INPUT_LENGTH (10k chars) before processing
 * - Object sanitization uses Object.create(null) to prevent prototype pollution
 * - Dangerous keys (__proto__, prototype, constructor) are blocked
 * - Recursion depth is limited to prevent CPU/memory bombs
 *
 * Usage:
 *   import { sanitizeLogData, sanitizeString } from './log-sanitizer';
 *   const safeData = sanitizeLogData(sensitiveObject);
 *   const safeString = sanitizeString(sensitiveString);
 */

/**
 * Maximum input length to process (prevents DoS via large inputs)
 */
const MAX_INPUT_LENGTH = 10000;

/**
 * Maximum recursion depth for object sanitization
 */
const MAX_DEPTH = 10;

/**
 * Maximum number of keys to process in a single object
 */
const MAX_OBJECT_KEYS = 1000;

/**
 * Dangerous keys that should never be assigned to objects
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Valid key pattern for object sanitization
 */
const VALID_KEY_PATTERN = /^[a-zA-Z0-9_.-]{1,80}$/;

/**
 * Patterns for sensitive data detection (non-ReDoS vulnerable patterns)
 * Note: JWT detection uses O(n) scanning function instead of regex
 */
const SENSITIVE_PATTERNS = {
  // Authorization header values - simple patterns without nested quantifiers
  authHeader: /Bearer\s+\S+/gi,
  basicAuth: /Basic\s+[A-Za-z0-9+/=]+/gi,

  // Email addresses - simplified pattern to avoid backtracking
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // API keys (common patterns: 32+ character alphanumeric strings)
  apiKey:
    /(?:api[_-]?key|apikey|secret|token)['":\s]*[=:]\s*['"]?([A-Za-z0-9\-_]{32,})['"]?/gi,

  // Password values in JSON or query strings
  password: /(?:password|passwd|pwd)['":\s]*[=:]\s*['"]?([^'"\s&]+)['"]?/gi,
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
 * Base64URL character set for JWT validation
 */
const BASE64URL_CHARS = new Set(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split(''),
);

/**
 * Check if a character is a valid base64url character
 */
function isBase64UrlChar(char: string): boolean {
  return BASE64URL_CHARS.has(char);
}

/**
 * O(n) JWT detection and redaction function
 * Scans for 'eyJ' prefix and validates JWT structure without regex backtracking
 *
 * JWT format: header.payload.signature where each part is base64url encoded
 * Header always starts with 'eyJ' (base64 for '{"')
 */
function redactJWTs(input: string): string {
  const result: string[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    // Look for JWT header prefix 'eyJ'
    if (
      i + 2 < len &&
      input[i] === 'e' &&
      input[i + 1] === 'y' &&
      input[i + 2] === 'J'
    ) {
      // Potential JWT found, try to parse it
      let partCount = 0;
      let currentPartLen = 0;
      let j = i;

      // Scan through the potential JWT
      while (j < len) {
        const char = input[j];

        if (char === '.') {
          // Found a dot separator
          if (currentPartLen === 0) {
            // Empty part, not a valid JWT
            break;
          }
          partCount++;
          currentPartLen = 0;
          j++;

          // JWT has exactly 2 dots (3 parts)
          if (partCount > 2) {
            break;
          }
        } else if (isBase64UrlChar(char)) {
          currentPartLen++;
          j++;
        } else {
          // Non-base64url character, end of potential JWT
          break;
        }
      }

      // Valid JWT has exactly 3 parts (2 dots) and the last part has content
      if (partCount === 2 && currentPartLen > 0) {
        // This is a valid JWT structure, redact it
        result.push('[JWT_REDACTED]');
        i = j;
      } else {
        // Not a valid JWT, keep the character
        result.push(input[i]);
        i++;
      }
    } else {
      result.push(input[i]);
      i++;
    }
  }

  return result.join('');
}

/**
 * Truncate input to maximum length for bounded processing time
 */
function truncateInput(input: string): string {
  if (input.length <= MAX_INPUT_LENGTH) {
    return input;
  }
  return input.substring(0, MAX_INPUT_LENGTH) + '[TRUNCATED]';
}

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
 * Uses O(n) scanning for JWT detection to prevent ReDoS
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  // Truncate input to prevent DoS via large strings
  let result = truncateInput(input);

  // Replace JWT tokens using O(n) scanning function (not regex)
  result = redactJWTs(result);

  // Replace Authorization headers (simple patterns, no backtracking risk)
  result = result.replace(SENSITIVE_PATTERNS.authHeader, (match) => {
    // If the token part was already redacted as JWT, keep it
    if (match.includes('[JWT_REDACTED]')) {
      return match;
    }
    return 'Bearer [TOKEN_REDACTED]';
  });
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
 * Check if a key is safe to use (not a dangerous prototype key)
 */
function isSafeKey(key: string): boolean {
  // Block dangerous keys that could cause prototype pollution
  if (DANGEROUS_KEYS.has(key)) {
    return false;
  }

  // Validate key format (alphanumeric, underscore, dot, hyphen, max 80 chars)
  if (!VALID_KEY_PATTERN.test(key)) {
    return false;
  }

  return true;
}

/**
 * Recursively sanitize an object, masking sensitive values
 * Uses Object.create(null) to prevent prototype pollution
 */
export function sanitizeLogData<T>(data: T, depth = 0): T {
  // Prevent infinite recursion
  if (depth > MAX_DEPTH) {
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
    // Limit array size to prevent memory bombs
    const maxItems = Math.min(data.length, MAX_OBJECT_KEYS);
    const sanitizedArray: unknown[] = [];
    for (let i = 0; i < maxItems; i++) {
      sanitizedArray.push(sanitizeLogData(data[i] as unknown, depth + 1));
    }
    if (data.length > MAX_OBJECT_KEYS) {
      sanitizedArray.push('[ARRAY_TRUNCATED]');
    }
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

  // Handle plain objects using Object.create(null) to prevent prototype pollution
  const result: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  const entries = Object.entries(data);

  // Limit number of keys to prevent memory bombs
  const maxEntries = Math.min(entries.length, MAX_OBJECT_KEYS);
  let processedCount = 0;

  for (const [key, value] of entries) {
    if (processedCount >= maxEntries) {
      result['[KEYS_TRUNCATED]'] = true;
      break;
    }

    // Skip dangerous keys to prevent prototype pollution
    if (!isSafeKey(key)) {
      // Log that we skipped a dangerous key (but don't include the key value)
      result['[UNSAFE_KEY_SKIPPED]'] = true;
      continue;
    }

    processedCount++;

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
 * Uses Object.create(null) to prevent prototype pollution
 */
export function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = Object.create(
    null,
  ) as Record<string, string | string[] | undefined>;

  const entries = Object.entries(headers);
  const maxEntries = Math.min(entries.length, MAX_OBJECT_KEYS);
  let processedCount = 0;

  for (const [key, value] of entries) {
    if (processedCount >= maxEntries) {
      break;
    }

    // Skip dangerous keys
    if (!isSafeKey(key)) {
      continue;
    }

    processedCount++;
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
