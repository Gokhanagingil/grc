/**
 * GRC DTOs
 *
 * Data Transfer Objects for GRC CRUD operations.
 */

// Pagination & Common DTOs
export {
  PaginationQueryDto,
  PaginatedResponse,
  createPaginatedResponse,
} from './pagination.dto';

// Risk DTOs
export { CreateRiskDto } from './create-risk.dto';
export { UpdateRiskDto } from './update-risk.dto';
export { RiskFilterDto, RISK_SORTABLE_FIELDS } from './filter-risk.dto';
export { CreateRiskCategoryDto } from './create-risk-category.dto';
export { UpdateRiskCategoryDto } from './update-risk-category.dto';
export { CreateRiskAssessmentDto } from './create-risk-assessment.dto';
export {
  LinkRiskControlDto,
  UpdateRiskControlLinkDto,
  UpdateEffectivenessOverrideDto,
} from './link-risk-control.dto';

// Policy DTOs
export { CreatePolicyDto } from './create-policy.dto';
export { UpdatePolicyDto } from './update-policy.dto';
export { PolicyFilterDto, POLICY_SORTABLE_FIELDS } from './filter-policy.dto';

// Requirement DTOs
export { CreateRequirementDto } from './create-requirement.dto';
export { UpdateRequirementDto } from './update-requirement.dto';
export {
  RequirementFilterDto,
  REQUIREMENT_SORTABLE_FIELDS,
} from './filter-requirement.dto';

// Audit DTOs
export { CreateAuditDto } from './create-audit.dto';
export { UpdateAuditDto } from './update-audit.dto';
export { AuditFilterDto, AUDIT_SORTABLE_FIELDS } from './filter-audit.dto';

// Relationship DTOs
export { LinkPoliciesDto } from './link-policies.dto';
export { LinkRequirementsDto } from './link-requirements.dto';

// Process DTOs (Sprint 5)
export { CreateProcessDto } from './create-process.dto';
export { UpdateProcessDto } from './update-process.dto';
export {
  ProcessFilterDto,
  PROCESS_SORTABLE_FIELDS,
} from './filter-process.dto';

// ProcessControl DTOs (Sprint 5)
export { CreateProcessControlDto } from './create-process-control.dto';
export { UpdateProcessControlDto } from './update-process-control.dto';
export {
  ProcessControlFilterDto,
  PROCESS_CONTROL_SORTABLE_FIELDS,
} from './filter-process-control.dto';
export { LinkRisksToControlDto } from './link-risks-to-control.dto';

// Control DTOs
export { UpdateControlDto } from './update-control.dto';

// ControlResult DTOs (Sprint 5)
export { CreateControlResultDto } from './create-control-result.dto';
export {
  ControlResultFilterDto,
  CONTROL_RESULT_SORTABLE_FIELDS,
} from './filter-control-result.dto';

// ProcessViolation DTOs (Sprint 5)
export {
  UpdateProcessViolationDto,
  LinkRiskDto,
} from './update-process-violation.dto';
export {
  ProcessViolationFilterDto,
  PROCESS_VIOLATION_SORTABLE_FIELDS,
} from './filter-process-violation.dto';

// Standard DTOs
export { CreateStandardDto } from './create-standard.dto';

// Platform Builder DTOs
export {
  CreateTableDto,
  UpdateTableDto,
  TableFilterDto,
  ChoiceOptionDto,
  CreateFieldDto,
  UpdateFieldDto,
  FieldFilterDto,
  CreateRecordDto,
  UpdateRecordDto,
  RecordFilterDto,
  CreateRelationshipDto,
  RelationshipFilterDto,
} from './platform-builder.dto';
export type {
  TableResponse,
  FieldResponse,
  RecordResponse,
  RelationshipResponse,
} from './platform-builder.dto';

// Generic Query (Phase 3) DTOs
export {
  GenericQueryDto,
  FilterConditionDto,
  FilterGroupDto,
} from './generic-query.dto';
export type { GenericQueryResult } from './generic-query.dto';

// SOA (Statement of Applicability) DTOs
export {
  CreateSoaProfileDto,
  UpdateSoaProfileDto,
  FilterSoaProfileDto,
  UpdateSoaItemDto,
  FilterSoaItemDto,
  SOA_PROFILE_SORTABLE_FIELDS,
  SOA_ITEM_SORTABLE_FIELDS,
} from './soa.dto';

// BCM (Business Continuity Management) DTOs
export {
  CreateBcmServiceDto,
  UpdateBcmServiceDto,
  BcmServiceFilterDto,
  CreateBcmBiaDto,
  UpdateBcmBiaDto,
  BcmBiaFilterDto,
  CreateBcmPlanDto,
  UpdateBcmPlanDto,
  BcmPlanFilterDto,
  CreateBcmPlanStepDto,
  UpdateBcmPlanStepDto,
  BcmPlanStepFilterDto,
  CreateBcmExerciseDto,
  UpdateBcmExerciseDto,
  BcmExerciseFilterDto,
} from './bcm.dto';

// Risk Treatment Action DTOs
export {
  CreateTreatmentActionDto,
  UpdateTreatmentActionDto,
} from './treatment-action.dto';

// ITSM (IT Service Management) DTOs - ITIL v5 aligned
export {
  CreateItsmServiceDto,
  UpdateItsmServiceDto,
  ItsmServiceFilterDto,
  CreateItsmIncidentDto,
  UpdateItsmIncidentDto,
  ItsmIncidentFilterDto,
  CreateItsmChangeDto,
  UpdateItsmChangeDto,
  ItsmChangeFilterDto,
  LinkItsmGrcDto,
} from './itsm.dto';
