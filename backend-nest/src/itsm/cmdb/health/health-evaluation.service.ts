import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CmdbCi } from '../ci/ci.entity';
import { CmdbCiRel } from '../ci-rel/ci-rel.entity';
import { CmdbHealthFinding, FindingStatus } from './cmdb-health-finding.entity';
import {
  CmdbQualitySnapshot,
  QualityBreakdown,
} from './cmdb-quality-snapshot.entity';
import { HealthRuleService } from './health-rule.service';
import { HealthFindingService } from './health-finding.service';
import { QualitySnapshotService } from './quality-snapshot.service';
import {
  evaluateRule,
  calculateQualityScore,
  CiRecord,
} from './engine/health-evaluator';
import { EventBusService } from '../../../event-bus/event-bus.service';
import { StructuredLoggerService } from '../../../common/logger';

@Injectable()
export class HealthEvaluationService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(CmdbCi)
    private readonly ciRepo: Repository<CmdbCi>,
    @InjectRepository(CmdbCiRel)
    private readonly ciRelRepo: Repository<CmdbCiRel>,
    private readonly ruleService: HealthRuleService,
    private readonly findingService: HealthFindingService,
    private readonly snapshotService: QualitySnapshotService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('HealthEvaluationService');
  }

  async evaluate(
    tenantId: string,
    actorId?: string,
  ): Promise<CmdbQualitySnapshot> {
    const startTime = Date.now();

    await this.eventBus?.emit({
      tenantId,
      source: 'cmdb-health',
      eventName: 'health.evaluation.started',
      actorId,
    });

    const rules = await this.ruleService.findEnabledRules(tenantId);

    const cis = await this.ciRepo.find({
      where: { tenantId, isDeleted: false },
    });

    const ciRecords: CiRecord[] = cis.map((ci) => ({
      id: ci.id,
      name: ci.name,
      ownedBy: ci.ownedBy,
      managedBy: ci.managedBy,
      description: ci.description,
      classId: ci.classId,
      lifecycle: ci.lifecycle,
      updatedAt: ci.updatedAt,
    }));

    const relationshipCounts = await this.getRelationshipCounts(tenantId);
    const serviceOfferingCounts = await this.getServiceOfferingCounts(tenantId);

    let totalNewFindings = 0;
    let totalResolvedFindings = 0;

    for (const rule of rules) {
      const findings = evaluateRule(
        rule.condition,
        ciRecords,
        relationshipCounts,
        serviceOfferingCounts,
      );

      const activeCiIds = new Set(findings.map((f) => f.ciId));

      for (const finding of findings) {
        const existing = await this.findingService.findExistingFinding(
          tenantId,
          rule.id,
          finding.ciId,
        );

        if (existing) {
          if (existing.status !== FindingStatus.WAIVED) {
            existing.lastSeenAt = new Date();
            existing.status = FindingStatus.OPEN;
            existing.details = finding.details;
            await this.findingService.updateForTenant(tenantId, existing.id, {
              lastSeenAt: existing.lastSeenAt,
              status: existing.status,
              details: existing.details,
            } as Partial<Omit<CmdbHealthFinding, 'id' | 'tenantId'>>);
          }
        } else {
          await this.findingService.createForTenant(tenantId, {
            ruleId: rule.id,
            ciId: finding.ciId,
            status: FindingStatus.OPEN,
            details: finding.details,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
          });
          totalNewFindings++;
        }
      }

      const resolved = await this.findingService.resolveStaleFindings(
        tenantId,
        rule.id,
        activeCiIds,
      );
      totalResolvedFindings += resolved;
    }

    const statusCounts = await this.findingService.countByStatus(tenantId);
    const totalFindings =
      statusCounts.open + statusCounts.waived + statusCounts.resolved;
    const score = calculateQualityScore(cis.length, statusCounts.open);

    const breakdown: QualityBreakdown = {
      bySeverity: await this.getBreakdownBySeverity(tenantId),
      byRule: await this.getBreakdownByRule(tenantId),
    };

    const snapshot = await this.snapshotService.createSnapshot(tenantId, {
      score,
      totalCis: cis.length,
      totalFindings,
      openFindings: statusCounts.open,
      waivedFindings: statusCounts.waived,
      resolvedFindings: statusCounts.resolved,
      breakdown,
    });

    const duration = Date.now() - startTime;

    await this.eventBus?.emit({
      tenantId,
      source: 'cmdb-health',
      eventName: 'health.evaluation.finished',
      payload: {
        snapshotId: snapshot.id,
        score,
        totalCis: cis.length,
        openFindings: statusCounts.open,
        newFindings: totalNewFindings,
        resolvedFindings: totalResolvedFindings,
        rulesEvaluated: rules.length,
        durationMs: duration,
      },
      actorId,
    });

    this.logger.log('Health evaluation completed', {
      tenantId,
      score,
      totalCis: cis.length,
      openFindings: statusCounts.open,
      durationMs: duration,
    });

    return snapshot;
  }

  private async getRelationshipCounts(
    tenantId: string,
  ): Promise<Map<string, number>> {
    const results = await this.ciRelRepo
      .createQueryBuilder('r')
      .select('r.source_ci_id', 'ciId')
      .addSelect('COUNT(*)', 'count')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.isActive = true')
      .groupBy('r.source_ci_id')
      .getRawMany<{ ciId: string; count: string }>();

    const targetResults = await this.ciRelRepo
      .createQueryBuilder('r')
      .select('r.target_ci_id', 'ciId')
      .addSelect('COUNT(*)', 'count')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.isActive = true')
      .groupBy('r.target_ci_id')
      .getRawMany<{ ciId: string; count: string }>();

    const map = new Map<string, number>();
    for (const r of results) {
      map.set(r.ciId, parseInt(r.count, 10));
    }
    for (const r of targetResults) {
      const existing = map.get(r.ciId) ?? 0;
      map.set(r.ciId, existing + parseInt(r.count, 10));
    }
    return map;
  }

  private async getServiceOfferingCounts(
    tenantId: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    try {
      const results = await this.ciRepo.manager
        .createQueryBuilder()
        .select('so.service_id', 'serviceId')
        .addSelect('COUNT(*)', 'count')
        .from('cmdb_service_offering', 'so')
        .innerJoin('cmdb_service', 's', 's.id = so.service_id')
        .where('s.tenant_id = :tenantId', { tenantId })
        .andWhere('so.is_deleted = false')
        .groupBy('so.service_id')
        .getRawMany<{ serviceId: string; count: string }>();

      for (const r of results) {
        map.set(r.serviceId, parseInt(r.count, 10));
      }
    } catch {
      this.logger.warn(
        'Could not query service offerings for health evaluation',
      );
    }
    return map;
  }

  private async getBreakdownBySeverity(
    tenantId: string,
  ): Promise<Record<string, number>> {
    const results = await this.findingService['repository']
      .createQueryBuilder('f')
      .innerJoin('f.rule', 'rule')
      .select('rule.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.isDeleted = false')
      .andWhere('f.status = :status', { status: FindingStatus.OPEN })
      .groupBy('rule.severity')
      .getRawMany<{ severity: string; count: string }>();

    const breakdown: Record<string, number> = {};
    for (const r of results) {
      breakdown[r.severity] = parseInt(r.count, 10);
    }
    return breakdown;
  }

  private async getBreakdownByRule(
    tenantId: string,
  ): Promise<{ ruleId: string; ruleName: string; count: number }[]> {
    const results = await this.findingService['repository']
      .createQueryBuilder('f')
      .innerJoin('f.rule', 'rule')
      .select('rule.id', 'ruleId')
      .addSelect('rule.name', 'ruleName')
      .addSelect('COUNT(*)', 'count')
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.isDeleted = false')
      .andWhere('f.status = :status', { status: FindingStatus.OPEN })
      .groupBy('rule.id')
      .addGroupBy('rule.name')
      .orderBy('count', 'DESC')
      .getRawMany<{ ruleId: string; ruleName: string; count: string }>();

    return results.map((r) => ({
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      count: parseInt(r.count, 10),
    }));
  }
}
