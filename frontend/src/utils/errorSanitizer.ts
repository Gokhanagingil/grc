/**
 * Error Sanitizer Utility
 *
 * Provides functions to sanitize sensitive data from error messages and stack traces
 * before sending telemetry to the backend. This prevents accidental exposure of
 * PII, tokens, and credentials in crash reports.
 *
 * Risk Level: P1 (High) - Prevents credential/PII leakage in telemetry
 *
 * Sanitized patterns:
 * - Authorization headers (Bearer tokens, Basic auth)
 * - JWT-like tokens
 * - Email addresses
 * - API keys and secrets
 * - Password fields
 * - Cookie values
 *
 * Usage:
 *   import { sanitizeErrorMessage, sanitizeStackTrace } from './errorSanitizer';
 *   const safeMessage = sanitizeErrorMessage(error.message);
 *   const safeStack = sanitizeStackTrace(error.stack);
 */

/**
 * Maximum length for error messages to prevent excessive data transmission
 */
const MAX_MESSAGE_LENGTH = 500;

/**
 * Maximum length for stack traces
 */
const MAX_STACK_LENGTH = 2000;

/**
 * Patterns for sensitive data detection
 */
const SENSITIVE_PATTERNS = {
  // JWT tokens (three base64 segments separated by dots)
  jwt: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,

  // Authorization header values (Bearer, Basic, etc.)
  authHeader: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi,
  basicAuth: /Basic\s+[A-Za-z0-9+/=]+/gi,

  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // API keys (common patterns: 32+ character alphanumeric strings)
  apiKey:
    /(?:api[_-]?key|apikey|secret|token)['":\s]*[=:]\s*['"]?([A-Za-z0-9\-_]{32,})['"]?/gi,

  // Password values in JSON or query strings
  password: /(?:password|passwd|pwd)['":\s]*[=:]\s*['"]?([^'"\s&]+)['"]?/gi,

  // Cookie values
  cookie: /(?:cookie|session)['":\s]*[=:]\s*['"]?([^'"\s;]+)['"]?/gi,

  // Authorization header in various formats
  authorizationValue: /authorization['":\s]*[=:]\s*['"]?([^'"\s]+)['"]?/gi,

  // Generic long tokens (40+ chars that look like secrets)
  longToken: /(?<![A-Za-z0-9])[A-Za-z0-9]{40,}(?![A-Za-z0-9])/g,

  // UUID-like patterns that might be sensitive (but keep for debugging context)
  // We don't redact UUIDs as they're useful for correlation
};

/**
 * Sanitize a string by replacing sensitive patterns
 *
 * @param input - The string to sanitize
 * @returns The sanitized string with sensitive data redacted
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
    'Bearer [TOKEN_REDACTED]'
  );
  result = result.replace(
    SENSITIVE_PATTERNS.basicAuth,
    'Basic [CREDENTIALS_REDACTED]'
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
      if (value) {
        return match.replace(value, '[PASSWORD_REDACTED]');
      }
      return match;
    }
  );

  // Replace API keys
  result = result.replace(
    SENSITIVE_PATTERNS.apiKey,
    (match: string, value: string) => {
      if (value) {
        return match.replace(value, '[KEY_REDACTED]');
      }
      return match;
    }
  );

  // Replace cookie values
  result = result.replace(
    SENSITIVE_PATTERNS.cookie,
    (match: string, value: string) => {
      if (value) {
        return match.replace(value, '[COOKIE_REDACTED]');
      }
      return match;
    }
  );

  // Replace authorization values
  result = result.replace(
    SENSITIVE_PATTERNS.authorizationValue,
    (match: string, value: string) => {
      if (value) {
        return match.replace(value, '[AUTH_REDACTED]');
      }
      return match;
    }
  );

  return result;
}

/**
 * Sanitize an error message, removing sensitive data and truncating to max length
 *
 * @param message - The error message to sanitize
 * @param maxLength - Maximum length for the message (default: 500)
 * @returns The sanitized and truncated message
 */
export function sanitizeErrorMessage(
  message: string | undefined | null,
  maxLength: number = MAX_MESSAGE_LENGTH
): string {
  if (!message) {
    return '';
  }

  let sanitized = sanitizeString(message);

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...[TRUNCATED]';
  }

  return sanitized;
}

/**
 * Sanitize a stack trace, removing sensitive data and truncating to max length
 *
 * @param stack - The stack trace to sanitize
 * @param maxLength - Maximum length for the stack trace (default: 2000)
 * @returns The sanitized and truncated stack trace
 */
export function sanitizeStackTrace(
  stack: string | undefined | null,
  maxLength: number = MAX_STACK_LENGTH
): string {
  if (!stack) {
    return '';
  }

  let sanitized = sanitizeString(stack);

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...[TRUNCATED]';
  }

  return sanitized;
}

/**
 * Sanitize a component stack trace from React error boundaries
 *
 * @param componentStack - The React component stack
 * @param maxLength - Maximum length (default: 1000)
 * @returns The sanitized component stack
 */
export function sanitizeComponentStack(
  componentStack: string | undefined | null,
  maxLength: number = 1000
): string {
  if (!componentStack) {
    return '';
  }

  // Component stacks typically don't contain sensitive data,
  // but we still sanitize and truncate for safety
  let sanitized = sanitizeString(componentStack);

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...[TRUNCATED]';
  }

  return sanitized;
}

/**
 * Create a sanitized error payload for telemetry
 *
 * @param error - The error object
 * @param errorInfo - React error info (optional)
 * @returns A sanitized error payload safe for transmission
 */
export function createSanitizedErrorPayload(
  error: Error,
  errorInfo?: { componentStack?: string }
): {
  name: string;
  message: string;
  stack: string;
  componentStack: string;
} {
  return {
    name: error.name || 'Error',
    message: sanitizeErrorMessage(error.message),
    stack: sanitizeStackTrace(error.stack),
    componentStack: sanitizeComponentStack(errorInfo?.componentStack),
  };
}
