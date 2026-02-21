import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CustomerRiskBinding } from '../../../grc/entities/customer-risk-binding.entity';
import { CustomerRiskObservation } from '../../../grc/entities/customer-risk-observation.entity';
import { CustomerRiskCatalog } from '../../../grc/entities/customer-risk-catalog.entity';
import { CmdbServiceCi } from '../../cmdb/service-ci/cmdb-service-ci.entity';
import { CmdbCiRel } from '../../cmdb/ci-rel/ci-rel.entity';
import { ItsmChange } from '../change.entity';
import { RiskFactor } from './risk-assessment.entity';

export type RelevancePath =
  | 'service_binding'
  | 'offering_binding'
  | 'affected_ci'
  | 'blast_radius_ci';

export interface ResolvedCustomerRisk {
  catalogRiskId: string;
  title: string;
  code: string | null;
  category: string;
  severity: string;
  likelihoodWeight: number;
  impactWeight: number;
  scoreContributionModel: string;
  scoreValue: number;
  status: string;
  remediationGuidance: string | null;
  relevancePaths: RelevancePath[];
  activeObservationCount: number;
  latestObservationStatus: string | null;
  contributionScore: number;
  contributionReason: string;
}

export interface CustomerRiskImpactResult {
  changeId: string;
  resolvedRisks: ResolvedCustomerRisk[];
  aggregateScore: number;
  aggregateLabel: string;
  topReasons: string[];
  calculatedAt: string;
  riskFactor: RiskFactor;
}

const DEFAULT_FACTOR_WEIGHT = 14;

const SEVERITY_SCORES: Record<string, number> = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
};

const OBSERVATION_STATUS_MULTIPLIERS: Record<string, number> = {
  OPEN: 1.0,
  ACKNOWLEDGED: 0.8,
  WAIVED: 0.2,
  RESOLVED: 0.0,
  EXPIRED: 0.1,
};

const PATH_WEIGHT: Record<RelevancePath, number> = {
  service_binding: 1.0,
  offering_binding: 0.9,
  affected_ci: 0.8,
  blast_radius_ci: 0.6,
};

