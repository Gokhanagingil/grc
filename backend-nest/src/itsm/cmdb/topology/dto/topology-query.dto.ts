import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  IsString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum TopologyDirection {
  BOTH = 'both',
  UPSTREAM = 'upstream',
  DOWNSTREAM = 'downstream',
}

/**
 * Query parameters for topology endpoints.
 * Controls traversal depth, direction, and filtering.
 */
export class TopologyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  depth?: number = 1;

  @IsOptional()
  @IsString()
  relationTypes?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return false;
  })
  @IsBoolean()
  includeOrphans?: boolean = false;

  @IsOptional()
  @IsEnum(TopologyDirection)
  direction?: TopologyDirection = TopologyDirection.BOTH;

  /**
   * Include class lineage on nodes and relationship semantics on edges.
   * Default: false (opt-in for backward compatibility).
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return false;
  })
  @IsBoolean()
  includeSemantics?: boolean = false;

  /**
   * Parse relationTypes from comma-separated string to array.
   */
  get relationTypesList(): string[] | undefined {
    if (!this.relationTypes) return undefined;
    return this.relationTypes
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
}
