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
export { GrcAudit, AuditStatus, AuditType, AuditRiskLevel } from './grc-audit.entity';

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

// History Entities
export {
  GrcRiskHistory,
  GrcPolicyHistory,
  GrcRequirementHistory,
  UserHistory,
} from './history';
