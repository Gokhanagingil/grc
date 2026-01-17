/**
 * List Options Controller
 *
 * API endpoint for exposing entity-specific list options (sortable fields,
 * filterable fields, searchable fields) to the frontend.
 *
 * This enables the frontend to dynamically build sort dropdowns and filter
 * builders based on the backend allowlist configuration.
 */

import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { Perf } from '../../common/decorators';
import {
  getEntityAllowlist,
  getRegisteredEntities,
  CONTROL_SEARCHABLE_COLUMNS,
  ISSUE_SEARCHABLE_COLUMNS,
  CAPA_SEARCHABLE_COLUMNS,
  EVIDENCE_SEARCHABLE_COLUMNS,
} from '../../common/list-query/list-query.allowlist';
import { FieldDefinition } from '../../common/list-query/list-query.types';

/**
 * Response DTO for list options
 */
interface ListOptionsResponse {
  entity: string;
  sortableFields: SortableField[];
  filterableFields: FilterableField[];
  searchableFields: string[];
}

interface SortableField {
  name: string;
  label: string;
  type: string;
}

interface FilterableField {
  name: string;
  label: string;
  type: string;
  enumValues?: string[];
  enumLabels?: Record<string, string>;
}

/**
 * Map of entity names to their searchable columns
 */
const SEARCHABLE_COLUMNS_MAP: Record<string, { column: string }[]> = {
  control: CONTROL_SEARCHABLE_COLUMNS,
  controls: CONTROL_SEARCHABLE_COLUMNS,
  issue: ISSUE_SEARCHABLE_COLUMNS,
  issues: ISSUE_SEARCHABLE_COLUMNS,
  capa: CAPA_SEARCHABLE_COLUMNS,
  capas: CAPA_SEARCHABLE_COLUMNS,
  evidence: EVIDENCE_SEARCHABLE_COLUMNS,
};

/**
 * Human-readable labels for field names
 */
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  code: 'Code',
  title: 'Title',
  description: 'Description',
  status: 'Status',
  type: 'Type',
  severity: 'Severity',
  priority: 'Priority',
  source: 'Source',
  frequency: 'Frequency',
  implementationType: 'Implementation Type',
  lastTestResult: 'Last Test Result',
  rootCauseAnalysis: 'Root Cause Analysis',
  location: 'Location',
  createdAt: 'Created At',
  updatedAt: 'Updated At',
  dueDate: 'Due Date',
  discoveredDate: 'Discovered Date',
  resolvedDate: 'Resolved Date',
  completedDate: 'Completed Date',
  verifiedAt: 'Verified At',
  closedAt: 'Closed At',
  effectiveDate: 'Effective Date',
  lastTestedDate: 'Last Tested Date',
  nextTestDate: 'Next Test Date',
  collectedDate: 'Collected Date',
  expiresAt: 'Expires At',
  controlId: 'Control',
  auditId: 'Audit',
  testResultId: 'Test Result',
  riskId: 'Risk',
  issueId: 'Issue',
  ownerUserId: 'Owner',
};

/**
 * Human-readable labels for enum values
 */
const ENUM_LABELS: Record<string, Record<string, string>> = {
  status: {
    draft: 'Draft',
    in_design: 'In Design',
    implemented: 'Implemented',
    inoperative: 'Inoperative',
    retired: 'Retired',
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
    rejected: 'Rejected',
    planned: 'Planned',
    verified: 'Verified',
    cancelled: 'Cancelled',
    submitted: 'Submitted',
    approved: 'Approved',
  },
  type: {
    preventive: 'Preventive',
    detective: 'Detective',
    corrective: 'Corrective',
    internal_audit: 'Internal Audit',
    external_audit: 'External Audit',
    incident: 'Incident',
    self_assessment: 'Self Assessment',
    other: 'Other',
    both: 'Both',
    BASELINE: 'Baseline',
    TEST: 'Test',
    PERIODIC: 'Periodic',
  },
  severity: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  },
  priority: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  },
  source: {
    manual: 'Manual',
    test_result: 'Test Result',
    audit: 'Audit',
    incident: 'Incident',
    external: 'External',
  },
  implementationType: {
    manual: 'Manual',
    automated: 'Automated',
    it_dependent: 'IT Dependent',
  },
  frequency: {
    continuous: 'Continuous',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    annual: 'Annual',
  },
  lastTestResult: {
    PASS: 'Pass',
    FAIL: 'Fail',
    INCONCLUSIVE: 'Inconclusive',
    NOT_APPLICABLE: 'Not Applicable',
  },
};

/**
 * Convert a FieldDefinition to a SortableField
 */
function toSortableField(field: FieldDefinition): SortableField {
  return {
    name: field.name,
    label: FIELD_LABELS[field.name] || formatFieldName(field.name),
    type: field.type,
  };
}

/**
 * Convert a FieldDefinition to a FilterableField
 */
function toFilterableField(field: FieldDefinition): FilterableField {
  const result: FilterableField = {
    name: field.name,
    label: FIELD_LABELS[field.name] || formatFieldName(field.name),
    type: field.type,
  };

  if (field.enumValues) {
    result.enumValues = field.enumValues;
    result.enumLabels = ENUM_LABELS[field.name] || {};
  }

  return result;
}

/**
 * Format a camelCase field name to a human-readable label
 */
function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * List Options Controller
 *
 * Exposes entity allowlist configuration to the frontend for building
 * dynamic sort dropdowns and filter builders.
 */
@Controller('grc/meta')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ListOptionsController {
  /**
   * GET /grc/meta/list-options
   * Get all registered entities
   */
  @Get('list-options')
  @Perf()
  getRegisteredEntities() {
    const entities = getRegisteredEntities();
    return {
      success: true,
      data: {
        entities,
      },
    };
  }

  /**
   * GET /grc/meta/list-options/:entity
   * Get list options for a specific entity
   */
  @Get('list-options/:entity')
  @Perf()
  getListOptions(@Param('entity') entity: string): {
    success: boolean;
    data: ListOptionsResponse;
  } {
    const normalizedEntity = entity.toLowerCase();
    const allowlist = getEntityAllowlist(normalizedEntity);

    if (!allowlist) {
      throw new NotFoundException(
        `Entity '${entity}' not found. Available entities: ${getRegisteredEntities().join(', ')}`,
      );
    }

    const searchableColumns = SEARCHABLE_COLUMNS_MAP[normalizedEntity] || [];

    const sortableFields = allowlist.fields
      .filter((f) => ['string', 'date', 'number', 'enum'].includes(f.type))
      .map(toSortableField);

    const filterableFields = allowlist.fields.map(toFilterableField);

    const searchableFields = searchableColumns.map((c) => c.column);

    return {
      success: true,
      data: {
        entity: allowlist.entityName,
        sortableFields,
        filterableFields,
        searchableFields,
      },
    };
  }
}
