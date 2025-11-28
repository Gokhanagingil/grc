import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumberString,
  IsString,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

export class PaginationDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (1-based, but 0 is also accepted for 0-based indexing)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Page size (max 1000, default 20)',
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;

  @ApiPropertyOptional({
    example: '-updated_at,name',
    description: 'Sort fields (prefix with - for DESC)',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    example: 'code,name,category',
    description: 'Comma-separated field names to include',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}

export function parsePagination(dto: PaginationDto | { page?: string | number; pageSize?: string | number }) {
  // Handle both string and number types for backward compatibility
  // Support both 0-based (page=0) and 1-based (page=1) indexing
  const pageNum = typeof dto.page === 'string' ? parseInt(dto.page || '1', 10) : (dto.page ?? 1);
  const pageSizeNum = typeof dto.pageSize === 'string' ? parseInt(dto.pageSize || '20', 10) : (dto.pageSize || 20);

  // If page is 0, treat as page 1 (0-based to 1-based conversion)
  // If page is >= 1, use as-is (1-based)
  const page = pageNum === 0 ? 1 : Math.max(pageNum, 1);
  let pageSize = pageSizeNum;

  // Enforce max limit
  if (pageSize > 1000) {
    throw new BadRequestException('Page size cannot exceed 1000');
  }

  // Default limit
  if (pageSize < 1) {
    pageSize = 20;
  }

  // Cap at 1000
  pageSize = Math.min(pageSize, 1000);

  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}

export function parseSort(sort?: string): Record<string, 'ASC' | 'DESC'> {
  if (!sort) return {};

  const order: Record<string, 'ASC' | 'DESC'> = {};
  const parts = sort.split(',').map((s) => s.trim());

  for (const part of parts) {
    if (part.startsWith('-')) {
      order[part.substring(1)] = 'DESC';
    } else {
      order[part] = 'ASC';
    }
  }

  return order;
}

export function parseFields(fields?: string): string[] | null {
  if (!fields) return null;
  return fields
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
}
