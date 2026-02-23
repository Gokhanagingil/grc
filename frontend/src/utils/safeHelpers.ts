/**
 * Safe Helper Utilities
 * 
 * These utilities provide crash-proof operations on data that may be undefined,
 * null, or malformed. Use these instead of direct array/object operations on
 * API-derived data to prevent runtime crashes.
 * 
 * Created to fix: Layout crash on onboarding context failure (429-safe)
 */

/**
 * Ensures the input is always an array.
 * Returns an empty array if input is null, undefined, or not an array.
 * 
 * @param value - The value to ensure is an array
 * @returns The input if it's an array, otherwise an empty array
 */
export function safeArray<T>(value: T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

/**
 * Safe version of Array.includes() that handles null/undefined arrays.
 * 
 * @param array - The array to search (may be null/undefined)
 * @param item - The item to search for
 * @returns true if the item is found, false otherwise (including when array is null/undefined)
 */
export function safeIncludes<T>(array: T[] | null | undefined, item: T): boolean {
  if (!Array.isArray(array)) {
    return false;
  }
  return array.includes(item);
}

/**
 * Safe version of Array.map() that handles null/undefined arrays.
 * 
 * @param array - The array to map (may be null/undefined)
 * @param callback - The mapping function
 * @returns The mapped array, or an empty array if input is null/undefined
 */
export function safeMap<T, U>(
  array: T[] | null | undefined,
  callback: (item: T, index: number, array: T[]) => U
): U[] {
  if (!Array.isArray(array)) {
    return [];
  }
  return array.map(callback);
}

/**
 * Safe version of Array.filter() that handles null/undefined arrays.
 * 
 * @param array - The array to filter (may be null/undefined)
 * @param predicate - The filter predicate
 * @returns The filtered array, or an empty array if input is null/undefined
 */
export function safeFilter<T>(
  array: T[] | null | undefined,
  predicate: (item: T, index: number, array: T[]) => boolean
): T[] {
  if (!Array.isArray(array)) {
    return [];
  }
  return array.filter(predicate);
}

/**
 * Safe version of Array.some() that handles null/undefined arrays.
 * 
 * @param array - The array to check (may be null/undefined)
 * @param predicate - The predicate function
 * @returns true if any element satisfies the predicate, false otherwise
 */
export function safeSome<T>(
  array: T[] | null | undefined,
  predicate: (item: T, index: number, array: T[]) => boolean
): boolean {
  if (!Array.isArray(array)) {
    return false;
  }
  return array.some(predicate);
}

/**
 * Safe property access that returns a default value if the property is undefined.
 * 
 * @param obj - The object to access
 * @param key - The property key
 * @param defaultValue - The default value to return if property is undefined
 * @returns The property value or the default value
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue: T[K]
): T[K] {
  if (obj === null || obj === undefined) {
    return defaultValue;
  }
  const value = obj[key];
  return value === undefined ? defaultValue : value;
}

/**
 * Normalizes an API response to ensure expected array fields are always arrays.
 * This is useful for handling responses that may have undefined or null array fields.
 * 
 * @param data - The data object to normalize
 * @param arrayFields - Array of field names that should be arrays
 * @returns The normalized data with guaranteed array fields
 */
export function normalizeArrayFields<T extends Record<string, unknown>>(
  data: T | null | undefined,
  arrayFields: (keyof T)[]
): T {
  if (!data) {
    const result = {} as T;
    for (const field of arrayFields) {
      (result as Record<string, unknown>)[field as string] = [];
    }
    return result;
  }

  const normalized = { ...data };
  for (const field of arrayFields) {
    if (!Array.isArray(normalized[field])) {
      (normalized as Record<string, unknown>)[field as string] = [];
    }
  }
  return normalized;
}

/**
 * Ensures the input is always an array, handling various API response shapes.
 * This is a more robust version of safeArray that also handles:
 * - Envelope responses: {success: true, data: [...]}
 * - Nested data: {success: true, data: {items: [...]}}
 * - Axios responses: response.data patterns
 * - Objects that should be arrays but aren't
 * 
 * @param value - The value to ensure is an array (may be envelope, object, null, undefined)
 * @returns An array, or empty array if input cannot be converted to array
 */
export function ensureArray<T>(value: unknown): T[] {
  // Already an array
  if (Array.isArray(value)) {
    return value as T[];
  }
  
  // Null or undefined
  if (value === null || value === undefined) {
    return [];
  }
  
  // Not an object - can't extract array
  if (typeof value !== 'object') {
    return [];
  }
  
  const obj = value as Record<string, unknown>;
  
  // Handle envelope response: {success: true/false, data: ...}
  if ('success' in obj && 'data' in obj) {
    // If success is false, return empty array
    if (obj.success === false) {
      return [];
    }
    // Recursively handle the data field
    return ensureArray<T>(obj.data);
  }
  
  // Handle {data: ...} pattern (axios response)
  if ('data' in obj && Object.keys(obj).length <= 3) {
    return ensureArray<T>(obj.data);
  }
  
  // Handle {items: [...]} pattern
  if ('items' in obj && Array.isArray(obj.items)) {
    return obj.items as T[];
  }
  
  // Handle {users: [...]} pattern (specific to users endpoint)
  if ('users' in obj && Array.isArray(obj.users)) {
    return obj.users as T[];
  }
  
  // Handle {findings: [...]} pattern
  if ('findings' in obj && Array.isArray(obj.findings)) {
    return obj.findings as T[];
  }
  
  // Handle {requirements: [...]} pattern
  if ('requirements' in obj && Array.isArray(obj.requirements)) {
    return obj.requirements as T[];
  }
  
  // Handle {reports: [...]} pattern
  if ('reports' in obj && Array.isArray(obj.reports)) {
    return obj.reports as T[];
  }
  
  // Object is not array-like, return empty array
  return [];
}

/**
 * Converts any value to an array of strings.
 * Handles various input types:
 * - Array: filters to only strings, trims whitespace, removes empty strings
 * - String: returns [value] if non-empty after trim, else []
 * - null/undefined: returns []
 * - Other: returns []
 * 
 * This is useful for normalizing API responses where field arrays
 * may be undefined, null, or contain non-string values.
 * 
 * @param value - The value to convert to string array
 * @returns An array of non-empty trimmed strings
 */
export function toStringArray(value: unknown): string[] {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return [];
  }
  
  // Handle arrays - filter to strings only, trim, remove empty
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  
  // Handle single string - return as array if non-empty
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  
  // Other types - return empty array
  return [];
}

