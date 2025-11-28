import { ApiProperty } from '@nestjs/swagger';

/**
 * Standardized paginated list response DTO
 * All list endpoints should return this structure
 */
export class PagedListDto<T> {
  @ApiProperty({
    description: 'Array of items',
    type: 'array',
    isArray: true,
  })
  items!: T[];

  @ApiProperty({
    description: 'Total number of items (across all pages)',
    type: 'number',
    example: 0,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number (1-based)',
    type: 'number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    type: 'number',
    example: 20,
  })
  pageSize!: number;
}

