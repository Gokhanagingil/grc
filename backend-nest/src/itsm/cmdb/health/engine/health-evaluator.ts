import {
  HealthRuleType,
  HealthRuleCondition,
} from '../cmdb-health-rule.entity';

export interface CiRecord {
  id: string;
  name: string;
  ownedBy: string | null;
  managedBy: string | null;
  description: string | null;
  classId: string;
  lifecycle: string;
  updatedAt: Date;
}

export interface CiRelationshipCount {
  ciId: string;
  count: number;
}

export interface ServiceOfferingCount {
  serviceId: string;
  count: number;
}

export interface EvaluationFinding {
  ciId: string;
  details: Record<string, unknown>;
}

export function evaluateRule(
  condition: HealthRuleCondition,
  cis: CiRecord[],
  relationshipCounts: Map<string, number>,
  serviceOfferingCounts: Map<string, number>,
): EvaluationFinding[] {
  switch (condition.type) {
    case HealthRuleType.MISSING_OWNER:
      return evaluateMissingOwner(cis);
    case HealthRuleType.STALE_CI:
      return evaluateStaleCi(cis, condition.params);
    case HealthRuleType.NO_RELATIONSHIPS:
      return evaluateNoRelationships(cis, relationshipCounts);
    case HealthRuleType.MISSING_DESCRIPTION:
      return evaluateMissingDescription(cis);
    case HealthRuleType.MISSING_CLASS:
      return evaluateMissingClass(cis);
    case HealthRuleType.SERVICE_NO_OFFERING:
      return evaluateServiceNoOffering(cis, serviceOfferingCounts);
    case HealthRuleType.CUSTOM:
      return [];
    default:
      return [];
  }
}

function evaluateMissingOwner(cis: CiRecord[]): EvaluationFinding[] {
  return cis
    .filter((ci) => !ci.ownedBy && !ci.managedBy)
    .map((ci) => ({
      ciId: ci.id,
      details: {
        reason: 'CI has no owner or manager assigned',
        ciName: ci.name,
      },
    }));
}

function evaluateStaleCi(
  cis: CiRecord[],
  params?: Record<string, unknown>,
): EvaluationFinding[] {
  const maxDays = typeof params?.maxDays === 'number' ? params.maxDays : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);

  return cis
    .filter((ci) => ci.updatedAt < cutoff)
    .map((ci) => ({
      ciId: ci.id,
      details: {
        reason: `CI not updated in ${maxDays} days`,
        lastUpdated: ci.updatedAt.toISOString(),
        ciName: ci.name,
      },
    }));
}

function evaluateNoRelationships(
  cis: CiRecord[],
  relationshipCounts: Map<string, number>,
): EvaluationFinding[] {
  return cis
    .filter(
      (ci) =>
        !relationshipCounts.has(ci.id) || relationshipCounts.get(ci.id) === 0,
    )
    .map((ci) => ({
      ciId: ci.id,
      details: { reason: 'CI has no relationships defined', ciName: ci.name },
    }));
}

function evaluateMissingDescription(cis: CiRecord[]): EvaluationFinding[] {
  return cis
    .filter((ci) => !ci.description || ci.description.trim().length === 0)
    .map((ci) => ({
      ciId: ci.id,
      details: { reason: 'CI has no description', ciName: ci.name },
    }));
}

function evaluateMissingClass(cis: CiRecord[]): EvaluationFinding[] {
  return cis
    .filter((ci) => !ci.classId)
    .map((ci) => ({
      ciId: ci.id,
      details: { reason: 'CI has no class assigned', ciName: ci.name },
    }));
}

function evaluateServiceNoOffering(
  cis: CiRecord[],
  serviceOfferingCounts: Map<string, number>,
): EvaluationFinding[] {
  return cis
    .filter(
      (ci) =>
        ci.lifecycle === 'service' &&
        (!serviceOfferingCounts.has(ci.id) ||
          serviceOfferingCounts.get(ci.id) === 0),
    )
    .map((ci) => ({
      ciId: ci.id,
      details: {
        reason: 'Service CI has no service offerings',
        ciName: ci.name,
      },
    }));
}

export function calculateQualityScore(
  totalCis: number,
  openFindings: number,
): number {
  if (totalCis === 0) return 100;
  const ratio = openFindings / totalCis;
  const score = Math.max(0, (1 - ratio) * 100);
  return Math.round(score * 100) / 100;
}