/**
 * Unwraps API response envelopes to extract the actual data.
 * Handles various response shapes:
 * - {data: X} - axios response wrapper
 * - {success: true, data: X} - NestJS envelope
 * - {success: true, data: {success: true, data: X}} - double-wrapped envelope
 * - Direct data (no wrapper)
 * 
 * This is useful for handling inconsistent API response formats
 * where the same endpoint may return different envelope structures.
 * 
 * @param response - The API response to unwrap
 * @returns The unwrapped data, or the original response if not wrapped
 */
export function unwrapApiEnvelope<T = unknown>(response: unknown): T {
  // Handle null/undefined
  if (response === null || response === undefined) {
    return response as T;
  }
  
  // Not an object - return as-is
  if (typeof response !== 'object') {
    return response as T;
  }
  
  const obj = response as Record<string, unknown>;
  
  // Handle {success: true/false, data: ...} envelope
  if ('success' in obj && 'data' in obj) {
    // If success is false, return the response as-is (error case)
    if (obj.success === false) {
      return response as T;
    }
    // Recursively unwrap the data field (handles double-wrapping)
    return unwrapApiEnvelope<T>(obj.data);
  }
  
  // Handle {data: ...} pattern (axios response) - only if it looks like a wrapper
  // Check that it's a simple wrapper (has data and maybe a few other fields like status, headers)
  if ('data' in obj) {
    const keys = Object.keys(obj);
    // If it looks like an axios response wrapper (has data, status, headers, etc.)
    // or a simple {data: X} wrapper
    const isAxiosLike = keys.some(k => ['status', 'statusText', 'headers', 'config'].includes(k));
    const isSimpleWrapper = keys.length === 1 && keys[0] === 'data';
    if (isAxiosLike || isSimpleWrapper) {
      return unwrapApiEnvelope<T>(obj.data);
    }
  }
  
  // Not a wrapper - return as-is
  return response as T;
}

/**
 * Safely extracts a policies array from an API response.
 * Handles various response shapes:
 * - {policies: [...]}
 * - {data: {policies: [...]}}
 * - {success: true, data: {policies: [...]}}
 * - Direct array
 * 
 * @param response - The API response to extract policies from
 * @returns An array of policies, or empty array if not found
 */
