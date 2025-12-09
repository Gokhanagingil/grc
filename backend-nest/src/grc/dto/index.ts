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
