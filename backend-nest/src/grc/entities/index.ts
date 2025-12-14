/**
 * GRC Domain Entities
 *
 * Export all GRC entities for use in modules and services.
 */

// Core Entities
export { GrcRisk } from './grc-risk.entity';
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
export {
  AuditScopeStandard,
  ScopeType,
} from './audit-scope-standard.entity';
export {
  AuditScopeClause,
  ClauseScopeStatus,
} from './audit-scope-clause.entity';
export { GrcIssueClause } from './grc-issue-clause.entity';
