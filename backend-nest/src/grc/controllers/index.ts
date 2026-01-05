/**
 * GRC Controllers
 *
 * Export all GRC controllers for use in modules.
 */

// Core GRC Controllers
export { GrcRiskController } from './grc-risk.controller';
export { GrcPolicyController } from './grc-policy.controller';
export { GrcRequirementController } from './grc-requirement.controller';
export { GrcAuditController } from './grc-audit.controller';

// Policy Versioning Controllers
export { GrcPolicyVersionController } from './grc-policy-version.controller';

// Audit Report Template Controllers
export { AuditReportTemplateController } from './audit-report-template.controller';

// Search Controllers
export { SearchController } from './search.controller';

// Metadata Controllers
export { MetadataController } from './metadata.controller';

// Process Controls Controllers (Sprint 5)
export { ProcessController } from './process.controller';
export { ProcessControlController } from './process-control.controller';
export { ControlResultController } from './control-result.controller';
export { ProcessViolationController } from './process-violation.controller';

// Standards Library Controllers (Audit Phase 2)
export { StandardController } from './standard.controller';
export { StandardClauseController } from './standard-clause.controller';
export { GrcIssueController } from './grc-issue.controller';
export {
  StandardsController,
  AuditScopeController,
} from './standards.controller';

// Data Model Dictionary Controllers (Admin Studio FAZ 2)
export { DataModelDictionaryController } from './data-model-dictionary.controller';

// Framework Activation Controllers
export {
  GrcFrameworksController,
  TenantFrameworksController,
} from './grc-frameworks.controller';