export function extractPoliciesArray<T = unknown>(response: unknown): T[] {
  // Handle null/undefined
  if (response === null || response === undefined) {
    return [];
  }
  
  // Already an array
  if (Array.isArray(response)) {
    return response as T[];
  }
  
  // Not an object
  if (typeof response !== 'object') {
    return [];
  }
  
  const obj = response as Record<string, unknown>;
  
  // Direct {policies: [...]} pattern
  if ('policies' in obj && Array.isArray(obj.policies)) {
    return obj.policies as T[];
  }
  
  // Unwrap envelope and try again
  const unwrapped = unwrapApiEnvelope(response);
  if (unwrapped !== response && typeof unwrapped === 'object' && unwrapped !== null) {
    const unwrappedObj = unwrapped as Record<string, unknown>;
    if ('policies' in unwrappedObj && Array.isArray(unwrappedObj.policies)) {
      return unwrappedObj.policies as T[];
    }
  }
  
  return [];
}

/**
 * Safely extracts an actions object from an API response.
 * Handles various response shapes:
 * - {actions: {...}}
 * - {data: {actions: {...}}}
 * - {success: true, data: {actions: {...}}}
 * 
 * @param response - The API response to extract actions from
 * @returns The actions object, or undefined if not found
 */
/**
 * Extracts an array of items from a CMDB paginated API response.
 * Handles all known envelope variants:
 * 
 * 1. { success: true, data: { items: [...], total, ... } }  — NestJS LIST-CONTRACT
 * 2. { data: { items: [...], total, ... } }                  — partial envelope
 * 3. { items: [...], total, ... }                             — flat paginated
 * 4. { success: true, data: [...] }                           — NestJS array envelope
 * 5. { data: [...] }                                          — partial array envelope
 * 6. [...]                                                    — flat array
 * 7. null / undefined                                         — empty
 * 
 * @param responseData - The `response.data` from an axios call (i.e. the HTTP body)
 * @returns An array of items, or empty array if extraction fails
 */
export function extractPaginatedItems<T = unknown>(responseData: unknown): T[] {
  if (responseData === null || responseData === undefined) {
    return [];
  }

  // Already an array
  if (Array.isArray(responseData)) {
    return responseData as T[];
  }

  if (typeof responseData !== 'object') {
    return [];
  }

  const obj = responseData as Record<string, unknown>;

  // Handle { success: true, data: ... } envelope
  if ('success' in obj && 'data' in obj) {
    const inner = obj.data;
    if (Array.isArray(inner)) {
      return inner as T[];
    }
    if (inner && typeof inner === 'object') {
      const innerObj = inner as Record<string, unknown>;
      if ('items' in innerObj && Array.isArray(innerObj.items)) {
        return innerObj.items as T[];
      }
      if ('data' in innerObj && Array.isArray(innerObj.data)) {
        return innerObj.data as T[];
      }
    }
    return [];
  }

  // Handle { data: ... } envelope (no success field)
  if ('data' in obj) {
    const inner = obj.data;
    if (Array.isArray(inner)) {
      return inner as T[];
    }
    if (inner && typeof inner === 'object') {
      const innerObj = inner as Record<string, unknown>;
      if ('items' in innerObj && Array.isArray(innerObj.items)) {
        return innerObj.items as T[];
      }
    }
  }

  // Handle flat paginated { items: [...] }
  if ('items' in obj && Array.isArray(obj.items)) {
    return obj.items as T[];
  }

  return [];
}

export function extractActionsObject<T = unknown>(response: unknown): T | undefined {
  // Handle null/undefined
  if (response === null || response === undefined) {
    return undefined;
  }
  
  // Not an object
  if (typeof response !== 'object') {
    return undefined;
  }
  
  const obj = response as Record<string, unknown>;
  
  // Direct {actions: {...}} pattern
  if ('actions' in obj && obj.actions !== null && typeof obj.actions === 'object') {
    return obj.actions as T;
  }
  
  // Unwrap envelope and try again
  const unwrapped = unwrapApiEnvelope(response);
  if (unwrapped !== response && typeof unwrapped === 'object' && unwrapped !== null) {
    const unwrappedObj = unwrapped as Record<string, unknown>;
    if ('actions' in unwrappedObj && unwrappedObj.actions !== null && typeof unwrappedObj.actions === 'object') {
      return unwrappedObj.actions as T;
    }
  }
  
  return undefined;
}
