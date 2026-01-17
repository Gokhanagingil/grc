/**
 * Export Controller
 *
 * Provides CSV export functionality for GRC entities.
 * Supports filtering, sorting, and field selection with allowlist validation.
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
import { Permissions } from '../../auth/permissions/permissions.decorator';
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

const MAX_EXPORT_ROWS = 10000;

const ENTITY_MAP: Record<string, { entity: new () => unknown; table: string }> =
  {
    issues: { entity: GrcIssue, table: 'grc_issues' },
    issue: { entity: GrcIssue, table: 'grc_issues' },
    capas: { entity: GrcCapa, table: 'grc_capas' },
    capa: { entity: GrcCapa, table: 'grc_capas' },
    evidence: { entity: GrcEvidence, table: 'grc_evidence' },
  };

const ENTITY_PERMISSIONS: Record<string, Permission> = {
  issues: Permission.GRC_ISSUE_READ,
  issue: Permission.GRC_ISSUE_READ,
  capas: Permission.GRC_CAPA_READ,
  capa: Permission.GRC_CAPA_READ,
  evidence: Permission.GRC_EVIDENCE_READ,
};

interface ExportQueryDto {
  q?: string;
  sort?: string;
  filter?: string;
  columns?: string;
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
    enum: ['issues', 'capas', 'evidence'],
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
    @Param('entity') entity: string,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const entityLower = entity.toLowerCase();
    const entityConfig = ENTITY_MAP[entityLower];
    if (!entityConfig) {
      throw new BadRequestException(
        `Invalid entity: ${entity}. Supported entities: issues, capas, evidence`,
      );
    }

    if (!hasEntityAllowlist(entityLower)) {
      throw new BadRequestException(`Entity ${entity} does not support export`);
    }

    const allowlist = getEntityAllowlist(entityLower);
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
    const filename = `${entityLower}-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  }

  @Get(':entity/permissions')
  @ApiOperation({
    summary: 'Check export permissions for entity',
    description:
      'Returns the required permission for exporting the specified entity',
  })
  @Perf()
  getExportPermission(
    @Headers('x-tenant-id') tenantId: string,
    @Param('entity') entity: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const entityLower = entity.toLowerCase();
    const permission = ENTITY_PERMISSIONS[entityLower];

    if (!permission) {
      throw new BadRequestException(
        `Invalid entity: ${entity}. Supported entities: issues, capas, evidence`,
      );
    }

    return {
      success: true,
      data: {
        entity: entityLower,
        requiredPermission: permission,
      },
    };
  }
}
