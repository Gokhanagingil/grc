import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbHealthFinding, FindingStatus } from './cmdb-health-finding.entity';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { FindingFilterDto } from './dto/health-finding.dto';

@Injectable()
export class HealthFindingService extends MultiTenantServiceBase<CmdbHealthFinding> {
  constructor(
    @InjectRepository(CmdbHealthFinding)
    repository: Repository<CmdbHealthFinding>,
  ) {
    super(repository);
  }

  async findWithFilters(
    tenantId: string,
    filterDto: FindingFilterDto,
  ): Promise<PaginatedResponse<CmdbHealthFinding>> {
    const {
      page = 1,
      pageSize = 20,
      status,
      ruleId,
      ciId,
      severity,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('f');
    qb.leftJoinAndSelect('f.rule', 'rule');

    qb.where('f.tenantId = :tenantId', { tenantId });
    qb.andWhere('f.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      qb.andWhere('f.status = :status', { status });
    }

    if (ruleId) {
      qb.andWhere('f.ruleId = :ruleId', { ruleId });
    }

    if (ciId) {
      qb.andWhere('f.ciId = :ciId', { ciId });
    }

    if (severity) {
      qb.andWhere('rule.severity = :severity', { severity });
    }

    const total = await qb.getCount();

    qb.orderBy('f.lastSeenAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findExistingFinding(
    tenantId: string,
    ruleId: string,
    ciId: string,
  ): Promise<CmdbHealthFinding | null> {
    return this.repository.findOne({
      where: { tenantId, ruleId, ciId, isDeleted: false },
    });
  }

  async waiveFinding(
    tenantId: string,
    findingId: string,
    userId: string,
    reason: string,
  ): Promise<CmdbHealthFinding | null> {
    const finding = await this.findOneForTenant(tenantId, findingId);
    if (!finding || finding.isDeleted) {
      return null;
    }

    finding.status = FindingStatus.WAIVED;
    finding.waivedBy = userId;
    finding.waivedAt = new Date();
    finding.waiveReason = reason;
    finding.updatedBy = userId;

    return this.repository.save(finding);
  }

  async countByStatus(
    tenantId: string,
  ): Promise<{ open: number; waived: number; resolved: number }> {
    const results = await this.repository
      .createQueryBuilder('f')
      .select('f.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.isDeleted = false')
      .groupBy('f.status')
      .getRawMany<{ status: string; count: string }>();

    const counts = { open: 0, waived: 0, resolved: 0 };
    for (const r of results) {
      if (r.status === (FindingStatus.OPEN as string))
        counts.open = parseInt(r.count, 10);
      if (r.status === (FindingStatus.WAIVED as string))
        counts.waived = parseInt(r.count, 10);
      if (r.status === (FindingStatus.RESOLVED as string))
        counts.resolved = parseInt(r.count, 10);
    }
    return counts;
  }

  async resolveStaleFindings(
    tenantId: string,
    ruleId: string,
    activeCiIds: Set<string>,
  ): Promise<number> {
    const openFindings = await this.repository.find({
      where: {
        tenantId,
        ruleId,
        status: FindingStatus.OPEN,
        isDeleted: false,
      },
    });

    let resolvedCount = 0;
    for (const finding of openFindings) {
      if (!activeCiIds.has(finding.ciId)) {
        finding.status = FindingStatus.RESOLVED;
        await this.repository.save(finding);
        resolvedCount++;
      }
    }
    return resolvedCount;
  }
}
