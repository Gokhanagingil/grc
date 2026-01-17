/**
 * Export Controller
 *
 * Provides CSV export functionality for GRC entities.
 * Supports filtering, sorting, and field selection with allowlist validation.
 *
 * Security measures:
 * - ExportEntity enum with ParseEnumPipe for input validation
 * - EXPORT_ENTITY_MAP allowlist for safe filename generation
 * - Defensive filename sanitization to prevent XSS/header injection
 * - X-Content-Type-Options: nosniff header
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
  Res,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permission } from '../../auth/permissions/permission.enum';
import { DataSource } from 'typeorm';
import { GrcIssue } from '../entities/grc-issue.entity';
import { GrcCapa } from '../entities/grc-capa.entity';
import { GrcEvidence } from '../entities/grc-evidence.entity';
import { Perf } from '../../common/decorators';
import {
  getEntityAllowlist,
  hasEntityAllowlist,
} from '../../common/list-query/list-query.allowlist';
import { parseFilterJson } from '../../common/list-query/list-query.parser';
import { applyFilterTree } from '../../common/list-query/list-query.apply';
import { ExportEntity } from '../enums';

const MAX_EXPORT_ROWS = 10000;

/**
 * EXPORT_ENTITY_MAP - Hardcoded allowlist mapping enum values to entity configurations
 * The safeName property is used for filename generation to prevent XSS attacks
 */
export const EXPORT_ENTITY_MAP: Record<
  ExportEntity,
  { entity: new () => unknown; table: string; safeName: string }
> = {
  [ExportEntity.ISSUES]: {
    entity: GrcIssue,
    table: 'grc_issues',
    safeName: 'issues',
  },
  [ExportEntity.ISSUE]: {
    entity: GrcIssue,
    table: 'grc_issues',
    safeName: 'issues',
  },
  [ExportEntity.CAPAS]: {
    entity: GrcCapa,
    table: 'grc_capas',
    safeName: 'capas',
  },
  [ExportEntity.CAPA]: {
    entity: GrcCapa,
    table: 'grc_capas',
    safeName: 'capas',
  },
  [ExportEntity.EVIDENCE]: {
    entity: GrcEvidence,
    table: 'grc_evidence',
    safeName: 'evidence',
  },
};

const ENTITY_PERMISSIONS: Record<ExportEntity, Permission> = {
  [ExportEntity.ISSUES]: Permission.GRC_ISSUE_READ,
  [ExportEntity.ISSUE]: Permission.GRC_ISSUE_READ,
  [ExportEntity.CAPAS]: Permission.GRC_CAPA_READ,
  [ExportEntity.CAPA]: Permission.GRC_CAPA_READ,
  [ExportEntity.EVIDENCE]: Permission.GRC_EVIDENCE_READ,
};

interface ExportQueryDto {
  q?: string;
  sort?: string;
  filter?: string;
  columns?: string;
}

/**
 * Sanitize filename to prevent header injection and XSS attacks
 * - Strips dangerous characters: " \ \r \n
 * - Validates against safe pattern: /^[a-z0-9_-]+\.csv$/i
 * - Falls back to 'export.csv' if validation fails
 */
export function sanitizeFilename(filename: string): string {
  // Strip dangerous characters: " \ \r \n
  // Using explicit character codes to avoid regex escape issues
  const sanitized = filename
    .replace(/"/g, '') // Remove double quotes
    .replace(/\\/g, '') // Remove backslashes
    .replace(/\r/g, '') // Remove carriage returns
    .replace(/\n/g, ''); // Remove newlines

  // Validate against safe pattern
  const safePattern = /^[a-z0-9_-]+\.csv$/i;
  if (!safePattern.test(sanitized)) {
    return 'export.csv';
  }

  return sanitized;
}

function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : value instanceof Date
          ? value.toISOString()
          : JSON.stringify(value);
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDateForCSV(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    return value;
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    return String(value);
  }
  return '';
}

