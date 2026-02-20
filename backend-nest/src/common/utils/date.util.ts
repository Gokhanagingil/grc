/**
 * Safe date normalization utilities
 *
 * These utilities handle legacy data where date fields may be stored as
 * strings, numbers, or Date objects. They provide safe conversion without
 * throwing errors on invalid data.
 */

/**
 * Safely converts an unknown value to a Date object.
 * Returns null if the value cannot be converted to a valid date.
 *
 * @param value - The value to convert (Date | string | number | null | undefined)
 * @returns A valid Date object or null
 */
export function safeToDate(
  value: Date | string | number | null | undefined,
): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Safely converts an unknown value to an ISO 8601 string.
 * Returns null if the value cannot be converted to a valid date.
 *
 * @param value - The value to convert (Date | string | number | null | undefined)
 * @returns An ISO 8601 string or null
 */
export function safeToIso(
  value: Date | string | number | null | undefined,
): string | null {
  const date = safeToDate(value);
  return date ? date.toISOString() : null;
}
