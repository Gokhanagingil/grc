import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

/**
 * UUID format regex pattern
 * Accepts any UUID-formatted string (8-4-4-4-12 hex pattern)
 * This is more permissive than RFC 4122 to support demo/seed UUIDs
 * that don't have valid version/variant bits (e.g., 00000000-0000-0000-0000-000000000100)
 */
const UUID_FORMAT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Custom UUID validation pipe that accepts any UUID-formatted string
 *
 * Unlike NestJS's built-in ParseUUIDPipe (which defaults to v4 validation),
 * this pipe accepts any string matching the UUID format (8-4-4-4-12 hex pattern)
 * regardless of version/variant bits.
 *
 * This is necessary because:
 * 1. Demo/seed data uses UUIDs like 00000000-0000-0000-0000-000000000100
 * 2. These UUIDs don't conform to RFC 4122 (version nibble is 0, not 1-5)
 * 3. The built-in ParseUUIDPipe rejects them as invalid
 *
 * Usage:
 *   @Param('id', UuidFormatPipe) id: string
 */
@Injectable()
export class UuidFormatPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!UUID_FORMAT_PATTERN.test(value)) {
      const paramName = metadata.data || 'value';
      throw new BadRequestException(
        `Validation failed (${paramName} must be a valid UUID format)`,
      );
    }
    return value;
  }
}
