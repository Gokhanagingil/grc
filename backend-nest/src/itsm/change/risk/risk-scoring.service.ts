import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RiskAssessment,
  RiskLevel,
  RiskFactor,
} from './risk-assessment.entity';
import { ItsmChange, ChangeType } from '../change.entity';
import { CmdbServiceCi } from '../../cmdb/service-ci/cmdb-service-ci.entity';
import { CmdbCiRel } from '../../cmdb/ci-rel/ci-rel.entity';
import { CmdbQualitySnapshot } from '../../cmdb/health/cmdb-quality-snapshot.entity';
import { SlaInstance, SlaInstanceStatus } from '../../sla/sla-instance.entity';
import { CalendarConflict } from '../calendar/calendar-conflict.entity';
import { CustomerRiskImpactService } from './customer-risk-impact.service';
import { TopologyImpactAnalysisService } from './topology-impact/topology-impact-analysis.service';

const FACTOR_WEIGHTS = {
  BLAST_RADIUS: 18,
  TOPOLOGY_IMPACT: 12,
  CMDB_QUALITY: 11,
  CHANGE_TYPE: 16,
  LEAD_TIME: 15,
  SLA_BREACH_FORECAST: 7,
  CONFLICT_STATUS: 7,
  CUSTOMER_RISK_EXPOSURE: 14,
};

