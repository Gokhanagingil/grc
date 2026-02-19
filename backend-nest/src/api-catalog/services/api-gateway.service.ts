import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  SysPublishedApi,
  FilterPolicy,
} from '../entities/sys-published-api.entity';
import { SysApiAuditLog } from '../entities/sys-api-audit-log.entity';
import { StructuredLoggerService } from '../../common/logger';

const SANITIZE_REGEX = /[^a-zA-Z0-9_]/g;

@Injectable()
export class ApiGatewayService {
  private readonly logger: StructuredLoggerService;
  private readonly rateLimitMap = new Map<
    string,
    { count: number; windowStart: number }
  >();

  constructor(
    @InjectRepository(SysApiAuditLog)
    private readonly auditLogRepository: Repository<SysApiAuditLog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('ApiGatewayService');
  }

  checkRateLimit(apiId: string, limitPerMinute: number): boolean {
    const now = Date.now();
    const windowMs = 60000;
    const key = apiId;

    const entry = this.rateLimitMap.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      this.rateLimitMap.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= limitPerMinute) {
      return false;
    }

    entry.count++;
    return true;
  }

  async listRecords(
    api: SysPublishedApi,
    query: { page?: number; pageSize?: number; sort?: string; order?: string },
  ): Promise<{ items: Record<string, unknown>[]; total: number }> {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 50, 100);
    const readFields = api.allowedFields.read;

    if (readFields.length === 0) {
      return { items: [], total: 0 };
    }

    const sanitizedFields = readFields.map((f) =>
      f.replace(SANITIZE_REGEX, ''),
    );

    const qb = this.dataSource
      .createQueryBuilder()
      .select(sanitizedFields.map((f) => `t.${f}`))
      .from(api.tableName, 't')
      .where('t.tenant_id = :tenantId', { tenantId: api.tenantId });

    this.applyFilterPolicy(qb, api.filterPolicy);

    if (query.sort) {
      const sanitizedSort = query.sort.replace(SANITIZE_REGEX, '');
      if (sanitizedFields.includes(sanitizedSort)) {
        const order = query.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        qb.orderBy(`t.${sanitizedSort}`, order);
      }
    } else {
      qb.orderBy('t.created_at', 'DESC');
    }

    const total = await qb.getCount();
    qb.offset((page - 1) * pageSize);
    qb.limit(pageSize);

    const rawRows = await qb.getRawMany();
    const items = rawRows.map((row) => {
      const typedRow = row as Record<string, unknown>;
      const mapped: Record<string, unknown> = {};
      for (const field of sanitizedFields) {
        mapped[field] = typedRow[`t_${field}`];
      }
      return mapped;
    });

    return { items, total };
  }

  async createRecord(
    api: SysPublishedApi,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const writeFields = api.allowedFields.write;
    const filtered: Record<string, unknown> = {};

    for (const field of writeFields) {
      if (body[field] !== undefined) {
        filtered[field.replace(SANITIZE_REGEX, '')] = body[field];
      }
    }

    filtered['tenant_id'] = api.tenantId;

    const columns = Object.keys(filtered);
    const values = Object.values(filtered);
    const placeholders = values.map((_, i) => `$${i + 1}`);

    const result: Record<string, unknown>[] = await this.dataSource.query(
      `INSERT INTO "${api.tableName.replace(SANITIZE_REGEX, '')}" (${columns.map((c) => `"${c}"`).join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values,
    );

    return result[0] || {};
  }

  async updateRecord(
    api: SysPublishedApi,
    recordId: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const writeFields = api.allowedFields.write;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const field of writeFields) {
      if (body[field] !== undefined) {
        const sanitized = field.replace(SANITIZE_REGEX, '');
        setClauses.push(`"${sanitized}" = $${paramIdx}`);
        values.push(body[field]);
        paramIdx++;
      }
    }

    if (setClauses.length === 0) {
      return null;
    }

    values.push(recordId);
    values.push(api.tenantId);

    const tableName = api.tableName.replace(SANITIZE_REGEX, '');
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `UPDATE "${tableName}"
       SET ${setClauses.join(', ')}, "updated_at" = NOW()
       WHERE "id" = $${paramIdx} AND "tenant_id" = $${paramIdx + 1}
       RETURNING *`,
      values,
    );

    return rows.length > 0 ? rows[0] : null;
  }

  async logAccess(
    tenantId: string,
    apiKeyId: string,
    publishedApiId: string,
    method: string,
    path: string,
    statusCode: number,
    responseTimeMs: number,
    ipAddress: string | null,
    requestBody: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        tenantId,
        apiKeyId,
        publishedApiId,
        method,
        path,
        statusCode,
        responseTimeMs,
        ipAddress,
        requestBody,
      }),
    );
  }

  private applyFilterPolicy(
    qb: ReturnType<DataSource['createQueryBuilder']>,
    filters: FilterPolicy[],
  ): void {
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      const sanitizedField = filter.field.replace(SANITIZE_REGEX, '');
      const paramName = `fp_${i}`;

      switch (filter.op) {
        case 'eq':
          qb.andWhere(`t.${sanitizedField} = :${paramName}`, {
            [paramName]: filter.value,
          });
          break;
        case 'neq':
          qb.andWhere(`t.${sanitizedField} != :${paramName}`, {
            [paramName]: filter.value,
          });
          break;
        case 'in':
          qb.andWhere(`t.${sanitizedField} IN (:...${paramName})`, {
            [paramName]: filter.value,
          });
          break;
        case 'is_set':
          qb.andWhere(`t.${sanitizedField} IS NOT NULL`);
          break;
        case 'is_empty':
          qb.andWhere(`t.${sanitizedField} IS NULL`);
          break;
        default:
          this.logger.warn('Unknown filter operator', {
            op: filter.op,
            field: filter.field,
          });
      }
    }
  }
}
