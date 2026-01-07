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
 * - Object sanitization uses allowlist + extraFields to prevent prototype pollution
 * - NO dynamic property assignment (obj[userKey] = ...) to prevent remote property injection
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
 * Dangerous keys that should never be processed
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Valid key pattern for object sanitization
 */
const VALID_KEY_PATTERN = /^[a-zA-Z0-9_.-]{1,80}$/;

/**
 * Allowlist of known safe keys that can be assigned as static properties
 * These are common log fields that we explicitly support
 */
const ALLOWED_KEYS = new Set([
  // Common log fields
  'message',
  'stack',
  'name',
  'code',
  'status',
  'statusCode',
  'error',
  'errorCode',
  'errorMessage',
  // Request/response fields
  'method',
  'path',
  'url',
  'query',
  'params',
  'body',
  'headers',
  'ip',
  'userAgent',
  'referer',
  'origin',
  'host',
  // Correlation/tracing
  'correlationId',
  'requestId',
  'traceId',
  'spanId',
  // Tenant/user context
  'tenantId',
  'userId',
  'username',
  'email',
  'role',
  'roles',
  // Timing
  'timestamp',
  'duration',
  'responseTime',
  'startTime',
  'endTime',
  // Metadata
  'level',
  'context',
  'service',
  'version',
  'environment',
  'action',
  'resource',
  'result',
  'success',
  'data',
  'meta',
  'details',
  'description',
  'reason',
  'source',
  'target',
  'type',
  'id',
  'count',
  'total',
  'page',
  'pageSize',
  'limit',
  'offset',
  // Error boundary telemetry fields
  'componentStack',
  'lastApiEndpoint',
  'windowLocation',
  // Common nested object keys
  'user',
  'request',
  'response',
  'payload',
  'config',
  'options',
  'settings',
  'metadata',
  'info',
  'debug',
  'warn',
  'trace',
  // Sensitive keys (values will be redacted but keys are allowed)
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'privateKey',
  'private_key',
  'credentials',
  'cookie',
  'session',
  'sessionId',
  'session_id',
  'authorization',
  'auth',
  'login',
]);

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
 * Extra field entry for dynamic keys not in the allowlist
 */
export interface ExtraField {
  key: string;
  value: unknown;
}

/**
 * Sanitized object result type with static properties and extraFields
 */
export interface SanitizedObject {
  // Common log fields
  message?: unknown;
  stack?: unknown;
  name?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  error?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
  // Request/response fields
  method?: unknown;
  path?: unknown;
  url?: unknown;
  query?: unknown;
  params?: unknown;
  body?: unknown;
  headers?: unknown;
  ip?: unknown;
  userAgent?: unknown;
  referer?: unknown;
  origin?: unknown;
  host?: unknown;
  // Correlation/tracing
  correlationId?: unknown;
  requestId?: unknown;
  traceId?: unknown;
  spanId?: unknown;
  // Tenant/user context
  tenantId?: unknown;
  userId?: unknown;
  username?: unknown;
  email?: unknown;
  role?: unknown;
  roles?: unknown;
  // Timing
  timestamp?: unknown;
  duration?: unknown;
  responseTime?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  // Metadata
  level?: unknown;
  context?: unknown;
  service?: unknown;
  version?: unknown;
  environment?: unknown;
  action?: unknown;
  resource?: unknown;
  result?: unknown;
  success?: unknown;
  data?: unknown;
  meta?: unknown;
  details?: unknown;
  description?: unknown;
  reason?: unknown;
  source?: unknown;
  target?: unknown;
  type?: unknown;
  id?: unknown;
  count?: unknown;
  total?: unknown;
  page?: unknown;
  pageSize?: unknown;
  limit?: unknown;
  offset?: unknown;
  // Error boundary telemetry fields
  componentStack?: unknown;
  lastApiEndpoint?: unknown;
  windowLocation?: unknown;
  // Common nested object keys
  user?: unknown;
  request?: unknown;
  response?: unknown;
  payload?: unknown;
  config?: unknown;
  options?: unknown;
  settings?: unknown;
  metadata?: unknown;
  info?: unknown;
  debug?: unknown;
  warn?: unknown;
  trace?: unknown;
  // Sensitive keys (values will be redacted)
  password?: unknown;
  passwd?: unknown;
  pwd?: unknown;
  secret?: unknown;
  token?: unknown;
  accessToken?: unknown;
  access_token?: unknown;
  refreshToken?: unknown;
  refresh_token?: unknown;
  apiKey?: unknown;
  api_key?: unknown;
  apiSecret?: unknown;
  api_secret?: unknown;
  privateKey?: unknown;
  private_key?: unknown;
  credentials?: unknown;
  cookie?: unknown;
  session?: unknown;
  sessionId?: unknown;
  session_id?: unknown;
  authorization?: unknown;
  auth?: unknown;
  login?: unknown;
  // Extra fields for dynamic keys
  extraFields?: ExtraField[];
  // Truncation/skip markers
  _keysTruncated?: boolean;
  _unsafeKeySkipped?: boolean;
}

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
 * Check if a key is safe to use (not a dangerous prototype key and valid format)
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
 * Sanitize a value based on whether its key is sensitive
 */
