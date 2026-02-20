import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsObject,
  MaxLength,
  IsArray,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CapaType, CapaStatus, CAPAPriority, SourceType } from '../enums';

/**
 * Transform to normalize enum values to uppercase.
 * Accepts lowercase, uppercase, or mixed case input and converts to uppercase.
 * Used for enums like CAPAPriority where DB expects uppercase values.
 */
const UppercaseEnumTransform = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

/**
 * Transform to normalize optional UUID fields.
 * Converts empty string, null, "undefined", "null" to undefined BEFORE validation.
 * This allows the field to pass @IsOptional() validation when these values are sent.
 */
const OptionalUuidTransform = () =>
  Transform(({ value }: { value: unknown }) => {
    if (
      value === '' ||
      value === null ||
      value === undefined ||
      value === 'undefined' ||
      value === 'null'
    ) {
      return undefined;
    }
    return value;
  });

/**
 * DTO for creating a new CAPA record
 */
export class CreateCapaDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @OptionalUuidTransform()
  @IsUUID('all')
  issueId?: string;

  @IsOptional()
  @IsEnum(CapaType)
  type?: CapaType;

  @IsOptional()
  @IsEnum(CapaStatus)
  status?: CapaStatus;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(CAPAPriority)
  priority?: CAPAPriority;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  rootCauseAnalysis?: string;

  @IsOptional()
  @IsString()
  actionPlan?: string;

  @IsOptional()
  @IsString()
  implementationNotes?: string;

  @IsOptional()
  @IsString()
  verificationMethod?: string;

  @IsOptional()
  @IsString()
  verificationNotes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(SourceType)
  sourceType?: SourceType;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceRef?: string;

  @IsOptional()
  @IsObject()
  sourceMeta?: Record<string, unknown>;
}

/**
 * DTO for updating an existing CAPA record
 */
export class UpdateCapaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CapaType)
  type?: CapaType;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(CAPAPriority)
  priority?: CAPAPriority;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  completedDate?: string;

  @IsOptional()
  @IsString()
  rootCauseAnalysis?: string;

  @IsOptional()
  @IsString()
  actionPlan?: string;

  @IsOptional()
  @IsString()
  implementationNotes?: string;

  @IsOptional()
  @IsString()
  verificationMethod?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  verificationEvidenceIds?: string[];

  @IsOptional()
  @IsString()
  verificationNotes?: string;

  @IsOptional()
  @IsString()
  closureNotes?: string;

  @IsOptional()
  @IsString()
  effectiveness?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering CAPA list queries
 *
 * Supports both legacy individual filters and the new unified filter tree format.
 * The filter param accepts a JSON string representing a filter tree with AND/OR groups.
 */
export class CapaFilterDto {
  @IsOptional()
  @IsEnum(CapaStatus)
  status?: CapaStatus;

  @IsOptional()
  @IsEnum(CapaType)
  type?: CapaType;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(CAPAPriority)
  priority?: CAPAPriority;

  @IsOptional()
  @IsUUID()
  issueId?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+:(ASC|DESC|asc|desc)$/, {
    message: 'sort must be in format "field:ASC" or "field:DESC"',
  })
  sort?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  /**
   * Advanced filter tree in JSON format.
   * Supports AND/OR groups with conditions.
   * Example: {"and":[{"field":"status","op":"is","value":"planned"}]}
   */
  @IsOptional()
  @IsString()
  filter?: string;
}

/**
 * DTO for creating a CAPA from an SOA Item
 * Used by POST /grc/soa/items/:itemId/capas
 *
 * This endpoint creates an Issue first (if not provided),
 * then creates a CAPA linked to that Issue,
 * and sets source fields to track origin from SOA item.
 */
export class CreateCapaFromSoaItemDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CapaType)
  type?: CapaType;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(CAPAPriority)
  priority?: CAPAPriority;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  rootCauseAnalysis?: string;

  @IsOptional()
  @IsString()
  actionPlan?: string;

  @IsOptional()
  @IsUUID()
  issueId?: string;
}

/**
 * DTO for creating a CAPA linked to an Issue via POST /grc/issues/:issueId/capas
 * This is a dedicated DTO that ensures proper validation and transforms are applied.
 * The issueId is provided via the URL path parameter, not the body.
 */
export class CreateCapaForIssueDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CapaType)
  type?: CapaType;

  @IsOptional()
  @IsEnum(CapaStatus)
  status?: CapaStatus;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(CAPAPriority)
  priority?: CAPAPriority;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  rootCauseAnalysis?: string;

  @IsOptional()
  @IsString()
  actionPlan?: string;

  @IsOptional()
  @IsString()
  implementationNotes?: string;

  @IsOptional()
  @IsString()
  verificationMethod?: string;

  @IsOptional()
  @IsString()
  verificationNotes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
