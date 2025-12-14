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
export { StandardsController, AuditScopeController } from './standards.controller';