function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (isSensitiveKey(key)) {
    // Mask the entire value for sensitive keys
    if (typeof value === 'string') {
      return maskValue(value);
    } else if (value !== null && value !== undefined) {
      return '[REDACTED]';
    }
    return value;
  } else if (typeof value === 'string') {
    return sanitizeString(value);
  } else if (typeof value === 'object' && value !== null) {
    return sanitizeLogData(value, depth + 1);
  }
  return value;
}

/**
 * Assign a value to a known key using static property assignment
 * This function uses a switch statement to avoid dynamic property injection
 */
function assignToKnownKey(
  result: SanitizedObject,
  key: string,
  value: unknown,
): void {
  // Use switch statement with static property assignments to avoid CodeQL alerts
  switch (key) {
    case 'message':
      result.message = value;
      break;
    case 'stack':
      result.stack = value;
      break;
    case 'name':
      result.name = value;
      break;
    case 'code':
      result.code = value;
      break;
    case 'status':
      result.status = value;
      break;
    case 'statusCode':
      result.statusCode = value;
      break;
    case 'error':
      result.error = value;
      break;
    case 'errorCode':
      result.errorCode = value;
      break;
    case 'errorMessage':
      result.errorMessage = value;
      break;
    case 'method':
      result.method = value;
      break;
    case 'path':
      result.path = value;
      break;
    case 'url':
      result.url = value;
      break;
    case 'query':
      result.query = value;
      break;
    case 'params':
      result.params = value;
      break;
    case 'body':
      result.body = value;
      break;
    case 'headers':
      result.headers = value;
      break;
    case 'ip':
      result.ip = value;
      break;
    case 'userAgent':
      result.userAgent = value;
      break;
    case 'referer':
      result.referer = value;
      break;
    case 'origin':
      result.origin = value;
      break;
    case 'host':
      result.host = value;
      break;
    case 'correlationId':
      result.correlationId = value;
      break;
    case 'requestId':
      result.requestId = value;
      break;
    case 'traceId':
      result.traceId = value;
      break;
    case 'spanId':
      result.spanId = value;
      break;
    case 'tenantId':
      result.tenantId = value;
      break;
    case 'userId':
      result.userId = value;
      break;
    case 'username':
      result.username = value;
      break;
    case 'email':
      result.email = value;
      break;
    case 'role':
      result.role = value;
      break;
    case 'roles':
      result.roles = value;
      break;
    case 'timestamp':
      result.timestamp = value;
      break;
    case 'duration':
      result.duration = value;
      break;
    case 'responseTime':
      result.responseTime = value;
      break;
    case 'startTime':
      result.startTime = value;
      break;
    case 'endTime':
      result.endTime = value;
      break;
    case 'level':
      result.level = value;
      break;
    case 'context':
      result.context = value;
      break;
    case 'service':
      result.service = value;
      break;
    case 'version':
      result.version = value;
      break;
    case 'environment':
      result.environment = value;
      break;
    case 'action':
      result.action = value;
      break;
    case 'resource':
      result.resource = value;
      break;
    case 'result':
      result.result = value;
      break;
    case 'success':
      result.success = value;
      break;
    case 'data':
      result.data = value;
      break;
    case 'meta':
      result.meta = value;
      break;
    case 'details':
      result.details = value;
      break;
    case 'description':
      result.description = value;
      break;
    case 'reason':
      result.reason = value;
      break;
    case 'source':
      result.source = value;
      break;
    case 'target':
      result.target = value;
      break;
    case 'type':
      result.type = value;
      break;
    case 'id':
      result.id = value;
      break;
    case 'count':
      result.count = value;
      break;
    case 'total':
      result.total = value;
      break;
    case 'page':
      result.page = value;
      break;
    case 'pageSize':
      result.pageSize = value;
      break;
    case 'limit':
      result.limit = value;
      break;
    case 'offset':
      result.offset = value;
      break;
    case 'componentStack':
      result.componentStack = value;
      break;
    case 'lastApiEndpoint':
      result.lastApiEndpoint = value;
      break;
    case 'windowLocation':
      result.windowLocation = value;
      break;
    case 'user':
      result.user = value;
      break;
    case 'request':
      result.request = value;
      break;
    case 'response':
      result.response = value;
      break;
    case 'payload':
      result.payload = value;
      break;
    case 'config':
      result.config = value;
      break;
    case 'options':
      result.options = value;
      break;
    case 'settings':
      result.settings = value;
      break;
    case 'metadata':
      result.metadata = value;
      break;
    case 'info':
      result.info = value;
      break;
    case 'debug':
      result.debug = value;
      break;
    case 'warn':
      result.warn = value;
      break;
    case 'trace':
      result.trace = value;
      break;
    // Sensitive keys (values will be redacted by sanitizeValue)
    case 'password':
      result.password = value;
      break;
    case 'passwd':
      result.passwd = value;
      break;
    case 'pwd':
      result.pwd = value;
      break;
    case 'secret':
      result.secret = value;
      break;
    case 'token':
      result.token = value;
      break;
    case 'accessToken':
      result.accessToken = value;
      break;
    case 'access_token':
      result.access_token = value;
      break;
    case 'refreshToken':
      result.refreshToken = value;
      break;
    case 'refresh_token':
      result.refresh_token = value;
      break;
    case 'apiKey':
      result.apiKey = value;
      break;
    case 'api_key':
      result.api_key = value;
      break;
    case 'apiSecret':
      result.apiSecret = value;
      break;
    case 'api_secret':
      result.api_secret = value;
      break;
    case 'privateKey':
      result.privateKey = value;
      break;
    case 'private_key':
      result.private_key = value;
      break;
    case 'credentials':
      result.credentials = value;
      break;
    case 'cookie':
      result.cookie = value;
      break;
    case 'session':
      result.session = value;
      break;
    case 'sessionId':
      result.sessionId = value;
      break;
    case 'session_id':
      result.session_id = value;
      break;
    case 'authorization':
      result.authorization = value;
      break;
    case 'auth':
      result.auth = value;
      break;
    case 'login':
      result.login = value;
      break;
    default:
      // This should never happen if ALLOWED_KEYS is in sync
      break;
  }
}

