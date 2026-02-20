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
export { GrcControlController } from './grc-control.controller';
export { GrcEvidenceController } from './grc-evidence.controller';
export { GrcCapaController } from './grc-capa.controller';
export { GrcCoverageController } from './grc-coverage.controller';

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

// Dotwalking Query Builder Controllers
export { DotWalkingController } from './dotwalking.controller';

// Framework Activation Controllers
export {
  GrcFrameworksController,
  TenantFrameworksController,
} from './grc-frameworks.controller';

// Platform Controllers (Universal Views)
export { PlatformController } from './platform.controller';

// List Options Controller (List Toolbar Standard)
export { ListOptionsController } from './list-options.controller';

// Export Controller (CSV Export with XSS protection)
export { ExportController } from './export.controller';

// BCM (Business Continuity Management) Controllers
export { BcmController } from './bcm.controller';

// Calendar Controllers
export { CalendarController } from './calendar.controller';

// NOTE: ITSM controllers (ItsmServiceController, ItsmChangeController) are no longer
// exported here. Canonical ITSM controllers live in ItsmModule (src/itsm/).
// The files in this directory are kept for GRC Bridge reference only.
