/**
 * NormalizationPipe
 * 
 * Global pipe that normalizes incoming request data BEFORE validation.
 * 
 * This pipe:
 * 1. Converts empty strings to undefined
 * 2. Normalizes UUID fields
 * 3. Normalizes arrays (comma-separated strings → arrays)
 * 4. Normalizes booleans (string "true"/"1" → boolean true)
 * 5. Normalizes dates (various formats → ISO strings)
 * 6. Deeply normalizes nested objects
 * 
 * Usage:
 * - Applied globally in main.ts BEFORE ValidationPipe
 * - Automatically processes all DTOs
 * - No need for manual @Transform() decorators in DTOs
 */

import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  Type,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  normalizeEmpty,
  normalizeUUID,
  normalizeArray,
  normalizeBoolean,
  normalizeDate,
  normalizeDeep,
  looksLikeUUID,
} from './normalization.utils';

@Injectable()
export class NormalizationPipe implements PipeTransform<any> {
  /**
   * Transform incoming value
   */
  transform(value: any, { metatype, data }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Convert plain object to class instance (for metadata access)
    const object = plainToInstance(metatype, value);
    
    // Deep normalize the entire object
    const normalized = this.normalizeObject(object, metatype);

    return normalized;
  }

  /**
   * Check if type should be validated
   */
  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * Normalize an object based on its metadata
   */
  private normalizeObject(obj: any, metatype: Type<any>): any {
    if (!obj || typeof obj !== 'object') {
      return normalizeEmpty(obj);
    }

    // Arrays - normalize each element
    if (Array.isArray(obj)) {
      return obj.map((item) => this.normalizeObject(item, metatype));
    }

    // Date objects - convert to ISO string
    if (obj instanceof Date) {
      return normalizeDate(obj);
    }

    // Use metadata-based normalization with heuristics fallback
    return this.normalizeObjectProperties(obj, metatype);
  }

  /**
   * Normalize object properties using heuristics
   * Note: Metadata-based detection can be added in future if needed
   * Current heuristics work well for common patterns (id fields, date fields, etc.)
   */
  private normalizeObjectProperties(obj: any, metatype?: Type<any>): any {
    const normalized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        normalized[key] = this.normalizeProperty(obj[key], key);
      }
    }
    return normalized;
  }

  /**
   * Normalize a single property using heuristics
   * Heuristics detect:
   * - UUID fields: property names containing 'id', 'uuid', ending with '_id'
   * - Boolean fields: property names starting with 'is_', 'has_', 'can_', or containing 'enabled', 'active', 'locked'
   * - Date fields: property names containing 'date', 'time', 'at', or ending with '_at'
   * - Array fields: detected by value type (array or comma-separated string)
   */
  private normalizeProperty(value: any, propertyName: string): any {
    // First, normalize empty strings
    const emptyNormalized = normalizeEmpty(value);
    if (emptyNormalized === undefined) {
      return undefined;
    }

    // Heuristic: Check property name for common UUID patterns
    const lowerName = propertyName.toLowerCase();
    const isUUIDField =
      lowerName.includes('id') &&
      (lowerName.includes('uuid') ||
        lowerName.endsWith('_id') ||
        lowerName.endsWith('id'));

    // Heuristic: Check if value looks like UUID
    if (isUUIDField && typeof emptyNormalized === 'string') {
      if (looksLikeUUID(emptyNormalized)) {
        try {
          return normalizeUUID(emptyNormalized, propertyName);
        } catch {
          // If invalid UUID, return as-is and let validation handle it
          return emptyNormalized;
        }
      }
      // If it's an ID field but not a valid UUID, try to normalize anyway
      // (might be a non-UUID ID format)
      try {
        return normalizeUUID(emptyNormalized, propertyName);
      } catch {
        // Not a UUID - return as-is
        return emptyNormalized;
      }
    }

    // Arrays - normalize comma-separated strings
    if (Array.isArray(emptyNormalized)) {
      return normalizeArray(emptyNormalized, propertyName);
    }
    
    // If it's a string that might be comma-separated array, try to convert
    // This handles cases where frontend sends "a,b,c" instead of ["a","b","c"]
    if (typeof emptyNormalized === 'string' && emptyNormalized.includes(',')) {
      const arrayNormalized = normalizeArray(emptyNormalized, propertyName);
      if (arrayNormalized !== undefined && arrayNormalized.length > 0) {
        return arrayNormalized;
      }
    }

    // Boolean heuristics
    const isBooleanField =
      lowerName.startsWith('is_') ||
      lowerName.startsWith('has_') ||
      lowerName.startsWith('can_') ||
      lowerName.includes('enabled') ||
      lowerName.includes('active') ||
      lowerName.includes('locked');
    if (isBooleanField && typeof emptyNormalized !== 'boolean') {
      const boolNormalized = normalizeBoolean(emptyNormalized);
      if (boolNormalized !== undefined) {
        return boolNormalized;
      }
    }

    // Date heuristics
    const isDateField =
      lowerName.includes('date') ||
      lowerName.includes('time') ||
      lowerName.includes('at') ||
      lowerName.endsWith('_at');
    if (isDateField && typeof emptyNormalized === 'string') {
      try {
        return normalizeDate(emptyNormalized, propertyName);
      } catch {
        // If can't parse, return as-is and let validation handle it
        return emptyNormalized;
      }
    }

    // Recursive normalization for nested objects
    if (typeof emptyNormalized === 'object' && emptyNormalized !== null && !Array.isArray(emptyNormalized)) {
      return this.normalizeObject(emptyNormalized, Object);
    }

    return emptyNormalized;
  }
}