/**
 * Recursively sanitize an object, masking sensitive values
 * Uses allowlist + extraFields approach to prevent prototype pollution and remote property injection
 * NO dynamic property assignment (obj[userKey] = ...) is used
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
    const errorResult: SanitizedObject = {
      name: data.name,
      message: sanitizeString(data.message),
      stack: data.stack ? sanitizeString(data.stack) : undefined,
    };
    return errorResult as unknown as T;
  }

  // Handle plain objects using allowlist + extraFields approach
  const result: SanitizedObject = {};
  const extraFields: ExtraField[] = [];
  const entries = Object.entries(data);

  // Limit number of keys to prevent memory bombs
  const maxEntries = Math.min(entries.length, MAX_OBJECT_KEYS);
  let processedCount = 0;
  let keysTruncated = false;
  let unsafeKeySkipped = false;

  for (const [key, value] of entries) {
    if (processedCount >= maxEntries) {
      keysTruncated = true;
      break;
    }

    // Skip dangerous keys to prevent prototype pollution
    if (!isSafeKey(key)) {
      unsafeKeySkipped = true;
      continue;
    }

    processedCount++;
    const sanitizedValue = sanitizeValue(key, value, depth);

    // Check if key is in the allowlist
    if (ALLOWED_KEYS.has(key)) {
      // Use static property assignment for known keys
      assignToKnownKey(result, key, sanitizedValue);
    } else {
      // Put unknown keys in extraFields array (no dynamic property assignment)
      extraFields.push({ key, value: sanitizedValue });
    }
  }

  // Add extraFields if there are any
  if (extraFields.length > 0) {
    result.extraFields = extraFields;
  }

  // Add truncation/skip markers
  if (keysTruncated) {
    result._keysTruncated = true;
  }
  if (unsafeKeySkipped) {
    result._unsafeKeySkipped = true;
  }

  return result as unknown as T;
}

/**
 * Sanitized headers result type
 */
export interface SanitizedHeaders {
  // Common HTTP headers (static properties)
  'content-type'?: string | string[];
  'content-length'?: string | string[];
  accept?: string | string[];
  'accept-language'?: string | string[];
  'accept-encoding'?: string | string[];
  'cache-control'?: string | string[];
  connection?: string | string[];
  host?: string | string[];
  origin?: string | string[];
  referer?: string | string[];
  'user-agent'?: string | string[];
  'x-forwarded-for'?: string | string[];
  'x-forwarded-proto'?: string | string[];
  'x-request-id'?: string | string[];
  'x-correlation-id'?: string | string[];
  'x-tenant-id'?: string | string[];
  // Sensitive headers (always redacted)
  authorization?: string;
  cookie?: string;
  'x-api-key'?: string;
  // Extra headers
  extraHeaders?: Array<{ key: string; value: string | string[] | undefined }>;
}

