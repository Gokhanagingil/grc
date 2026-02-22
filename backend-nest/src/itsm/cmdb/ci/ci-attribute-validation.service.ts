import { Injectable, BadRequestException } from '@nestjs/common';
import { CiClassInheritanceService } from '../ci-class/ci-class-inheritance.service';
import { EffectiveFieldDefinition } from '../ci-class/ci-class.entity';

/**
 * A single field-level validation error.
 */
export interface AttributeValidationError {
  /** Field key that failed validation */
  field: string;
  /** Human-readable error message */
  message: string;
  /** Error code for programmatic handling */
  code:
    | 'REQUIRED'
    | 'INVALID_TYPE'
    | 'INVALID_ENUM'
    | 'MAX_LENGTH_EXCEEDED'
    | 'READ_ONLY';
}

/**
 * Result of attribute validation against the effective schema.
 */
export interface AttributeValidationResult {
  valid: boolean;
  errors: AttributeValidationError[];
}

/**
 * Validates CI attributes against the effective schema of a CI class.
 * This service is the authoritative backend validator; frontend validation is UX-only.
 */
@Injectable()
export class CiAttributeValidationService {
  constructor(private readonly inheritanceService: CiClassInheritanceService) {}

  /**
   * Validate attributes against the effective schema of a class.
   * If the class has no effective schema (no fields defined), all attributes pass.
   *
   * @param tenantId - Tenant ID
   * @param classId - CI class ID to validate against
   * @param attributes - The attributes object to validate (from CI.attributes JSONB)
   * @param isUpdate - If true, skip required-field checks for missing keys (partial update)
   * @returns Validation result with field-level errors
   */
  async validateAttributes(
    tenantId: string,
    classId: string,
    attributes: Record<string, unknown> | null | undefined,
    isUpdate = false,
  ): Promise<AttributeValidationResult> {
    const errors: AttributeValidationError[] = [];

    // Fetch effective schema
    let effectiveFields: EffectiveFieldDefinition[];
    try {
      const schema = await this.inheritanceService.getEffectiveSchema(
        tenantId,
        classId,
      );
      effectiveFields = schema.effectiveFields;
    } catch {
      // If class not found or schema can't be computed, skip validation
      // (backward compat: classes without schema pass through)
      return { valid: true, errors: [] };
    }

    // If no fields defined, everything passes
    if (effectiveFields.length === 0) {
      return { valid: true, errors: [] };
    }

    const attrs = attributes ?? {};

    for (const field of effectiveFields) {
      const value = attrs[field.key];
      const hasValue = value !== undefined && value !== null && value !== '';

      // Required check (only on create or when the field key is present in update)
      if (field.required && !isUpdate && !hasValue) {
        errors.push({
          field: field.key,
          message: `${field.label} is required`,
          code: 'REQUIRED',
        });
        continue;
      }

      // If no value provided, skip further validation
      if (!hasValue) {
        continue;
      }

      // Type validation
      const typeError = this.validateFieldType(field, value);
      if (typeError) {
        errors.push(typeError);
        continue;
      }

      // Enum validation
      if (
        field.dataType === 'enum' &&
        field.choices &&
        field.choices.length > 0
      ) {
        if (
          !field.choices.includes(
            typeof value === 'string' ? value : JSON.stringify(value),
          )
        ) {
          errors.push({
            field: field.key,
            message: `${field.label} must be one of: ${field.choices.join(', ')}`,
            code: 'INVALID_ENUM',
          });
        }
      }

      // MaxLength validation for string/text
      if (
        (field.dataType === 'string' || field.dataType === 'text') &&
        field.maxLength &&
        typeof value === 'string' &&
        value.length > field.maxLength
      ) {
        errors.push({
          field: field.key,
          message: `${field.label} must be at most ${field.maxLength} characters`,
          code: 'MAX_LENGTH_EXCEEDED',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate and throw if attributes are invalid.
   * Convenience method for use in CI create/update flows.
   */
  async validateAndThrow(
    tenantId: string,
    classId: string,
    attributes: Record<string, unknown> | null | undefined,
    isUpdate = false,
  ): Promise<void> {
    const result = await this.validateAttributes(
      tenantId,
      classId,
      attributes,
      isUpdate,
    );

    if (!result.valid) {
      const messages = result.errors
        .map((e) => `${e.field}: ${e.message}`)
        .join('; ');
      throw new BadRequestException({
        message: `Attribute validation failed: ${messages}`,
        validationErrors: result.errors,
      });
    }
  }

  /**
   * Validate a single field's value against its expected data type.
   */
  private validateFieldType(
    field: EffectiveFieldDefinition,
    value: unknown,
  ): AttributeValidationError | null {
    switch (field.dataType) {
      case 'string':
      case 'text':
        if (typeof value !== 'string') {
          return {
            field: field.key,
            message: `${field.label} must be a string`,
            code: 'INVALID_TYPE',
          };
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            field: field.key,
            message: `${field.label} must be a number`,
            code: 'INVALID_TYPE',
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            field: field.key,
            message: `${field.label} must be a boolean`,
            code: 'INVALID_TYPE',
          };
        }
        break;

      case 'date':
        if (typeof value !== 'string' || isNaN(Date.parse(value))) {
          return {
            field: field.key,
            message: `${field.label} must be a valid date string`,
            code: 'INVALID_TYPE',
          };
        }
        break;

      case 'enum':
        if (typeof value !== 'string') {
          return {
            field: field.key,
            message: `${field.label} must be a string`,
            code: 'INVALID_TYPE',
          };
        }
        break;

      case 'json':
        if (typeof value !== 'object') {
          return {
            field: field.key,
            message: `${field.label} must be an object`,
            code: 'INVALID_TYPE',
          };
        }
        break;

      case 'reference':
        if (typeof value !== 'string') {
          return {
            field: field.key,
            message: `${field.label} must be a string (reference ID)`,
            code: 'INVALID_TYPE',
          };
        }
        break;
    }

    return null;
  }
}
