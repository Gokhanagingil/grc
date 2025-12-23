/**
 * GRC Services
 *
 * Export all GRC services for use in modules and controllers.
 */

// Core GRC Services
export { GrcRiskService } from './grc-risk.service';
export { GrcPolicyService } from './grc-policy.service';
export { GrcRequirementService } from './grc-requirement.service';
export { GrcAuditService } from './grc-audit.service';

// Policy Versioning Services
export { GrcPolicyVersionService } from './grc-policy-version.service';

// Audit Report Template Services
export { GrcAuditReportTemplateService } from './grc-audit-report-template.service';
export type { AuditContext } from './grc-audit-report-template.service';

// Search and Query DSL Services
export { SearchService } from './search.service';
export type {
  SearchQueryDto,
  SearchResultDto,
  SearchableEntity,
} from './search.service';
export { QueryDSLService } from './query-dsl.service';
export type {
  QueryCondition,
  QueryDSL,
  QueryDSLGroup,
} from './query-dsl.service';

// Metadata Services
export { MetadataService } from './metadata.service';

// Process Controls Services (Sprint 5)
export { ProcessService } from './process.service';
export { ProcessControlService } from './process-control.service';
export { ControlResultService } from './control-result.service';
export { ProcessViolationService } from './process-violation.service';
export {
  ProcessComplianceService,
  ComplianceScoreResponse,
  ComplianceOverviewResponse,
} from './process-compliance.service';

// Standards Library Services (Audit Phase 2)
export {
  StandardsService,
  ClauseTreeNode,
  StandardWithClauses,
} from './standards.service';

// Data Model Dictionary Services (Admin Studio FAZ 2)
export {
  DataModelDictionaryService,
  DictionaryFieldType,
  RelationshipType,
  DictionaryField,
  DictionaryRelationship,
  DictionaryTable,
  DotWalkSegment,
  DotWalkPath,
} from './data-model-dictionary.service';
