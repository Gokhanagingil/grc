import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Readable } from 'stream';
import { ListView, ListViewColumn } from '../entities/list-view.entity';

interface ExportOptions {
  tableName: string;
  viewId?: string;
  columns?: string[];
  filters?: Record<string, unknown>;
  search?: string;
  sort?: { field: string; order: 'ASC' | 'DESC' };
  format: 'csv' | 'xlsx';
}

interface ExportResult {
  stream: Readable;
  filename: string;
  contentType: string;
}

const DEFAULT_ALLOWED_TABLES = [
  'grc_risks',
  'grc_policies',
  'grc_requirements',
  'grc_controls',
  'grc_audits',
  'grc_issues',
  'grc_capas',
  'grc_evidence',
  'grc_processes',
  'grc_process_violations',
];

const BATCH_SIZE = 1000;

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly allowedTables: Set<string>;

  private readonly tableColumnMap: Record<string, string[]> = {
    grc_risks: [
      'id',
      'number',
      'title',
      'description',
      'category',
      'likelihood',
      'impact',
      'risk_score',
      'status',
      'owner_id',
      'created_at',
      'updated_at',
    ],
    grc_policies: [
      'id',
      'number',
      'title',
      'description',
      'category',
      'status',
      'version',
      'effective_date',
      'review_date',
      'owner_id',
      'created_at',
      'updated_at',
    ],
    grc_requirements: [
      'id',
      'number',
      'title',
      'description',
      'category',
      'source',
      'status',
      'priority',
      'owner_id',
      'created_at',
      'updated_at',
    ],
    grc_controls: [
      'id',
      'number',
      'title',
      'description',
      'category',
      'type',
      'frequency',
      'status',
      'effectiveness',
      'owner_id',
      'created_at',
      'updated_at',
    ],
    grc_audits: [
      'id',
      'number',
      'title',
      'description',
      'type',
      'status',
      'start_date',
      'end_date',
      'lead_auditor_id',
      'created_at',
      'updated_at',
    ],
    grc_issues: [
      'id',
      'number',
      'title',
      'description',
      'category',
      'severity',
      'status',
      'priority',
      'owner_id',
      'due_date',
      'created_at',
      'updated_at',
    ],
    grc_capas: [
      'id',
      'number',
      'title',
      'description',
      'type',
      'status',
      'priority',
      'owner_id',
      'due_date',
      'created_at',
      'updated_at',
    ],
    grc_evidence: [
      'id',
      'number',
      'title',
      'description',
      'type',
      'status',
      'collection_date',
      'owner_id',
      'created_at',
      'updated_at',
    ],
    grc_processes: [
      'id',
      'number',
      'name',
      'description',
      'category',
      'status',
      'owner_id',
      'created_at',
      'updated_at',
    ],
    grc_process_violations: [
      'id',
      'number',
      'title',
      'description',
      'severity',
      'status',
      'process_id',
      'detected_date',
      'created_at',
      'updated_at',
    ],
  };

  constructor(
    @InjectRepository(ListView)
    private readonly listViewRepository: Repository<ListView>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const configuredTables = this.configService.get<string>(
      'EXPORT_ALLOWED_TABLES',
    );
    this.allowedTables = new Set(
      configuredTables
        ? configuredTables.split(',').map((t) => t.trim())
        : DEFAULT_ALLOWED_TABLES,
    );
  }

  private validateTableName(tableName: string): void {
    if (!this.allowedTables.has(tableName)) {
      throw new BadRequestException(
        `Invalid table name: ${tableName}. Allowed tables: ${Array.from(this.allowedTables).join(', ')}`,
      );
    }
  }

  private validateColumns(tableName: string, columns: string[]): string[] {
    const allowedColumns = this.tableColumnMap[tableName] || [];
    const validColumns = columns.filter((col) => allowedColumns.includes(col));

    if (validColumns.length === 0) {
      throw new BadRequestException(
        `No valid columns specified for table ${tableName}`,
      );
    }

    return validColumns;
  }

  private sanitizeColumnName(column: string): string {
    return column.replace(/[^a-zA-Z0-9_]/g, '');
  }

  async export(
    tenantId: string,
    userId: string,
    options: ExportOptions,
  ): Promise<ExportResult> {
    this.validateTableName(options.tableName);

    let columns: string[];

    if (options.viewId) {
      const view = await this.listViewRepository.findOne({
        where: { id: options.viewId, tenantId },
        relations: ['columns'],
      });

      if (!view) {
        throw new BadRequestException(`View not found: ${options.viewId}`);
      }

      columns = view.columns
        .filter((c: ListViewColumn) => c.visible)
        .sort(
          (a: ListViewColumn, b: ListViewColumn) => a.orderIndex - b.orderIndex,
        )
        .map((c: ListViewColumn) => c.columnName);
    } else if (options.columns && options.columns.length > 0) {
      columns = options.columns;
    } else {
      columns = this.tableColumnMap[options.tableName] || ['id'];
    }

    columns = this.validateColumns(options.tableName, columns);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toISOString().slice(11, 16).replace(':', '');
    const filename = `${options.tableName}_${dateStr}_${timeStr}.csv`;

    const stream = this.generateCsvStream(
      tenantId,
      options.tableName,
      columns,
      options.filters,
      options.search,
      options.sort,
    );

    this.eventEmitter.emit('export.created', {
      tenantId,
      userId,
      tableName: options.tableName,
      format: options.format,
      columnCount: columns.length,
      filename,
    });

    return {
      stream,
      filename,
      contentType: 'text/csv',
    };
  }

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    let str: string;
    if (typeof value === 'object') {
      str = JSON.stringify(value);
    } else if (typeof value === 'string') {
      str = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      str = value.toString();
    } else {
      str = '';
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private generateCsvStream(
    tenantId: string,
    tableName: string,
    columns: string[],
    filters?: Record<string, unknown>,
    search?: string,
    sort?: { field: string; order: 'ASC' | 'DESC' },
  ): Readable {
    const sanitizedColumns = columns.map((c) => this.sanitizeColumnName(c));
    const headerRow = sanitizedColumns.join(',') + '\n';

    const readable = new Readable({
      read() {},
    });

    readable.push(headerRow);

    const fetchAndStreamData = async () => {
      try {
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const queryBuilder = this.dataSource
            .createQueryBuilder()
            .select(sanitizedColumns.map((col) => `t.${col}`))
            .from(tableName, 't')
            .where('t.tenant_id = :tenantId', { tenantId })
            .andWhere('t.is_deleted = :isDeleted', { isDeleted: false })
            .offset(offset)
            .limit(BATCH_SIZE);

          if (sort && sanitizedColumns.includes(sort.field)) {
            queryBuilder.orderBy(`t.${sort.field}`, sort.order);
          } else {
            queryBuilder.orderBy('t.created_at', 'DESC');
          }

          if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
              const sanitizedKey = this.sanitizeColumnName(key);
              if (
                sanitizedColumns.includes(sanitizedKey) &&
                value !== undefined
              ) {
                queryBuilder.andWhere(`t.${sanitizedKey} = :${sanitizedKey}`, {
                  [sanitizedKey]: value,
                });
              }
            });
          }

          if (search) {
            const searchableColumns = sanitizedColumns.filter((col) =>
              ['title', 'name', 'description', 'number'].includes(col),
            );
            if (searchableColumns.length > 0) {
              const searchConditions = searchableColumns
                .map((col) => `t.${col} ILIKE :search`)
                .join(' OR ');
              queryBuilder.andWhere(`(${searchConditions})`, {
                search: `%${search}%`,
              });
            }
          }

          const rows = await queryBuilder.getRawMany();

          if (rows.length === 0) {
            hasMore = false;
          } else {
            for (const row of rows) {
              const typedRow = row as Record<string, unknown>;
              const csvRow =
                sanitizedColumns
                  .map((col) => {
                    const key = `t_${col}`;
                    return this.escapeCsvValue(typedRow[key]);
                  })
                  .join(',') + '\n';
              readable.push(csvRow);
            }

            offset += BATCH_SIZE;
            hasMore = rows.length === BATCH_SIZE;
          }
        }

        readable.push(null);
      } catch (error) {
        this.logger.error(`Export streaming error: ${error}`);
        readable.destroy(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    };

    void fetchAndStreamData();

    return readable;
  }
}
