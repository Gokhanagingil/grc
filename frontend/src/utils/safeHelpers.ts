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
