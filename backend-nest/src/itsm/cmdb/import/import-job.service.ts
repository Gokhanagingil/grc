import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbImportJob, ImportJobStatus } from './cmdb-import-job.entity';
import { CmdbImportRow, ImportRowStatus } from './cmdb-import-row.entity';
import {
  CmdbReconcileResult,
  ReconcileAction,
} from './cmdb-reconcile-result.entity';
import { CmdbImportSource } from './cmdb-import-source.entity';
import { CmdbCi } from '../ci/ci.entity';
import { CiService } from '../ci/ci.service';
import { ReconcileRuleService } from './reconcile-rule.service';
import {
  ImportJobFilterDto,
  ImportRowFilterDto,
  ReconcileResultFilterDto,
} from './dto/import-job.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { reconcileRow, ReconcileInput } from './engine/reconciliation-engine';

@Injectable()
export class ImportJobService extends MultiTenantServiceBase<CmdbImportJob> {
  constructor(
    @InjectRepository(CmdbImportJob)
    repository: Repository<CmdbImportJob>,
    @InjectRepository(CmdbImportRow)
    private readonly rowRepo: Repository<CmdbImportRow>,
    @InjectRepository(CmdbReconcileResult)
    private readonly resultRepo: Repository<CmdbReconcileResult>,
    private readonly ciService: CiService,
    private readonly reconcileRuleService: ReconcileRuleService,
  ) {
    super(repository);
  }

