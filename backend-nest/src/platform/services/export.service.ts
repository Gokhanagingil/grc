import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class ExportService {
  private readonly allowedTables = new Set([
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
  ]);

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
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

    const stream = this.generateCsvStream(columns);

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

  private generateCsvStream(columns: string[]): Readable {
    const sanitizedColumns = columns.map((c) => this.sanitizeColumnName(c));

    const headerRow = sanitizedColumns.join(',') + '\n';

    const readable = new Readable({
      read() {},
    });

    readable.push(headerRow);

    setTimeout(() => {
      readable.push(null);
    }, 100);

    return readable;
  }
}