/**
 * Allowlist of known HTTP headers
 */
const ALLOWED_HEADERS = new Set([
  'content-type',
  'content-length',
  'accept',
  'accept-language',
  'accept-encoding',
  'cache-control',
  'connection',
  'host',
  'origin',
  'referer',
  'user-agent',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-request-id',
  'x-correlation-id',
  'x-tenant-id',
  'authorization',
  'cookie',
  'x-api-key',
]);

/**
 * Assign a header value to a known header key using static property assignment
 */
function assignToKnownHeader(
  result: SanitizedHeaders,
  key: string,
  value: string | string[] | undefined,
): void {
  const lowerKey = key.toLowerCase();
  switch (lowerKey) {
    case 'content-type':
      result['content-type'] = value as string | string[];
      break;
    case 'content-length':
      result['content-length'] = value as string | string[];
      break;
    case 'accept':
      result['accept'] = value as string | string[];
      break;
    case 'accept-language':
      result['accept-language'] = value as string | string[];
      break;
    case 'accept-encoding':
      result['accept-encoding'] = value as string | string[];
      break;
    case 'cache-control':
      result['cache-control'] = value as string | string[];
      break;
    case 'connection':
      result['connection'] = value as string | string[];
      break;
    case 'host':
      result['host'] = value as string | string[];
      break;
    case 'origin':
      result['origin'] = value as string | string[];
      break;
    case 'referer':
      result['referer'] = value as string | string[];
      break;
    case 'user-agent':
      result['user-agent'] = value as string | string[];
      break;
    case 'x-forwarded-for':
      result['x-forwarded-for'] = value as string | string[];
      break;
    case 'x-forwarded-proto':
      result['x-forwarded-proto'] = value as string | string[];
      break;
    case 'x-request-id':
      result['x-request-id'] = value as string | string[];
      break;
    case 'x-correlation-id':
      result['x-correlation-id'] = value as string | string[];
      break;
    case 'x-tenant-id':
      result['x-tenant-id'] = value as string | string[];
      break;
    case 'authorization':
      result.authorization = '[REDACTED]';
      break;
    case 'cookie':
      result.cookie = '[REDACTED]';
      break;
    case 'x-api-key':
      result['x-api-key'] = '[REDACTED]';
      break;
    default:
      break;
  }
}

/**
 * Sanitize HTTP headers object
 * Uses allowlist + extraHeaders approach to prevent prototype pollution and remote property injection
 */
export function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): SanitizedHeaders {
  const result: SanitizedHeaders = {};
  const extraHeaders: Array<{
    key: string;
    value: string | string[] | undefined;
  }> = [];

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

    // Check if it's a known header
    if (ALLOWED_HEADERS.has(lowerKey)) {
      // Sensitive headers are always redacted
      if (
        lowerKey === 'authorization' ||
        lowerKey === 'cookie' ||
        lowerKey === 'x-api-key'
      ) {
        assignToKnownHeader(result, key, '[REDACTED]');
      } else if (typeof value === 'string') {
        assignToKnownHeader(result, key, sanitizeString(value));
      } else if (Array.isArray(value)) {
        assignToKnownHeader(
          result,
          key,
          value.map((v) => sanitizeString(v)),
        );
      } else {
        assignToKnownHeader(result, key, value);
      }
    } else {
      // Unknown headers go to extraHeaders array
      let sanitizedValue: string | string[] | undefined;
      if (typeof value === 'string') {
        sanitizedValue = sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitizedValue = value.map((v) => sanitizeString(v));
      } else {
        sanitizedValue = value;
      }
      extraHeaders.push({ key, value: sanitizedValue });
    }
  }

  // Add extraHeaders if there are any
  if (extraHeaders.length > 0) {
    result.extraHeaders = extraHeaders;
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
  headers?: SanitizedHeaders;
  body?: unknown;
  query?: unknown;
  params?: unknown;
} {
  return {
    headers: metadata.headers ? sanitizeHeaders(metadata.headers) : undefined,
    body: metadata.body ? sanitizeLogData(metadata.body) : undefined,
    query: metadata.query ? sanitizeLogData(metadata.query) : undefined,
    params: metadata.params ? sanitizeLogData(metadata.params) : undefined,
  };
}
