/**
 * Normalization Utilities
 * 
 * Centralized utility functions for normalizing incoming request data.
 * These functions are used by NormalizationPipe to transform data before validation.
 */

import { BadRequestException } from '@nestjs/common';

/**
 * UUID validation regex (RFC 4122)
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Normalize empty string to undefined
 * Also handles null and whitespace-only strings
 */
export function normalizeEmpty(value: any): any {
  if (value === '' || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}

/**
 * Normalize UUID field
 * - Empty string/null → undefined
 * - Valid UUID → return as-is
 * - Invalid UUID → throw BadRequestException
 */
export function normalizeUUID(value: any, fieldName?: string): string | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  const str = String(value).trim();
  if (str === '') {
    return undefined;
  }

  if (!UUID_REGEX.test(str)) {
    const field = fieldName ? `Field '${fieldName}'` : 'UUID field';
    throw new BadRequestException(
      `${field} must be a valid UUID format. Received: ${str}`,
    );
  }

  return str;
}

/**
 * Normalize array field
 * Accepts both comma-separated string and array
 * Output is always string[]
 */
export function normalizeArray(value: any, fieldName?: string): string[] | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  // Already an array
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item !== '');
  }

  // Comma-separated string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return undefined;
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '');
  }

  // Single value - convert to array
  return [String(value).trim()].filter((item) => item !== '');
}

/**
 * Normalize boolean field
 * Accepts: "true" | "1" | 1 → true
 *          "false" | "0" | 0 → false
 *          true/false → as-is
 */
export function normalizeBoolean(value: any): boolean | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') {
      return false;
    }
    // Invalid boolean string - return undefined to let validation handle it
    return undefined;
  }

  return undefined;
}

/**
 * Normalize date field
 * Accepts: ISO strings, date strings (various formats), timestamps
 * Output: ISO string
 */
export function normalizeDate(value: any, fieldName?: string): string | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  // Already a Date object
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      const field = fieldName ? `Field '${fieldName}'` : 'Date field';
      throw new BadRequestException(`${field} contains an invalid date.`);
    }
    return value.toISOString();
  }

  // Timestamp (number)
  if (typeof value === 'number') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      const field = fieldName ? `Field '${fieldName}'` : 'Date field';
      throw new BadRequestException(`${field} contains an invalid timestamp.`);
    }
    return date.toISOString();
  }

  // String - try to parse
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return undefined;
    }

    // Try ISO format first
    let date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // Try common formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, // M/D/YYYY
    ];

    for (const format of formats) {
      const match = trimmed.match(format);
      if (match && match[1] && match[2] && match[3]) {
        let year: number, month: number, day: number;

        if (format.source.includes('YYYY')) {
          // YYYY-MM-DD format
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10) - 1; // Month is 0-indexed
          day = parseInt(match[3], 10);
        } else {
          // MM/DD/YYYY or DD/MM/YYYY - assume MM/DD/YYYY (US format)
          month = parseInt(match[1], 10) - 1;
          day = parseInt(match[2], 10);
          year = parseInt(match[3], 10);
        }

        date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }

    // If we get here, couldn't parse
    const field = fieldName ? `Field '${fieldName}'` : 'Date field';
    throw new BadRequestException(
      `${field} must be a valid date. Accepted formats: ISO string (YYYY-MM-DD), MM/DD/YYYY, or timestamp. Received: ${trimmed}`,
    );
  }

  return undefined;
}

/**
 * Deep normalization for nested objects
 * Recursively applies normalization to all properties
 */
export function normalizeDeep(value: any, metadata?: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Primitive types - normalize empty strings
  if (typeof value !== 'object') {
    return normalizeEmpty(value);
  }

  // Date objects - convert to ISO string
  if (value instanceof Date) {
    return normalizeDate(value);
  }

  // Arrays - normalize each element
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDeep(item));
  }

    // Objects - normalize each property
    if (typeof value === 'object') {
      const normalized: any = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const normalizedValue = normalizeDeep(value[key]);
          // Include all values, even undefined (for explicit null handling)
          normalized[key] = normalizedValue;
        }
      }
      return normalized;
    }

  return value;
}

/**
 * Check if a value looks like a UUID (for automatic detection)
 */
export function looksLikeUUID(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return UUID_REGEX.test(value.trim());
}

