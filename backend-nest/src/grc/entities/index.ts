/**
 * GRC Domain Entities
 *
 * Export all GRC entities for use in modules and services.
 */

// Core Entities
export { GrcRisk } from './grc-risk.entity';
export { GrcRiskCategory } from './grc-risk-category.entity';
export { GrcRiskAssessment } from './grc-risk-assessment.entity';
export { GrcControl } from './grc-control.entity';
export { GrcPolicy } from './grc-policy.entity';
export { GrcRequirement } from './grc-requirement.entity';
export { GrcIssue } from './grc-issue.entity';
export { GrcCapa } from './grc-capa.entity';
export { GrcEvidence } from './grc-evidence.entity';
export {
  GrcAudit,
  AuditStatus,
  AuditType,
  AuditRiskLevel,
} from './grc-audit.entity';

// Policy Versioning Entities
export { GrcPolicyVersion } from './grc-policy-version.entity';

// Audit Report Template Entities
export { GrcAuditReportTemplate } from './grc-audit-report-template.entity';
export type { TemplateSectionConfig } from './grc-audit-report-template.entity';

// Metadata System Entities
export { GrcFieldMetadata } from './grc-field-metadata.entity';
export { GrcClassificationTag } from './grc-classification-tag.entity';
export { GrcFieldMetadataTag } from './grc-field-metadata-tag.entity';

// Mapping Entities
export { GrcRiskControl } from './grc-risk-control.entity';
export { GrcPolicyControl } from './grc-policy-control.entity';
export { GrcRequirementControl } from './grc-requirement-control.entity';
export { GrcControlProcess } from './grc-control-process.entity';
export { GrcIssueEvidence } from './grc-issue-evidence.entity';
export { GrcRiskPolicy } from './grc-risk-policy.entity';
export { GrcRiskRequirement } from './grc-risk-requirement.entity';
export {
  GrcAuditRequirement,
  AuditRequirementStatus,
} from './grc-audit-requirement.entity';
export { GrcIssueRequirement } from './grc-issue-requirement.entity';

// History Entities
export {
  GrcRiskHistory,
  GrcPolicyHistory,
  GrcRequirementHistory,
  UserHistory,
} from './history';

// Process Controls Entities (Sprint 5)
export { Process } from './process.entity';
export { ProcessControl } from './process-control.entity';
export { ControlResult } from './control-result.entity';
export { ProcessViolation } from './process-violation.entity';
export { ProcessControlRisk } from './process-control-risk.entity';

// Standards Library Entities (Audit Phase 2)
export { Standard, StandardDomain } from './standard.entity';
export { StandardClause, ClauseLevel } from './standard-clause.entity';
export { AuditScopeStandard, ScopeType } from './audit-scope-standard.entity';
export {
  AuditScopeClause,
  ClauseScopeStatus,
} from './audit-scope-clause.entity';
export { GrcIssueClause } from './grc-issue-clause.entity';

// Framework Activation Entities
export { GrcFramework } from './grc-framework.entity';
export { GrcTenantFramework } from './grc-tenant-framework.entity';

// Golden Flow Phase 1 Entities
export { GrcControlTest } from './grc-control-test.entity';
export { GrcTestResult } from './grc-test-result.entity';
export { GrcCapaTask } from './grc-capa-task.entity';
export { GrcControlEvidence } from './grc-control-evidence.entity';
export { GrcStatusHistory } from './grc-status-history.entity';

// Golden Flow Sprint 1B Entities
export { GrcEvidenceTestResult } from './grc-evidence-test-result.entity';

// Platform Builder Entities
export { SysDbObject } from './sys-db-object.entity';
export { SysDictionary } from './sys-dictionary.entity';
export { DynamicRecord } from './dynamic-record.entity';

// Code Generation Entities
export { TenantSequence } from './tenant-sequence.entity';

// SOA (Statement of Applicability) Entities
export { GrcSoaProfile } from './grc-soa-profile.entity';
export { GrcSoaItem } from './grc-soa-item.entity';
export { GrcSoaItemControl } from './grc-soa-item-control.entity';
export { GrcSoaItemEvidence } from './grc-soa-item-evidence.entity';

// BCM (Business Continuity Management) Entities
export { BcmService } from './bcm-service.entity';
export { BcmBia } from './bcm-bia.entity';
export { BcmPlan } from './bcm-plan.entity';
export { BcmPlanStep } from './bcm-plan-step.entity';
export { BcmExercise } from './bcm-exercise.entity';