function aggregateLabelFromScore(score: number): string {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

@Injectable()
export class CustomerRiskImpactService {
  constructor(
    @Optional()
    @InjectRepository(CustomerRiskBinding)
    private readonly bindingRepo?: Repository<CustomerRiskBinding>,
    @Optional()
    @InjectRepository(CustomerRiskObservation)
    private readonly observationRepo?: Repository<CustomerRiskObservation>,
    @Optional()
    @InjectRepository(CmdbServiceCi)
    private readonly serviceCiRepo?: Repository<CmdbServiceCi>,
    @Optional()
    @InjectRepository(CmdbCiRel)
    private readonly ciRelRepo?: Repository<CmdbCiRel>,
  ) {}

  async evaluateForChange(
    tenantId: string,
    change: ItsmChange,
    opts?: { factorWeight?: number },
  ): Promise<CustomerRiskImpactResult> {
    const factorWeight = opts?.factorWeight ?? DEFAULT_FACTOR_WEIGHT;
    const resolvedRisks = await this.resolveRelevantRisks(tenantId, change);

    for (const risk of resolvedRisks) {
      const obs = await this.getObservations(tenantId, risk.catalogRiskId);
      risk.activeObservationCount = obs.filter(
        (o) => o.status === 'OPEN' || o.status === 'ACKNOWLEDGED',
      ).length;
      risk.latestObservationStatus = obs.length > 0 ? obs[0].status : null;

      const { score, reason } = this.calculateContribution(risk);
      risk.contributionScore = score;
      risk.contributionReason = reason;
    }

    resolvedRisks.sort((a, b) => b.contributionScore - a.contributionScore);

    const aggregateScore = this.calculateAggregateScore(resolvedRisks);
    const aggregateLabel = aggregateLabelFromScore(aggregateScore);

    const topReasons = this.generateTopReasons(resolvedRisks);

    const riskFactor = this.buildRiskFactor(
      aggregateScore,
      resolvedRisks,
      factorWeight,
    );

    return {
      changeId: change.id,
      resolvedRisks,
      aggregateScore,
      aggregateLabel,
      topReasons,
      calculatedAt: new Date().toISOString(),
      riskFactor,
    };
  }

  private async resolveRelevantRisks(
    tenantId: string,
    change: ItsmChange,
  ): Promise<ResolvedCustomerRisk[]> {
    const riskMap = new Map<string, ResolvedCustomerRisk>();

    if (change.serviceId) {
      await this.resolveServiceBindings(tenantId, change.serviceId, riskMap);
    }

    if (change.offeringId) {
      await this.resolveOfferingBindings(tenantId, change.offeringId, riskMap);
    }

    if (change.serviceId) {
      await this.resolveCiBindings(tenantId, change.serviceId, riskMap);
    }

    return Array.from(riskMap.values());
  }

  private async resolveServiceBindings(
    tenantId: string,
    serviceId: string,
    riskMap: Map<string, ResolvedCustomerRisk>,
  ): Promise<void> {
    if (!this.bindingRepo) return;

    const bindings = await this.bindingRepo.find({
      where: {
        tenantId,
        targetType: 'CMDB_SERVICE',
        targetId: serviceId,
        enabled: true,
        isDeleted: false,
      },
      relations: ['catalogRisk'],
    });

    for (const binding of bindings) {
      if (
        !binding.catalogRisk ||
        binding.catalogRisk.isDeleted ||
        binding.catalogRisk.status !== 'ACTIVE'
      )
        continue;
      this.addOrMergeRisk(riskMap, binding.catalogRisk, 'service_binding');
    }
  }

  private async resolveOfferingBindings(
    tenantId: string,
    offeringId: string,
    riskMap: Map<string, ResolvedCustomerRisk>,
  ): Promise<void> {
    if (!this.bindingRepo) return;

    const bindings = await this.bindingRepo.find({
      where: {
        tenantId,
        targetType: 'CMDB_OFFERING',
        targetId: offeringId,
        enabled: true,
        isDeleted: false,
      },
      relations: ['catalogRisk'],
    });

    for (const binding of bindings) {
      if (
        !binding.catalogRisk ||
        binding.catalogRisk.isDeleted ||
        binding.catalogRisk.status !== 'ACTIVE'
      )
        continue;
      this.addOrMergeRisk(riskMap, binding.catalogRisk, 'offering_binding');
    }
  }

  private async resolveCiBindings(
    tenantId: string,
    serviceId: string,
    riskMap: Map<string, ResolvedCustomerRisk>,
  ): Promise<void> {
    if (!this.serviceCiRepo || !this.bindingRepo) return;

    const serviceCis = await this.serviceCiRepo.find({
      where: { tenantId, serviceId },
    });

    if (serviceCis.length === 0) return;

    const directCiIds = serviceCis.map((sc) => sc.ciId);

    const ciBindings = await this.bindingRepo.find({
      where: {
        tenantId,
        targetType: 'CI',
        targetId: In(directCiIds),
        enabled: true,
        isDeleted: false,
      },
      relations: ['catalogRisk'],
    });

    for (const binding of ciBindings) {
      if (
        !binding.catalogRisk ||
        binding.catalogRisk.isDeleted ||
        binding.catalogRisk.status !== 'ACTIVE'
      )
        continue;
      this.addOrMergeRisk(riskMap, binding.catalogRisk, 'affected_ci');
    }

    const blastRadiusCiIds = await this.resolveBlastRadiusCiIds(
      tenantId,
      directCiIds,
    );
    if (blastRadiusCiIds.length > 0) {
      const blastBindings = await this.bindingRepo.find({
        where: {
          tenantId,
          targetType: 'CI',
          targetId: In(blastRadiusCiIds),
          enabled: true,
          isDeleted: false,
        },
        relations: ['catalogRisk'],
      });

      for (const binding of blastBindings) {
        if (
          !binding.catalogRisk ||
          binding.catalogRisk.isDeleted ||
          binding.catalogRisk.status !== 'ACTIVE'
        )
          continue;
        this.addOrMergeRisk(riskMap, binding.catalogRisk, 'blast_radius_ci');
      }
    }
  }

  private async resolveBlastRadiusCiIds(
    tenantId: string,
    directCiIds: string[],
  ): Promise<string[]> {
    if (!this.ciRelRepo || directCiIds.length === 0) return [];

    const relatedIds = new Set<string>();
    const directIdSet = new Set(directCiIds);

    for (const ciId of directCiIds) {
      const rels = await this.ciRelRepo.find({
        where: [
          { tenantId, sourceCiId: ciId, isActive: true },
          { tenantId, targetCiId: ciId, isActive: true },
        ],
      });

      for (const rel of rels) {
        const relatedCiId =
          rel.sourceCiId === ciId ? rel.targetCiId : rel.sourceCiId;
        if (!directIdSet.has(relatedCiId)) {
          relatedIds.add(relatedCiId);
        }
      }
    }

    return Array.from(relatedIds);
  }

  private addOrMergeRisk(
    riskMap: Map<string, ResolvedCustomerRisk>,
    catalog: CustomerRiskCatalog,
    path: RelevancePath,
  ): void {
    const existing = riskMap.get(catalog.id);
    if (existing) {
      if (!existing.relevancePaths.includes(path)) {
        existing.relevancePaths.push(path);
      }
      return;
    }

    riskMap.set(catalog.id, {
      catalogRiskId: catalog.id,
      title: catalog.title,
      code: catalog.code,
      category: catalog.category,
      severity: catalog.severity,
      likelihoodWeight: catalog.likelihoodWeight,
      impactWeight: catalog.impactWeight,
      scoreContributionModel: catalog.scoreContributionModel,
      scoreValue: Number(catalog.scoreValue),
      status: catalog.status,
      remediationGuidance: catalog.remediationGuidance,
      relevancePaths: [path],
      activeObservationCount: 0,
      latestObservationStatus: null,
      contributionScore: 0,
      contributionReason: '',
    });
  }

  private async getObservations(
    tenantId: string,
    catalogRiskId: string,
  ): Promise<CustomerRiskObservation[]> {
    if (!this.observationRepo) return [];

    return this.observationRepo.find({
      where: {
        tenantId,
        catalogRiskId,
        isDeleted: false,
      },
      order: { observedAt: 'DESC' },
      take: 50,
    });
  }

  private calculateContribution(risk: ResolvedCustomerRisk): {
    score: number;
    reason: string;
  } {
    const baseSeverity = SEVERITY_SCORES[risk.severity] ?? 50;

    let obsMultiplier = 1.0;
    if (risk.latestObservationStatus) {
      obsMultiplier =
        OBSERVATION_STATUS_MULTIPLIERS[risk.latestObservationStatus] ?? 0.5;
    }

    const obsCountBoost = Math.min(risk.activeObservationCount * 5, 20);

    let pathMultiplier = 0;
    for (const p of risk.relevancePaths) {
      const w = PATH_WEIGHT[p] ?? 0.5;
      if (w > pathMultiplier) pathMultiplier = w;
    }

    let contribution: number;
    switch (risk.scoreContributionModel) {
      case 'FLAT_POINTS':
        contribution = Number(risk.scoreValue) || baseSeverity;
        break;
      case 'WEIGHTED_FACTOR':
        contribution = (risk.likelihoodWeight * risk.impactWeight) / 100;
        break;
      case 'MULTIPLIER':
        contribution = baseSeverity * (Number(risk.scoreValue) / 100 || 1);
        break;
      default:
        contribution = baseSeverity;
    }

    const finalScore = Math.round(
      Math.min(
        100,
        contribution * obsMultiplier * pathMultiplier + obsCountBoost,
      ),
    );

    const reasons: string[] = [];
    reasons.push(`${risk.severity} severity (base: ${baseSeverity})`);
    if (risk.latestObservationStatus) {
      reasons.push(`latest observation: ${risk.latestObservationStatus}`);
    }
    if (risk.activeObservationCount > 0) {
      reasons.push(`${risk.activeObservationCount} active observation(s)`);
    }
    reasons.push(`via ${risk.relevancePaths.join(', ')}`);

    return {
      score: finalScore,
      reason: reasons.join('; '),
    };
  }

  private calculateAggregateScore(risks: ResolvedCustomerRisk[]): number {
    if (risks.length === 0) return 0;

    const maxContribution = Math.max(...risks.map((r) => r.contributionScore));

    const avgContribution =
      risks.reduce((sum, r) => sum + r.contributionScore, 0) / risks.length;

    const countPenalty = Math.min(risks.length * 3, 15);

    return Math.round(
      Math.min(
        100,
        maxContribution * 0.6 + avgContribution * 0.3 + countPenalty,
      ),
    );
  }

  private generateTopReasons(risks: ResolvedCustomerRisk[]): string[] {
    const reasons: string[] = [];

    if (risks.length === 0) {
      reasons.push(
        'No active customer risks detected for this change context.',
      );
      return reasons;
    }

    const criticalCount = risks.filter((r) => r.severity === 'CRITICAL').length;
    const highCount = risks.filter((r) => r.severity === 'HIGH').length;
    const openObsCount = risks.reduce(
      (sum, r) => sum + r.activeObservationCount,
      0,
    );

    reasons.push(
      `${risks.length} customer risk(s) detected across affected service/CIs`,
    );

    if (criticalCount > 0) {
      reasons.push(
        `${criticalCount} CRITICAL risk(s): ${risks
          .filter((r) => r.severity === 'CRITICAL')
          .map((r) => r.title)
          .join(', ')}`,
      );
    }

    if (highCount > 0) {
      reasons.push(
        `${highCount} HIGH risk(s): ${risks
          .filter((r) => r.severity === 'HIGH')
          .map((r) => r.title)
          .join(', ')}`,
      );
    }

    if (openObsCount > 0) {
      reasons.push(`${openObsCount} active observation(s) across all risks`);
    }

    const topRisk = risks[0];
    if (topRisk) {
      reasons.push(
        `Top contributor: "${topRisk.title}" (score: ${topRisk.contributionScore}, via ${topRisk.relevancePaths.join(', ')})`,
      );
    }

    return reasons;
  }

  private buildRiskFactor(
    aggregateScore: number,
    risks: ResolvedCustomerRisk[],
    weight: number,
  ): RiskFactor {
    let evidence: string;
    if (risks.length === 0) {
      evidence = 'No customer risks bound to affected service/CIs';
    } else {
      const critCount = risks.filter((r) => r.severity === 'CRITICAL').length;
      const highCount = risks.filter((r) => r.severity === 'HIGH').length;
      evidence = `${risks.length} customer risk(s) (${critCount} critical, ${highCount} high) — aggregate exposure: ${aggregateLabelFromScore(aggregateScore)}`;
    }

    return {
      name: 'Customer Risk Exposure',
      weight,
      score: aggregateScore,
      weightedScore: aggregateScore * weight,
      evidence,
    };
  }
}