function scoreToLevel(score: number): RiskLevel {
  if (score >= 75) return RiskLevel.CRITICAL;
  if (score >= 50) return RiskLevel.HIGH;
  if (score >= 25) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

@Injectable()
export class RiskScoringService {
  constructor(
    @Optional()
    @InjectRepository(RiskAssessment)
    private readonly riskRepo?: Repository<RiskAssessment>,
    @Optional()
    @InjectRepository(CmdbServiceCi)
    private readonly serviceCiRepo?: Repository<CmdbServiceCi>,
    @Optional()
    @InjectRepository(CmdbCiRel)
    private readonly ciRelRepo?: Repository<CmdbCiRel>,
    @Optional()
    @InjectRepository(CmdbQualitySnapshot)
    private readonly qualitySnapshotRepo?: Repository<CmdbQualitySnapshot>,
    @Optional()
    @InjectRepository(SlaInstance)
    private readonly slaInstanceRepo?: Repository<SlaInstance>,
    @Optional()
    @InjectRepository(CalendarConflict)
    private readonly conflictRepo?: Repository<CalendarConflict>,
    @Optional()
    private readonly customerRiskImpactService?: CustomerRiskImpactService,
    @Optional()
    private readonly topologyImpactService?: TopologyImpactAnalysisService,
  ) {}

  async getAssessment(
    tenantId: string,
    changeId: string,
  ): Promise<RiskAssessment | null> {
    if (!this.riskRepo) return null;
    return this.riskRepo.findOne({
      where: { tenantId, changeId, isDeleted: false },
      order: { computedAt: 'DESC' },
    });
  }

  async calculateRisk(
    tenantId: string,
    userId: string,
    change: ItsmChange,
  ): Promise<RiskAssessment | null> {
    if (!this.riskRepo) return null;

    const factors: RiskFactor[] = [];
    let impactedCiCount = 0;
    let impactedServiceCount = 0;
    let hasFreezeConflict = false;
    let hasSlaRisk = false;

    const blastResult = await this.calculateBlastRadius(tenantId, change);
    factors.push(blastResult.factor);
    impactedCiCount = blastResult.ciCount;
    impactedServiceCount = blastResult.serviceCount;

    factors.push(await this.calculateCmdbQuality(tenantId));

    factors.push(this.calculateChangeTypeFactor(change.type));

    factors.push(this.calculateLeadTimeFactor(change));

    const slaResult = await this.calculateSlaBreachForecast(tenantId, change);
    factors.push(slaResult.factor);
    hasSlaRisk = slaResult.hasRisk;

    const conflictResult = await this.calculateConflictStatus(
      tenantId,
      change.id,
    );
    factors.push(conflictResult.factor);
    hasFreezeConflict = conflictResult.hasFreezeConflict;

    const customerRiskResult = await this.calculateCustomerRiskExposure(
      tenantId,
      change,
    );
    factors.push(customerRiskResult.factor);

    const topologyResult = await this.calculateTopologyImpactFactor(
      tenantId,
      change,
    );
    factors.push(topologyResult.factor);

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedSum = factors.reduce((sum, f) => sum + f.weightedScore, 0);
    const riskScore =
      totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const riskLevel = scoreToLevel(riskScore);

    const existing = await this.riskRepo.findOne({
      where: { tenantId, changeId: change.id, isDeleted: false },
    });

    if (existing) {
      existing.riskScore = riskScore;
      existing.riskLevel = riskLevel;
      existing.computedAt = new Date();
      existing.breakdown = factors;
      existing.impactedCiCount = impactedCiCount;
      existing.impactedServiceCount = impactedServiceCount;
      existing.hasFreezeConflict = hasFreezeConflict;
      existing.hasSlaRisk = hasSlaRisk;
      existing.updatedBy = userId;
      return this.riskRepo.save(existing);
    }

    const assessment = this.riskRepo.create({
      tenantId,
      changeId: change.id,
      riskScore,
      riskLevel,
      computedAt: new Date(),
      breakdown: factors,
      impactedCiCount,
      impactedServiceCount,
      hasFreezeConflict,
      hasSlaRisk,
      createdBy: userId,
      isDeleted: false,
    });

    return this.riskRepo.save(assessment);
  }

  private async calculateBlastRadius(
    tenantId: string,
    change: ItsmChange,
  ): Promise<{ factor: RiskFactor; ciCount: number; serviceCount: number }> {
    let ciCount = 0;
    let serviceCount = 0;

    if (change.serviceId && this.serviceCiRepo) {
      const serviceCis = await this.serviceCiRepo.find({
        where: { tenantId, serviceId: change.serviceId },
      });
      ciCount = serviceCis.length;

      if (this.ciRelRepo && ciCount > 0) {
        const ciIds = serviceCis.map((sc) => sc.ciId);
        for (const ciId of ciIds) {
          const rels = await this.ciRelRepo.find({
            where: [
              { tenantId, sourceCiId: ciId, isActive: true },
              { tenantId, targetCiId: ciId, isActive: true },
            ],
          });
          const relatedIds = rels.map((r) =>
            r.sourceCiId === ciId ? r.targetCiId : r.sourceCiId,
          );
          ciCount += relatedIds.filter((rid) => !ciIds.includes(rid)).length;
        }
      }

      serviceCount = 1;
    }

    let rawScore: number;
    if (ciCount === 0) {
      rawScore = 10;
    } else if (ciCount <= 5) {
      rawScore = 25;
    } else if (ciCount <= 20) {
      rawScore = 50;
    } else if (ciCount <= 50) {
      rawScore = 75;
    } else {
      rawScore = 95;
    }

    return {
      factor: {
        name: 'Blast Radius',
        weight: FACTOR_WEIGHTS.BLAST_RADIUS,
        score: rawScore,
        weightedScore: rawScore * FACTOR_WEIGHTS.BLAST_RADIUS,
        evidence: `${ciCount} impacted CIs across ${serviceCount} service(s)`,
      },
      ciCount,
      serviceCount,
    };
  }

  private async calculateCmdbQuality(tenantId: string): Promise<RiskFactor> {
    let qualityScore = 80;

    if (this.qualitySnapshotRepo) {
      const latest = await this.qualitySnapshotRepo.findOne({
        where: { tenantId },
        order: { createdAt: 'DESC' },
      });
      if (latest) {
        qualityScore = Number(latest.score);
      }
    }

    const rawScore = Math.max(0, 100 - qualityScore);

    return {
      name: 'CMDB Quality',
      weight: FACTOR_WEIGHTS.CMDB_QUALITY,
      score: rawScore,
      weightedScore: rawScore * FACTOR_WEIGHTS.CMDB_QUALITY,
      evidence: `CMDB quality score: ${qualityScore}% (lower quality = higher risk)`,
    };
  }

  private calculateChangeTypeFactor(type: ChangeType): RiskFactor {
    let rawScore: number;
    let evidence: string;

    switch (type) {
      case ChangeType.STANDARD:
        rawScore = 10;
        evidence = 'Standard change - pre-approved, low risk';
        break;
      case ChangeType.NORMAL:
        rawScore = 40;
        evidence = 'Normal change - requires assessment';
        break;
      case ChangeType.EMERGENCY:
        rawScore = 80;
        evidence = 'Emergency change - elevated risk due to urgency';
        break;
      default:
        rawScore = 40;
        evidence = `Unknown change type: ${String(type)}`;
    }

    return {
      name: 'Change Type',
      weight: FACTOR_WEIGHTS.CHANGE_TYPE,
      score: rawScore,
      weightedScore: rawScore * FACTOR_WEIGHTS.CHANGE_TYPE,
      evidence,
    };
  }

  private calculateLeadTimeFactor(change: ItsmChange): RiskFactor {
    if (!change.plannedStartAt || !change.createdAt) {
      return {
        name: 'Lead Time',
        weight: FACTOR_WEIGHTS.LEAD_TIME,
        score: 50,
        weightedScore: 50 * FACTOR_WEIGHTS.LEAD_TIME,
        evidence: 'No planned start date - moderate risk assumed',
      };
    }

    const leadTimeMs =
      new Date(change.plannedStartAt).getTime() -
      new Date(change.createdAt).getTime();
    const leadTimeHours = leadTimeMs / (1000 * 60 * 60);

    let rawScore: number;
    let evidence: string;

    if (leadTimeHours < 4) {
      rawScore = 90;
      evidence = `Very short lead time: ${leadTimeHours.toFixed(1)}h (< 4h)`;
    } else if (leadTimeHours < 24) {
      rawScore = 65;
      evidence = `Short lead time: ${leadTimeHours.toFixed(1)}h (< 24h)`;
    } else if (leadTimeHours < 72) {
      rawScore = 35;
      evidence = `Moderate lead time: ${leadTimeHours.toFixed(1)}h (1-3 days)`;
    } else if (leadTimeHours < 168) {
      rawScore = 15;
      evidence = `Good lead time: ${leadTimeHours.toFixed(1)}h (3-7 days)`;
    } else {
      rawScore = 5;
      evidence = `Excellent lead time: ${leadTimeHours.toFixed(1)}h (> 7 days)`;
    }

    return {
      name: 'Lead Time',
      weight: FACTOR_WEIGHTS.LEAD_TIME,
      score: rawScore,
      weightedScore: rawScore * FACTOR_WEIGHTS.LEAD_TIME,
      evidence,
    };
  }

  private async calculateSlaBreachForecast(
    tenantId: string,
    change: ItsmChange,
  ): Promise<{ factor: RiskFactor; hasRisk: boolean }> {
    let hasRisk = false;
    let rawScore = 5;
    let evidence = 'No active SLA instances at risk';

    if (
      change.serviceId &&
      this.slaInstanceRepo &&
      change.plannedStartAt &&
      change.plannedEndAt
    ) {
      const activeInstances = await this.slaInstanceRepo.find({
        where: {
          tenantId,
          status: SlaInstanceStatus.IN_PROGRESS,
          breached: false,
        },
      });

      const atRisk = activeInstances.filter((inst) => {
        const dueAt = new Date(inst.dueAt).getTime();
        const changeStart = new Date(change.plannedStartAt!).getTime();
        const changeEnd = new Date(change.plannedEndAt!).getTime();
        return dueAt >= changeStart && dueAt <= changeEnd;
      });

      if (atRisk.length > 0) {
        hasRisk = true;
        rawScore = Math.min(95, 50 + atRisk.length * 15);
        evidence = `${atRisk.length} SLA instance(s) due during change window`;
      }
    }

    return {
      factor: {
        name: 'SLA Breach Forecast',
        weight: FACTOR_WEIGHTS.SLA_BREACH_FORECAST,
        score: rawScore,
        weightedScore: rawScore * FACTOR_WEIGHTS.SLA_BREACH_FORECAST,
        evidence,
      },
      hasRisk,
    };
  }

  private async calculateConflictStatus(
    tenantId: string,
    changeId: string,
  ): Promise<{ factor: RiskFactor; hasFreezeConflict: boolean }> {
    let hasFreezeConflict = false;
    let rawScore = 0;
    let evidence = 'No scheduling conflicts';

    if (this.conflictRepo) {
      const conflicts = await this.conflictRepo.find({
        where: { tenantId, changeId, isDeleted: false },
      });

      if (conflicts.length > 0) {
        const freezeConflicts = conflicts.filter(
          (c) => c.conflictType === 'FREEZE_WINDOW',
        );
        const overlapConflicts = conflicts.filter(
          (c) => c.conflictType === 'OVERLAP',
        );
        const adjacencyConflicts = conflicts.filter(
          (c) => c.conflictType === 'ADJACENCY',
        );

        hasFreezeConflict = freezeConflicts.length > 0;

        if (hasFreezeConflict) {
          rawScore = 95;
          evidence = `FREEZE WINDOW conflict (${freezeConflicts.length})`;
        } else if (overlapConflicts.length > 0) {
          rawScore = 60 + Math.min(30, overlapConflicts.length * 10);
          evidence = `${overlapConflicts.length} overlapping change(s)`;
        } else if (adjacencyConflicts.length > 0) {
          rawScore = 30 + Math.min(20, adjacencyConflicts.length * 10);
          evidence = `${adjacencyConflicts.length} adjacent change(s) within 30 min`;
        }
      }
    }

    return {
      factor: {
        name: 'Conflict Status',
        weight: FACTOR_WEIGHTS.CONFLICT_STATUS,
        score: rawScore,
        weightedScore: rawScore * FACTOR_WEIGHTS.CONFLICT_STATUS,
        evidence,
      },
      hasFreezeConflict,
    };
  }

  private async calculateTopologyImpactFactor(
    tenantId: string,
    change: ItsmChange,
  ): Promise<{ factor: RiskFactor }> {
    if (!this.topologyImpactService) {
      return {
        factor: {
          name: 'Topology Impact',
          weight: FACTOR_WEIGHTS.TOPOLOGY_IMPACT,
          score: 0,
          weightedScore: 0,
          evidence: 'Topology impact analysis service not available',
        },
      };
    }

    try {
      const { score, evidence } =
        await this.topologyImpactService.getTopologyRiskFactor(
          tenantId,
          change,
        );

      return {
        factor: {
          name: 'Topology Impact',
          weight: FACTOR_WEIGHTS.TOPOLOGY_IMPACT,
          score,
          weightedScore: score * FACTOR_WEIGHTS.TOPOLOGY_IMPACT,
          evidence,
        },
      };
    } catch {
      return {
        factor: {
          name: 'Topology Impact',
          weight: FACTOR_WEIGHTS.TOPOLOGY_IMPACT,
          score: 0,
          weightedScore: 0,
          evidence: 'Topology impact calculation failed (non-blocking)',
        },
      };
    }
  }

  private async calculateCustomerRiskExposure(
    tenantId: string,
    change: ItsmChange,
  ): Promise<{ factor: RiskFactor }> {
    if (!this.customerRiskImpactService) {
      return {
        factor: {
          name: 'Customer Risk Exposure',
          weight: FACTOR_WEIGHTS.CUSTOMER_RISK_EXPOSURE,
          score: 0,
          weightedScore: 0,
          evidence: 'Customer risk impact service not available',
        },
      };
    }

    const impact = await this.customerRiskImpactService.evaluateForChange(
      tenantId,
      change,
      {
        factorWeight: FACTOR_WEIGHTS.CUSTOMER_RISK_EXPOSURE,
      },
    );

    return {
      factor: impact.riskFactor,
    };
  }
}