@ApiTags('GRC Export')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/export')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ExportController {
  constructor(private readonly dataSource: DataSource) {}

  @Get(':entity')
  @ApiOperation({
    summary: 'Export entity data as CSV',
    description: `Exports entity data as CSV file. Supports filtering, sorting, and column selection.
    Maximum ${MAX_EXPORT_ROWS} rows per export. Supported entities: issues, capas, evidence.`,
  })
  @ApiParam({
    name: 'entity',
    description: 'Entity to export (issues, capas, evidence)',
    enum: ExportEntity,
  })
  @ApiQuery({ name: 'q', required: false, description: 'Quick search query' })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Sort field:direction (e.g., createdAt:DESC)',
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'JSON filter tree',
  })
  @ApiQuery({
    name: 'columns',
    required: false,
    description: 'Comma-separated list of columns to export',
  })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Invalid entity or parameters' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Perf()
  async exportEntity(
    @Headers('x-tenant-id') tenantId: string,
    @Param('entity', new ParseEnumPipe(ExportEntity)) entity: ExportEntity,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Get entity config from hardcoded allowlist map
    const entityConfig = EXPORT_ENTITY_MAP[entity];

    // Validate entity has an allowlist configured
    if (!hasEntityAllowlist(entity)) {
      throw new BadRequestException(`Entity ${entity} does not support export`);
    }

    const allowlist = getEntityAllowlist(entity);
    if (!allowlist) {
      throw new BadRequestException(
        `Entity ${entity} does not have an allowlist configured`,
      );
    }

    const allowedFields = allowlist.fields.map((f) => f.name);
    let exportColumns = allowedFields;

    if (query.columns) {
      const requestedColumns = query.columns.split(',').map((c) => c.trim());
      const invalidColumns = requestedColumns.filter(
        (c) => !allowedFields.includes(c),
      );
      if (invalidColumns.length > 0) {
        throw new BadRequestException(
          `Invalid columns: ${invalidColumns.join(', ')}. Allowed columns: ${allowedFields.join(', ')}`,
        );
      }
      exportColumns = requestedColumns;
    }

    const repo = this.dataSource.getRepository(entityConfig.entity);
    const qb = repo.createQueryBuilder('e');

    qb.where('e.tenantId = :tenantId', { tenantId });
    qb.andWhere('e.isDeleted = :isDeleted', { isDeleted: false });

    if (query.q) {
      const searchableFields = allowlist.fields
        .filter((f) => f.type === 'string')
        .map((f) => f.column || f.name);

      if (searchableFields.length > 0) {
        const searchConditions = searchableFields
          .map((field) => `e.${field} ILIKE :searchTerm`)
          .join(' OR ');
        qb.andWhere(`(${searchConditions})`, { searchTerm: `%${query.q}%` });
      }
    }

    if (query.filter) {
      try {
        const parsed = parseFilterJson(query.filter);
        applyFilterTree(qb, parsed.tree, allowlist, 'e');
      } catch (err) {
        throw new BadRequestException(
          `Invalid filter: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (query.sort) {
      const [field, direction] = query.sort.split(':');
      const sortField = allowlist.fields.find((f) => f.name === field);
      if (sortField) {
        const column = sortField.column || sortField.name;
        const sortDir = direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        qb.orderBy(`e.${column}`, sortDir);
      }
    } else {
      qb.orderBy('e.created_at', 'DESC');
    }

    qb.take(MAX_EXPORT_ROWS);

    const items = await qb.getMany();

    const fieldToColumn: Record<string, string> = {};
    for (const field of allowlist.fields) {
      fieldToColumn[field.name] = field.column || field.name;
    }

    const dateFields = allowlist.fields
      .filter((f) => f.type === 'date')
      .map((f) => f.name);

    const headerRow = exportColumns.join(',');
    const dataRows = items.map((item) => {
      const record = item as Record<string, unknown>;
      return exportColumns
        .map((col) => {
          const dbCol = fieldToColumn[col] || col;
          const camelCol = dbCol.replace(
            /_([a-z])/g,
            (_: string, letter: string) => letter.toUpperCase(),
          );
          let value = record[camelCol] ?? record[dbCol] ?? record[col];

          if (dateFields.includes(col)) {
            value = formatDateForCSV(value);
          }

          return escapeCSVField(value);
        })
        .join(',');
    });

    const csvContent = [headerRow, ...dataRows].join('\n');

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 16);

    // Build filename ONLY from hardcoded allowlist map safeName, not from entity directly
    const rawFilename = `${entityConfig.safeName}-${timestamp}.csv`;
    // Apply defensive sanitization
    const filename = sanitizeFilename(rawFilename);

    // Set security headers
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Use res.end() instead of res.send() for security
    res.end(csvContent);
  }

  @Get(':entity/permissions')
  @ApiOperation({
    summary: 'Check export permissions for entity',
    description:
      'Returns the required permission for exporting the specified entity',
  })
  @ApiParam({
    name: 'entity',
    description: 'Entity to check permissions for',
    enum: ExportEntity,
  })
  @Perf()
  getExportPermission(
    @Headers('x-tenant-id') tenantId: string,
    @Param('entity', new ParseEnumPipe(ExportEntity)) entity: ExportEntity,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const permission = ENTITY_PERMISSIONS[entity];

    return {
      success: true,
      data: {
        entity: entity,
        requiredPermission: permission,
      },
    };
  }
}