  async findWithFilters(
    tenantId: string,
    filterDto: ImportJobFilterDto,
  ): Promise<PaginatedResponse<CmdbImportJob>> {
    const { page = 1, pageSize = 20, search, q, status } = filterDto;

    const qb = this.repository.createQueryBuilder('job');
    qb.leftJoinAndSelect('job.source', 'src');
    qb.where('job.tenantId = :tenantId', { tenantId });
    qb.andWhere('job.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      qb.andWhere('job.status = :status', { status });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere('(src.name ILIKE :search OR job.status ILIKE :search)', {
        search: `%${searchTerm}%`,
      });
    }

    const total = await qb.getCount();
    qb.orderBy('job.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findOneWithDetails(
    tenantId: string,
    id: string,
  ): Promise<CmdbImportJob | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['source'],
    });
  }

  async findRowsForJob(
    tenantId: string,
    jobId: string,
    filterDto: ImportRowFilterDto,
  ): Promise<PaginatedResponse<CmdbImportRow>> {
    const { page = 1, pageSize = 20, status } = filterDto;

    const qb = this.rowRepo.createQueryBuilder('row');
    qb.where('row.tenantId = :tenantId', { tenantId });
    qb.andWhere('row.jobId = :jobId', { jobId });
    qb.andWhere('row.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      qb.andWhere('row.status = :status', { status });
    }

    const total = await qb.getCount();
    qb.orderBy('row.rowNo', 'ASC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findResultsForJob(
    tenantId: string,
    jobId: string,
    filterDto: ReconcileResultFilterDto,
  ): Promise<PaginatedResponse<CmdbReconcileResult>> {
    const { page = 1, pageSize = 20, action } = filterDto;

    const qb = this.resultRepo.createQueryBuilder('res');
    qb.where('res.tenantId = :tenantId', { tenantId });
    qb.andWhere('res.jobId = :jobId', { jobId });
    qb.andWhere('res.isDeleted = :isDeleted', { isDeleted: false });

    if (action) {
      qb.andWhere('res.action = :action', { action });
    }

    const total = await qb.getCount();
    qb.orderBy('res.createdAt', 'ASC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async createImportJob(
    tenantId: string,
    userId: string,
    sourceId: string | undefined,
    dryRun: boolean,
    rows: Record<string, unknown>[],
  ): Promise<CmdbImportJob> {
    const job = await this.createForTenant(tenantId, {
      sourceId: sourceId || null,
      status: ImportJobStatus.PENDING,
      dryRun,
      totalRows: rows.length,
      createdBy: userId,
    } as Partial<Omit<CmdbImportJob, 'id' | 'tenantId'>>);

    await this.repository.update(job.id, {
      status: ImportJobStatus.PARSING,
      startedAt: new Date(),
    });

    const importRows: CmdbImportRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const fingerprint = crypto
        .createHash('sha256')
        .update(JSON.stringify(raw))
        .digest('hex')
        .substring(0, 64);

      const row = this.rowRepo.create({
        tenantId,
        jobId: job.id,
        rowNo: i + 1,
        raw,
        parsed: raw,
        fingerprint,
        status: ImportRowStatus.PARSED,
        createdBy: userId,
        isDeleted: false,
      });
      importRows.push(row);
    }

    await this.rowRepo.save(importRows);

    const parsedCount = importRows.length;
    await this.repository.update(job.id, {
      parsedCount,
      status: ImportJobStatus.RECONCILING,
    });

    const allCis = await this.ciService.findAllForTenant(tenantId);
    const rules = await this.reconcileRuleService.findActiveRules(tenantId);

    let matchedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let conflictCount = 0;
    let errorCount = 0;

    const reconcileResults: CmdbReconcileResult[] = [];

    for (const importRow of importRows) {
      try {
        const input: ReconcileInput = {
          rowId: importRow.id,
          parsed: importRow.parsed || {},
        };

        const output = reconcileRow(input, allCis, rules);

        const result = this.resultRepo.create({
          tenantId,
          jobId: job.id,
          rowId: output.rowId,
          ciId: output.ciId,
          action: output.action,
          matchedBy: output.matchedBy,
          diff: output.diff,
          explain: output.explain,
          createdBy: userId,
          isDeleted: false,
        });
        reconcileResults.push(result);

        let rowStatus: ImportRowStatus;
        switch (output.action) {
          case ReconcileAction.CREATE:
            createdCount++;
            rowStatus = ImportRowStatus.CREATED;
            break;
          case ReconcileAction.UPDATE:
            matchedCount++;
            updatedCount++;
            rowStatus = ImportRowStatus.UPDATED;
            break;
          case ReconcileAction.SKIP:
            matchedCount++;
            rowStatus = ImportRowStatus.MATCHED;
            break;
          case ReconcileAction.CONFLICT:
            conflictCount++;
            rowStatus = ImportRowStatus.CONFLICT;
            break;
          default:
            rowStatus = ImportRowStatus.PARSED;
        }

        await this.rowRepo.update(importRow.id, { status: rowStatus });
      } catch (err) {
        errorCount++;
        const message = err instanceof Error ? err.message : 'Unknown error';
        await this.rowRepo.update(importRow.id, {
          status: ImportRowStatus.ERROR,
          errorMessage: message,
        });
      }
    }

    if (reconcileResults.length > 0) {
      await this.resultRepo.save(reconcileResults);
    }

    await this.repository.update(job.id, {
      status: ImportJobStatus.COMPLETED,
      matchedCount,
      createdCount,
      updatedCount,
      conflictCount,
      errorCount,
      finishedAt: new Date(),
    });

    return this.findOneWithDetails(tenantId, job.id) as Promise<CmdbImportJob>;
  }

  async applyJob(
    tenantId: string,
    userId: string,
    jobId: string,
  ): Promise<CmdbImportJob> {
    const job = await this.findOneWithDetails(tenantId, jobId);
    if (!job) {
      throw new BadRequestException('Import job not found');
    }
    if (!job.dryRun) {
      throw new BadRequestException('Only dry-run jobs can be applied');
    }
    if (job.status !== ImportJobStatus.COMPLETED) {
      throw new BadRequestException('Job must be in COMPLETED status to apply');
    }

    const results = await this.resultRepo.find({
      where: { jobId, tenantId, isDeleted: false },
    });

    const rows = await this.rowRepo.find({
      where: { jobId, tenantId, isDeleted: false },
    });
    const rowMap = new Map(rows.map((r) => [r.id, r]));

    const toStr = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return `${v as string | number | boolean}`;
    };

    for (const result of results) {
      if (result.action === ReconcileAction.CREATE) {
        const row = rowMap.get(result.rowId || '');
        if (row && row.parsed) {
          const parsed = row.parsed;
          const hostname = parsed.hostname ?? parsed.name ?? `CI-${row.rowNo}`;
          await this.ciService.createCi(tenantId, userId, {
            name: toStr(hostname),
            description: parsed.description ? toStr(parsed.description) : null,
            classId: parsed.classId ? toStr(parsed.classId) : undefined,
            lifecycle: parsed.lifecycle ? toStr(parsed.lifecycle) : 'installed',
            environment: parsed.environment
              ? toStr(parsed.environment)
              : 'production',
            serialNumber: parsed.serial_number
              ? toStr(parsed.serial_number)
              : null,
            ipAddress:
              parsed.ip_address || parsed.ip
                ? toStr(parsed.ip_address || parsed.ip)
                : null,
            dnsName:
              parsed.fqdn || parsed.dns_name
                ? toStr(parsed.fqdn || parsed.dns_name)
                : null,
            assetTag: parsed.asset_tag ? toStr(parsed.asset_tag) : null,
            category: parsed.category ? toStr(parsed.category) : null,
          } as Partial<CmdbCi>);
        }
      } else if (result.action === ReconcileAction.UPDATE && result.ciId) {
        const safeUpdates = (result.diff || []).filter(
          (d) => d.classification === 'safe_update',
        );
        if (safeUpdates.length > 0) {
          const updateData: Record<string, unknown> = {};
          for (const d of safeUpdates) {
            updateData[d.field] = d.newValue;
          }
          await this.ciService.updateCi(
            tenantId,
            userId,
            result.ciId,
            updateData as Partial<CmdbCi>,
          );
        }
      }
    }

    await this.repository.update(jobId, {
      status: ImportJobStatus.APPLIED,
      updatedBy: userId,
    });

    return this.findOneWithDetails(tenantId, jobId) as Promise<CmdbImportJob>;
  }

  async findRunsForSource(
    tenantId: string,
    sourceId: string,
    filterDto: ImportJobFilterDto,
  ): Promise<PaginatedResponse<CmdbImportJob>> {
    const { page = 1, pageSize = 20, status } = filterDto;

    const qb = this.repository.createQueryBuilder('job');
    qb.where('job.tenantId = :tenantId', { tenantId });
    qb.andWhere('job.sourceId = :sourceId', { sourceId });
    qb.andWhere('job.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      qb.andWhere('job.status = :status', { status });
    }

    const total = await qb.getCount();
    qb.orderBy('job.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async createRunNowJob(
    tenantId: string,
    userId: string,
    source: CmdbImportSource,
    dryRun: boolean,
  ): Promise<CmdbImportJob> {
    const job = this.repository.create({
      tenantId,
      sourceId: source.id,
      status: ImportJobStatus.PENDING,
      dryRun,
      totalRows: 0,
      createdBy: userId,
      isDeleted: false,
    });

    return this.repository.save(job);
  }

  async getJobReport(
    tenantId: string,
    jobId: string,
  ): Promise<{
    job: CmdbImportJob;
    summary: {
      totalRows: number;
      wouldCreate: number;
      wouldUpdate: number;
      conflicts: number;
      errors: number;
      skipped: number;
    };
    topConflicts: CmdbReconcileResult[];
    explainSamples: CmdbReconcileResult[];
  }> {
    const job = await this.findOneWithDetails(tenantId, jobId);
    if (!job) {
      throw new BadRequestException('Import job not found');
    }

    const topConflicts = await this.resultRepo.find({
      where: {
        jobId,
        tenantId,
        action: ReconcileAction.CONFLICT,
        isDeleted: false,
      },
      take: 10,
      order: { createdAt: 'ASC' },
    });

    const explainSamples = await this.resultRepo.find({
      where: {
        jobId,
        tenantId,
        isDeleted: false,
      },
      take: 5,
      order: { createdAt: 'ASC' },
    });

    const skipCount = await this.resultRepo.count({
      where: {
        jobId,
        tenantId,
        action: ReconcileAction.SKIP,
        isDeleted: false,
      },
    });

    return {
      job,
      summary: {
        totalRows: job.totalRows,
        wouldCreate: job.createdCount,
        wouldUpdate: job.updatedCount,
        conflicts: job.conflictCount,
        errors: job.errorCount,
        skipped: skipCount,
      },
      topConflicts,
      explainSamples,
    };
  }
}
