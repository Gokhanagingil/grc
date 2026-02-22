/**
 * GRC API Client
 * 
 * Centralized API client layer for all GRC/ITSM domain operations.
 * This module provides typed API endpoints and handles the path mapping
 * between frontend and NestJS backend.
 * 
 * All endpoints are defined here to avoid hardcoding paths in multiple components.
 */

import { api } from './api';
import { AxiosRequestConfig } from 'axios';

// ============================================================================
// API Endpoint Paths
// ============================================================================

/**
 * NestJS backend endpoint paths
 * These paths are relative to the API base URL
 */
export const API_PATHS = {
  // Auth endpoints (Express backend at /api/auth)
  AUTH: {
    LOGIN: '/auth/login',
    ME: '/auth/me', // Express backend uses /auth/me
    REFRESH: '/auth/refresh',
    REGISTER: '/auth/register',
  },

  // GRC Risk endpoints (NestJS backend at /grc/risks)
    GRC_RISKS: {
      LIST: '/grc/risks',
      CREATE: '/grc/risks',
      GET: (id: string) => `/grc/risks/${id}`,
      UPDATE: (id: string) => `/grc/risks/${id}`,
      DELETE: (id: string) => `/grc/risks/${id}`,
      SUMMARY: '/grc/risks/summary',
      STATISTICS: '/grc/risks/statistics',
      HIGH_SEVERITY: '/grc/risks/high-severity',
      HEATMAP: '/grc/risks/heatmap',
      DETAIL: (id: string) => `/grc/risks/${id}/detail`,
      CONTROLS: (id: string) => `/grc/risks/${id}/controls`,
      CONTROLS_LIST: (id: string) => `/grc/risks/${id}/controls/list`,
      LINK_CONTROL: (riskId: string, controlId: string) => `/grc/risks/${riskId}/controls/${controlId}`,
      LINK_CONTROL_WITH_EFFECTIVENESS: (riskId: string, controlId: string) => `/grc/risks/${riskId}/controls/${controlId}/link`,
      UPDATE_CONTROL_EFFECTIVENESS: (riskId: string, controlId: string) => `/grc/risks/${riskId}/controls/${controlId}/effectiveness`,
      UPDATE_EFFECTIVENESS_OVERRIDE: (riskId: string, controlId: string) => `/grc/risks/${riskId}/controls/${controlId}/effectiveness-override`,
      POLICIES: (id: string) => `/grc/risks/${id}/policies`,
      LINK_POLICY: (riskId: string, policyId: string) => `/grc/risks/${riskId}/policies/${policyId}`,
      REQUIREMENTS: (id: string) => `/grc/risks/${id}/requirements`,
      ASSESSMENTS: (id: string) => `/grc/risks/${id}/assessments`,
      // Treatment Plan endpoints
      TREATMENT_ACTIONS: (riskId: string) => `/grc/risks/${riskId}/treatment/actions`,
      TREATMENT_ACTION: (riskId: string, actionId: string) => `/grc/risks/${riskId}/treatment/actions/${actionId}`,
      TREATMENT_SUMMARY: (riskId: string) => `/grc/risks/${riskId}/treatment/summary`,
      // Risk Appetite endpoints
      ABOVE_APPETITE: '/grc/risks/above-appetite',
      STATS_WITH_APPETITE: '/grc/risks/stats-with-appetite',
      // Residual Risk calculation endpoints
      RECALCULATE_RESIDUAL: (riskId: string) => `/grc/risks/${riskId}/recalculate-residual`,
      CONTROLS_EFFECTIVENESS: (riskId: string) => `/grc/risks/${riskId}/controls/effectiveness`,
    },

  // GRC Policy endpoints (NestJS backend at /grc/policies)
  GRC_POLICIES: {
    LIST: '/grc/policies',
    CREATE: '/grc/policies',
    GET: (id: string) => `/grc/policies/${id}`,
    UPDATE: (id: string) => `/grc/policies/${id}`,
    DELETE: (id: string) => `/grc/policies/${id}`,
    SUMMARY: '/grc/policies/summary',
    STATISTICS: '/grc/policies/statistics',
    ACTIVE: '/grc/policies/active',
    DUE_FOR_REVIEW: '/grc/policies/due-for-review',
    CONTROLS: (id: string) => `/grc/policies/${id}/controls`,
    RISKS: (id: string) => `/grc/policies/${id}/risks`,
    // Policy Version endpoints
    VERSIONS: {
      LIST: (policyId: string) => `/grc/policies/${policyId}/versions`,
      GET: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}`,
      CREATE: (policyId: string) => `/grc/policies/${policyId}/versions`,
      UPDATE: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}`,
      LATEST: (policyId: string) => `/grc/policies/${policyId}/versions/latest`,
      PUBLISHED: (policyId: string) => `/grc/policies/${policyId}/versions/published`,
      SUBMIT_FOR_REVIEW: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}/submit-for-review`,
      APPROVE: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}/approve`,
      PUBLISH: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}/publish`,
      RETIRE: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}/retire`,
    },
  },

  // Audit Report Template endpoints
  AUDIT_REPORT_TEMPLATES: {
    LIST: '/audit-report-templates',
    GET: (id: string) => `/audit-report-templates/${id}`,
    CREATE: '/audit-report-templates',
    UPDATE: (id: string) => `/audit-report-templates/${id}`,
    DELETE: (id: string) => `/audit-report-templates/${id}`,
    RENDER: (id: string) => `/audit-report-templates/${id}/render`,
    PREVIEW: '/audit-report-templates/preview',
    VALIDATE: '/audit-report-templates/validate',
    PLACEHOLDERS: (id: string) => `/audit-report-templates/${id}/placeholders`,
  },

  // Search endpoints
  SEARCH: {
    GENERIC: '/grc/search',
    RISKS: '/grc/search/risks',
    POLICIES: '/grc/search/policies',
    REQUIREMENTS: '/grc/search/requirements',
    ISSUES: '/grc/search/issues',
    AUDITS: '/grc/search/audits',
  },

  // Metadata endpoints
  METADATA: {
    FIELDS: {
      LIST: '/metadata/fields',
      GET: (id: string) => `/metadata/fields/${id}`,
      CREATE: '/metadata/fields',
      UPDATE: (id: string) => `/metadata/fields/${id}`,
      DELETE: (id: string) => `/metadata/fields/${id}`,
      TABLES: '/metadata/fields/tables',
      TAGS: (id: string) => `/metadata/fields/${id}/tags`,
      ASSIGN_TAG: (id: string) => `/metadata/fields/${id}/tags`,
      REMOVE_TAG: (id: string, tagId: string) => `/metadata/fields/${id}/tags/${tagId}`,
    },
    TAGS: {
      LIST: '/metadata/tags',
      GET: (id: string) => `/metadata/tags/${id}`,
      CREATE: '/metadata/tags',
      UPDATE: (id: string) => `/metadata/tags/${id}`,
      DELETE: (id: string) => `/metadata/tags/${id}`,
      FIELDS: (id: string) => `/metadata/tags/${id}/fields`,
    },
    SEED: '/metadata/seed',
  },

  // GRC Requirement endpoints (Compliance)
  GRC_REQUIREMENTS: {
    LIST: '/grc/requirements',
    CREATE: '/grc/requirements',
    GET: (id: string) => `/grc/requirements/${id}`,
    UPDATE: (id: string) => `/grc/requirements/${id}`,
    DELETE: (id: string) => `/grc/requirements/${id}`,
    SUMMARY: '/grc/requirements/summary',
    STATISTICS: '/grc/requirements/statistics',
    FRAMEWORKS: '/grc/requirements/frameworks',
    CONTROLS: (id: string) => `/grc/requirements/${id}/controls`,
    RISKS: (id: string) => `/grc/requirements/${id}/risks`,
  },

  // GRC Control endpoints (Unified Control Library)
  GRC_CONTROLS: {
    LIST: '/grc/controls',
    GET: (id: string) => `/grc/controls/${id}`,
    UPDATE: (id: string) => `/grc/controls/${id}`,
    PROCESSES: (id: string) => `/grc/controls/${id}/processes`,
    LINK_PROCESS: (controlId: string, processId: string) => `/grc/controls/${controlId}/processes/${processId}`,
    UNLINK_PROCESS: (controlId: string, processId: string) => `/grc/controls/${controlId}/processes/${processId}`,
    EVIDENCES: (id: string) => `/grc/controls/${id}/evidences`,
  },

  // GRC Coverage endpoints (Unified Control Library)
  GRC_COVERAGE: {
    SUMMARY: '/grc/coverage',
    REQUIREMENTS: '/grc/coverage/requirements',
    PROCESSES: '/grc/coverage/processes',
  },

  // Standards Library endpoints (Phase 7 - Express backend)
  STANDARDS: {
    LIST: '/grc/requirements',
    FILTERS: '/grc/requirements/filters',
    GET: (id: string) => `/grc/requirements/${id}`,
    MAP_POLICY: '/grc/requirements/map/policy',
    MAP_RISK: '/grc/requirements/map/risk',
    MAP_FINDING: '/grc/requirements/map/finding',
    MAP_AUDIT: '/grc/requirements/map/audit',
    POLICIES: (id: string) => `/grc/requirements/${id}/policies`,
    RISKS: (id: string) => `/grc/requirements/${id}/risks`,
    FINDINGS: (id: string) => `/grc/requirements/${id}/findings`,
    AUDITS: (id: string) => `/grc/requirements/${id}/audits`,
  },

  // Platform Metadata Engine endpoints (Phase 7 - Express backend)
  PLATFORM_METADATA: {
    TYPES: '/platform/metadata/types',
    TYPE: (id: string) => `/platform/metadata/types/${id}`,
    VALUES: '/platform/metadata/values',
    TYPE_VALUES: (typeId: string) => `/platform/metadata/types/${typeId}/values`,
    VALUE: (id: string) => `/platform/metadata/values/${id}`,
    ASSIGN: '/platform/metadata/assign',
    ASSIGNED: (objectType: string, objectId: string) => `/platform/metadata/assigned/${objectType}/${objectId}`,
    REMOVE_ASSIGNED: (id: string) => `/platform/metadata/assigned/${id}`,
    STATS: '/platform/metadata/stats',
  },

  // GRC Metrics endpoints (Phase 7 - Express backend)
  GRC_METRICS: {
    REQUIREMENTS_COVERAGE: '/grc/metrics/requirements/coverage',
    FINDINGS_BY_STANDARD: '/grc/metrics/findings/by-standard',
    REQUIREMENTS_TAGS: '/grc/metrics/requirements/tags',
    COMPLIANCE_SUMMARY: '/grc/metrics/compliance/summary',
  },

  // GRC Dashboard endpoints (Phase 8 - Express backend)
  GRC_DASHBOARD: {
    AUDIT_OVERVIEW: '/grc/dashboard/audit-overview',
    COMPLIANCE_OVERVIEW: '/grc/dashboard/compliance-overview',
    GRC_HEALTH: '/grc/dashboard/grc-health',
    FILTERS: '/grc/dashboard/filters',
  },

  // ITSM (IT Service Management) endpoints - ITIL v5 aligned
  ITSM: {
    // ITSM Service endpoints
    SERVICES: {
      LIST: '/grc/itsm/services',
      CREATE: '/grc/itsm/services',
      GET: (id: string) => `/grc/itsm/services/${id}`,
      UPDATE: (id: string) => `/grc/itsm/services/${id}`,
      DELETE: (id: string) => `/grc/itsm/services/${id}`,
    },
    // ITSM Incident endpoints
    INCIDENTS: {
      LIST: '/grc/itsm/incidents',
      CREATE: '/grc/itsm/incidents',
      GET: (id: string) => `/grc/itsm/incidents/${id}`,
      UPDATE: (id: string) => `/grc/itsm/incidents/${id}`,
      DELETE: (id: string) => `/grc/itsm/incidents/${id}`,
      // Incident lifecycle actions
      RESOLVE: (id: string) => `/grc/itsm/incidents/${id}/resolve`,
      CLOSE: (id: string) => `/grc/itsm/incidents/${id}/close`,
      // GRC Bridge - Risk/Control linking
      RISKS: (id: string) => `/grc/itsm/incidents/${id}/risks`,
      LINK_RISK: (incidentId: string, riskId: string) => `/grc/itsm/incidents/${incidentId}/risks/${riskId}`,
      UNLINK_RISK: (incidentId: string, riskId: string) => `/grc/itsm/incidents/${incidentId}/risks/${riskId}`,
      CONTROLS: (id: string) => `/grc/itsm/incidents/${id}/controls`,
      LINK_CONTROL: (incidentId: string, controlId: string) => `/grc/itsm/incidents/${incidentId}/controls/${controlId}`,
      UNLINK_CONTROL: (incidentId: string, controlId: string) => `/grc/itsm/incidents/${incidentId}/controls/${controlId}`,
      // Impact & Blast Radius
      AFFECTED_CIS: (id: string) => `/grc/itsm/incidents/${id}/affected-cis`,
      DELETE_AFFECTED_CI: (incidentId: string, linkId: string) => `/grc/itsm/incidents/${incidentId}/affected-cis/${linkId}`,
      IMPACT_SUMMARY: (id: string) => `/grc/itsm/incidents/${id}/impact-summary`,
    },
    // ITSM Change endpoints
    CHANGES: {
      LIST: '/grc/itsm/changes',
      CREATE: '/grc/itsm/changes',
      GET: (id: string) => `/grc/itsm/changes/${id}`,
      UPDATE: (id: string) => `/grc/itsm/changes/${id}`,
      DELETE: (id: string) => `/grc/itsm/changes/${id}`,
      // GRC Bridge - Risk/Control linking
      RISKS: (id: string) => `/grc/itsm/changes/${id}/risks`,
      LINK_RISK: (changeId: string, riskId: string) => `/grc/itsm/changes/${changeId}/risks/${riskId}`,
      UNLINK_RISK: (changeId: string, riskId: string) => `/grc/itsm/changes/${changeId}/risks/${riskId}`,
      CONTROLS: (id: string) => `/grc/itsm/changes/${id}/controls`,
      LINK_CONTROL: (changeId: string, controlId: string) => `/grc/itsm/changes/${changeId}/controls/${controlId}`,
      UNLINK_CONTROL: (changeId: string, controlId: string) => `/grc/itsm/changes/${changeId}/controls/${controlId}`,
      CONFLICTS: (id: string) => `/grc/itsm/changes/${id}/conflicts`,
      REFRESH_CONFLICTS: (id: string) => `/grc/itsm/changes/${id}/refresh-conflicts`,
      REQUEST_APPROVAL: (id: string) => `/grc/itsm/changes/${id}/request-approval`,
      APPROVALS: (id: string) => `/grc/itsm/changes/${id}/approvals`,
    },
    APPROVALS: {
      APPROVE: (approvalId: string) => `/grc/itsm/approvals/${approvalId}/approve`,
      REJECT: (approvalId: string) => `/grc/itsm/approvals/${approvalId}/reject`,
    },

    // ITSM Change Calendar endpoints
    CALENDAR: {
      EVENTS: {
        LIST: '/grc/itsm/calendar/events',
        CREATE: '/grc/itsm/calendar/events',
        GET: (id: string) => `/grc/itsm/calendar/events/${id}`,
        UPDATE: (id: string) => `/grc/itsm/calendar/events/${id}`,
        DELETE: (id: string) => `/grc/itsm/calendar/events/${id}`,
        PREVIEW_CONFLICTS: '/grc/itsm/calendar/events/preview-conflicts',
      },
      FREEZE_WINDOWS: {
        LIST: '/grc/itsm/calendar/freeze-windows',
        CREATE: '/grc/itsm/calendar/freeze-windows',
        GET: (id: string) => `/grc/itsm/calendar/freeze-windows/${id}`,
        UPDATE: (id: string) => `/grc/itsm/calendar/freeze-windows/${id}`,
        DELETE: (id: string) => `/grc/itsm/calendar/freeze-windows/${id}`,
      },
    },

    // ITSM Journal endpoints
    JOURNAL: {
      LIST: (table: string, recordId: string) => `/grc/itsm/${table}/${recordId}/journal`,
      CREATE: (table: string, recordId: string) => `/grc/itsm/${table}/${recordId}/journal`,
      COUNT: (table: string, recordId: string) => `/grc/itsm/${table}/${recordId}/journal/count`,
    },

    // ITSM Choice endpoints
    CHOICES: {
      LIST: '/grc/itsm/choices',
      TABLES: '/grc/itsm/choices/tables',
      GET: (id: string) => `/grc/itsm/choices/${id}`,
      CREATE: '/grc/itsm/choices',
      UPDATE: (id: string) => `/grc/itsm/choices/${id}`,
      DELETE: (id: string) => `/grc/itsm/choices/${id}`,
    },
    // ITSM Business Rule endpoints
    BUSINESS_RULES: {
      LIST: '/grc/itsm/business-rules',
      GET: (id: string) => `/grc/itsm/business-rules/${id}`,
      CREATE: '/grc/itsm/business-rules',
      UPDATE: (id: string) => `/grc/itsm/business-rules/${id}`,
      DELETE: (id: string) => `/grc/itsm/business-rules/${id}`,
      EVALUATE: '/grc/itsm/business-rules/evaluate',
    },
    // ITSM UI Policy endpoints
    UI_POLICIES: {
      LIST: '/grc/itsm/ui-policies',
      GET: (id: string) => `/grc/itsm/ui-policies/policies/${id}`,
      CREATE: '/grc/itsm/ui-policies',
      UPDATE: (id: string) => `/grc/itsm/ui-policies/policies/${id}`,
      DELETE: (id: string) => `/grc/itsm/ui-policies/policies/${id}`,
      BY_TABLE: (tableName: string) => `/grc/itsm/ui-policies/table/${tableName}`,
      EVALUATE: '/grc/itsm/ui-policies/evaluate',
      ACTIONS_LIST: '/grc/itsm/ui-policies/actions',
      ACTIONS_GET: (id: string) => `/grc/itsm/ui-policies/actions/${id}`,
      ACTIONS_CREATE: '/grc/itsm/ui-policies/actions',
      ACTIONS_UPDATE: (id: string) => `/grc/itsm/ui-policies/actions/${id}`,
      ACTIONS_DELETE: (id: string) => `/grc/itsm/ui-policies/actions/${id}`,
    },
    // ITSM Workflow endpoints
    WORKFLOWS: {
      LIST: '/grc/itsm/workflows',
      GET: (id: string) => `/grc/itsm/workflows/${id}`,
      CREATE: '/grc/itsm/workflows',
      UPDATE: (id: string) => `/grc/itsm/workflows/${id}`,
      DELETE: (id: string) => `/grc/itsm/workflows/${id}`,
      BY_TABLE: (tableName: string) => `/grc/itsm/workflows/table/${tableName}`,
      AVAILABLE_TRANSITIONS: (id: string) => `/grc/itsm/workflows/${id}/transitions/available`,
      VALIDATE_TRANSITION: (id: string) => `/grc/itsm/workflows/${id}/transitions/validate`,
    },
    // ITSM SLA endpoints
    SLA: {
      DEFINITIONS_LIST: '/grc/itsm/sla/definitions',
      DEFINITIONS_GET: (id: string) => `/grc/itsm/sla/definitions/${id}`,
      DEFINITIONS_CREATE: '/grc/itsm/sla/definitions',
      DEFINITIONS_UPDATE: (id: string) => `/grc/itsm/sla/definitions/${id}`,
      DEFINITIONS_DELETE: (id: string) => `/grc/itsm/sla/definitions/${id}`,
      INSTANCES_LIST: '/grc/itsm/sla/instances',
      RECORD_SLAS: (recordType: string, recordId: string) => `/grc/itsm/sla/records/${recordType}/${recordId}`,
      RECOMPUTE: (id: string) => `/grc/itsm/sla/instances/${id}/recompute`,
    },
    // ITSM Diagnostics endpoints
    DIAGNOSTICS: {
      HEALTH: '/grc/itsm/diagnostics/health',
      COUNTS: '/grc/itsm/diagnostics/counts',
      VALIDATE_BASELINE: '/grc/itsm/diagnostics/validate-baseline',
      SLA_SUMMARY: '/grc/itsm/diagnostics/sla-summary',
    },

    // ITSM Problem Management endpoints
    PROBLEMS: {
      LIST: '/grc/itsm/problems',
      CREATE: '/grc/itsm/problems',
      GET: (id: string) => `/grc/itsm/problems/${id}`,
      UPDATE: (id: string) => `/grc/itsm/problems/${id}`,
      DELETE: (id: string) => `/grc/itsm/problems/${id}`,
      STATISTICS: '/grc/itsm/problems/statistics',
      SUMMARY: (id: string) => `/grc/itsm/problems/${id}/summary`,
      RCA: (id: string) => `/grc/itsm/problems/${id}/rca`,
      MARK_KNOWN_ERROR: (id: string) => `/grc/itsm/problems/${id}/mark-known-error`,
      UNMARK_KNOWN_ERROR: (id: string) => `/grc/itsm/problems/${id}/unmark-known-error`,
      INCIDENTS: (id: string) => `/grc/itsm/problems/${id}/incidents`,
      LINK_INCIDENT: (id: string, incidentId: string) => `/grc/itsm/problems/${id}/incidents/${incidentId}`,
      UNLINK_INCIDENT: (id: string, incidentId: string) => `/grc/itsm/problems/${id}/incidents/${incidentId}`,
      CHANGES: (id: string) => `/grc/itsm/problems/${id}/changes`,
      LINK_CHANGE: (id: string, changeId: string) => `/grc/itsm/problems/${id}/changes/${changeId}`,
      UNLINK_CHANGE: (id: string, changeId: string) => `/grc/itsm/problems/${id}/changes/${changeId}`,
      RCA_COMPLETE: (id: string) => `/grc/itsm/problems/${id}/rca/complete`,
      REOPEN: (id: string) => `/grc/itsm/problems/${id}/reopen`,
      RECURRENCE_CANDIDATES: '/grc/itsm/problems/recurrence-candidates',
    },

    // ITSM Known Error endpoints
    KNOWN_ERRORS: {
      LIST: '/grc/itsm/known-errors',
      CREATE: '/grc/itsm/known-errors',
      GET: (id: string) => `/grc/itsm/known-errors/${id}`,
      UPDATE: (id: string) => `/grc/itsm/known-errors/${id}`,
      DELETE: (id: string) => `/grc/itsm/known-errors/${id}`,
      VALIDATE: (id: string) => `/grc/itsm/known-errors/${id}/validate`,
      PUBLISH: (id: string) => `/grc/itsm/known-errors/${id}/publish`,
      RETIRE: (id: string) => `/grc/itsm/known-errors/${id}/retire`,
      REOPEN: (id: string) => `/grc/itsm/known-errors/${id}/reopen`,
    },

    // ITSM Major Incident endpoints
    MAJOR_INCIDENTS: {
      LIST: '/grc/itsm/major-incidents',
      CREATE: '/grc/itsm/major-incidents',
      GET: (id: string) => `/grc/itsm/major-incidents/${id}`,
      UPDATE: (id: string) => `/grc/itsm/major-incidents/${id}`,
      DELETE: (id: string) => `/grc/itsm/major-incidents/${id}`,
      STATISTICS: '/grc/itsm/major-incidents/statistics',
      TIMELINE: (id: string) => `/grc/itsm/major-incidents/${id}/timeline`,
      LINKS: (id: string) => `/grc/itsm/major-incidents/${id}/links`,
      UNLINK: (id: string, linkId: string) => `/grc/itsm/major-incidents/${id}/links/${linkId}`,
    },

    // ITSM PIR (Post-Incident Review) endpoints
    PIRS: {
      LIST: '/grc/itsm/pirs',
      CREATE: '/grc/itsm/pirs',
      GET: (id: string) => `/grc/itsm/pirs/${id}`,
      UPDATE: (id: string) => `/grc/itsm/pirs/${id}`,
      DELETE: (id: string) => `/grc/itsm/pirs/${id}`,
      APPROVE: (id: string) => `/grc/itsm/pirs/${id}/approve`,
      BY_MI: (majorIncidentId: string) => `/grc/itsm/pirs/by-major-incident/${majorIncidentId}`,
    },

    // ITSM PIR Action endpoints
    PIR_ACTIONS: {
      LIST: '/grc/itsm/pir-actions',
      CREATE: '/grc/itsm/pir-actions',
      GET: (id: string) => `/grc/itsm/pir-actions/${id}`,
      UPDATE: (id: string) => `/grc/itsm/pir-actions/${id}`,
      DELETE: (id: string) => `/grc/itsm/pir-actions/${id}`,
      OVERDUE: '/grc/itsm/pir-actions/overdue',
    },

    // ITSM Analytics endpoints (Phase 4 - Closed-Loop Analytics)
    ANALYTICS: {
      EXECUTIVE_SUMMARY: '/grc/itsm/analytics/executive-summary',
      PROBLEM_TRENDS: '/grc/itsm/analytics/problem-trends',
      MAJOR_INCIDENT_METRICS: '/grc/itsm/analytics/major-incident-metrics',
      PIR_EFFECTIVENESS: '/grc/itsm/analytics/pir-effectiveness',
      KNOWN_ERROR_LIFECYCLE: '/grc/itsm/analytics/known-error-lifecycle',
      CLOSURE_EFFECTIVENESS: '/grc/itsm/analytics/closure-effectiveness',
      BACKLOG: '/grc/itsm/analytics/backlog',
    },

    // ITSM Knowledge Candidate endpoints
    KNOWLEDGE_CANDIDATES: {
      LIST: '/grc/itsm/knowledge-candidates',
      GET: (id: string) => `/grc/itsm/knowledge-candidates/${id}`,
      DELETE: (id: string) => `/grc/itsm/knowledge-candidates/${id}`,
      GENERATE_FROM_PIR: (pirId: string) => `/grc/itsm/knowledge-candidates/generate/pir/${pirId}`,
      GENERATE_FROM_KE: (keId: string) => `/grc/itsm/knowledge-candidates/generate/known-error/${keId}`,
      GENERATE_FROM_PROBLEM: (problemId: string) => `/grc/itsm/knowledge-candidates/generate/problem/${problemId}`,
      REVIEW: (id: string) => `/grc/itsm/knowledge-candidates/${id}/review`,
      PUBLISH: (id: string) => `/grc/itsm/knowledge-candidates/${id}/publish`,
      REJECT: (id: string) => `/grc/itsm/knowledge-candidates/${id}/reject`,
    },
  },

  // CMDB (Configuration Management Database) endpoints
  CMDB: {
    CLASSES: {
      LIST: '/grc/cmdb/classes',
      GET: (id: string) => `/grc/cmdb/classes/${id}`,
      CREATE: '/grc/cmdb/classes',
      UPDATE: (id: string) => `/grc/cmdb/classes/${id}`,
      DELETE: (id: string) => `/grc/cmdb/classes/${id}`,
    },
    CIS: {
      LIST: '/grc/cmdb/cis',
      GET: (id: string) => `/grc/cmdb/cis/${id}`,
      CREATE: '/grc/cmdb/cis',
      UPDATE: (id: string) => `/grc/cmdb/cis/${id}`,
      DELETE: (id: string) => `/grc/cmdb/cis/${id}`,
    },
    RELATIONSHIPS: {
      LIST: '/grc/cmdb/relationships',
      GET: (id: string) => `/grc/cmdb/relationships/${id}`,
      CREATE: '/grc/cmdb/relationships',
      UPDATE: (id: string) => `/grc/cmdb/relationships/${id}`,
      DELETE: (id: string) => `/grc/cmdb/relationships/${id}`,
    },
    SERVICES: {
      LIST: '/grc/cmdb/services',
      GET: (id: string) => `/grc/cmdb/services/${id}`,
      CREATE: '/grc/cmdb/services',
      UPDATE: (id: string) => `/grc/cmdb/services/${id}`,
      DELETE: (id: string) => `/grc/cmdb/services/${id}`,
    },
    SERVICE_OFFERINGS: {
      LIST: '/grc/cmdb/service-offerings',
      GET: (id: string) => `/grc/cmdb/service-offerings/${id}`,
      CREATE: '/grc/cmdb/service-offerings',
      UPDATE: (id: string) => `/grc/cmdb/service-offerings/${id}`,
      DELETE: (id: string) => `/grc/cmdb/service-offerings/${id}`,
    },
    SERVICE_CI: {
      CIS_FOR_SERVICE: (serviceId: string) => `/grc/cmdb/services/${serviceId}/cis`,
      SERVICES_FOR_CI: (ciId: string) => `/grc/cmdb/cis/${ciId}/services`,
      LINK: (serviceId: string, ciId: string) => `/grc/cmdb/services/${serviceId}/cis/${ciId}`,
      UNLINK: (serviceId: string, ciId: string) => `/grc/cmdb/services/${serviceId}/cis/${ciId}`,
    },
    IMPORT_SOURCES: {
      LIST: '/grc/cmdb/import-sources',
      GET: (id: string) => `/grc/cmdb/import-sources/${id}`,
      CREATE: '/grc/cmdb/import-sources',
      UPDATE: (id: string) => `/grc/cmdb/import-sources/${id}`,
      DELETE: (id: string) => `/grc/cmdb/import-sources/${id}`,
    },
    IMPORT_JOBS: {
      LIST: '/grc/cmdb/import-jobs',
      GET: (id: string) => `/grc/cmdb/import-jobs/${id}`,
      CREATE: '/grc/cmdb/import-jobs',
      ROWS: (id: string) => `/grc/cmdb/import-jobs/${id}/rows`,
      RESULTS: (id: string) => `/grc/cmdb/import-jobs/${id}/results`,
      APPLY: (id: string) => `/grc/cmdb/import-jobs/${id}/apply`,
      REPORT: (id: string) => `/grc/cmdb/import-jobs/${id}/report`,
    },
    RECONCILE_RULES: {
      LIST: '/grc/cmdb/reconcile-rules',
      GET: (id: string) => `/grc/cmdb/reconcile-rules/${id}`,
      CREATE: '/grc/cmdb/reconcile-rules',
      UPDATE: (id: string) => `/grc/cmdb/reconcile-rules/${id}`,
      DELETE: (id: string) => `/grc/cmdb/reconcile-rules/${id}`,
    },
    TOPOLOGY: {
      CI: (ciId: string) => `/grc/cmdb/topology/ci/${ciId}`,
      SERVICE: (serviceId: string) => `/grc/cmdb/topology/service/${serviceId}`,
    },
  },

  // User endpoints (limited in NestJS)
  USERS: {
    ME: '/users/me',
    COUNT: '/users/count',
    HEALTH: '/users/health',
    // Full CRUD is only in Express backend
    LIST: '/users',
    CREATE: '/users',
    GET: (id: number) => `/users/${id}`,
    UPDATE: (id: number) => `/users/${id}`,
    DELETE: (id: number) => `/users/${id}`,
  },

  // Health endpoints
  HEALTH: {
    OVERALL: '/health',
    LIVE: '/health/live',
    READY: '/health/ready',
    DB: '/health/db',
    AUTH: '/health/auth',
  },

  // Tenant endpoints
  TENANTS: {
    CURRENT: '/tenants/current',
    USERS: '/tenants/users',
    HEALTH: '/tenants/health',
  },

  // Dashboard endpoints (NestJS)
  DASHBOARD: {
    OVERVIEW: '/dashboard/overview',
    RISK_TRENDS: '/dashboard/risk-trends',
    COMPLIANCE_BY_REGULATION: '/dashboard/compliance-by-regulation',
  },

  // Process endpoints (Sprint 5)
  GRC_PROCESSES: {
    LIST: '/grc/processes',
    CREATE: '/grc/processes',
    GET: (id: string) => `/grc/processes/${id}`,
    UPDATE: (id: string) => `/grc/processes/${id}`,
    DELETE: (id: string) => `/grc/processes/${id}`,
    COMPLIANCE_SCORE: (id: string) => `/grc/processes/${id}/compliance-score`,
    COMPLIANCE_OVERVIEW: '/grc/processes/compliance-overview',
  },

  // ProcessControl endpoints (Sprint 5)
  GRC_PROCESS_CONTROLS: {
    LIST: '/grc/process-controls',
    CREATE: '/grc/process-controls',
    GET: (id: string) => `/grc/process-controls/${id}`,
    UPDATE: (id: string) => `/grc/process-controls/${id}`,
    DELETE: (id: string) => `/grc/process-controls/${id}`,
    LINK_RISKS: (id: string) => `/grc/process-controls/${id}/risks`,
  },

  // ControlResult endpoints (Sprint 5)
  GRC_CONTROL_RESULTS: {
    LIST: '/grc/control-results',
    CREATE: '/grc/control-results',
    GET: (id: string) => `/grc/control-results/${id}`,
  },

  // ProcessViolation endpoints (Sprint 5)
  GRC_PROCESS_VIOLATIONS: {
    LIST: '/grc/process-violations',
    GET: (id: string) => `/grc/process-violations/${id}`,
    UPDATE: (id: string) => `/grc/process-violations/${id}`,
    LINK_RISK: (id: string) => `/grc/process-violations/${id}/link-risk`,
    UNLINK_RISK: (id: string) => `/grc/process-violations/${id}/unlink-risk`,
  },

  // Evidence endpoints (Golden Flow Sprint 1B)
  GRC_EVIDENCE: {
    LIST: '/grc/evidence',
    CREATE: '/grc/evidence',
    GET: (id: string) => `/grc/evidence/${id}`,
    UPDATE: (id: string) => `/grc/evidence/${id}`,
    DELETE: (id: string) => `/grc/evidence/${id}`,
    CONTROLS: (id: string) => `/grc/evidence/${id}/controls`,
    LINK_CONTROL: (evidenceId: string, controlId: string) => `/grc/evidence/${evidenceId}/controls/${controlId}`,
    UNLINK_CONTROL: (evidenceId: string, controlId: string) => `/grc/evidence/${evidenceId}/controls/${controlId}`,
    TEST_RESULTS: (id: string) => `/grc/evidence/${id}/test-results`,
    LINK_TEST_RESULT: (evidenceId: string, testResultId: string) => `/grc/evidence/${evidenceId}/test-results/${testResultId}`,
    UNLINK_TEST_RESULT: (evidenceId: string, testResultId: string) => `/grc/evidence/${evidenceId}/test-results/${testResultId}`,
    ISSUES: (id: string) => `/grc/evidence/${id}/issues`,
    LINK_ISSUE: (evidenceId: string, issueId: string) => `/grc/evidence/${evidenceId}/issues/${issueId}`,
    UNLINK_ISSUE: (evidenceId: string, issueId: string) => `/grc/evidence/${evidenceId}/issues/${issueId}`,
  },

    // Test Results endpoints (Golden Flow Sprint 1B + Test/Result Sprint)
    GRC_TEST_RESULTS: {
      LIST: '/grc/test-results',
      CREATE: '/grc/test-results',
      GET: (id: string) => `/grc/test-results/${id}`,
      UPDATE: (id: string) => `/grc/test-results/${id}`,
      DELETE: (id: string) => `/grc/test-results/${id}`,
      // Test/Result Sprint - Evidence linking endpoints
      EVIDENCES: (testResultId: string) => `/grc/test-results/${testResultId}/evidences`,
      LINK_EVIDENCE: (testResultId: string, evidenceId: string) => `/grc/test-results/${testResultId}/evidences/${evidenceId}`,
      UNLINK_EVIDENCE: (testResultId: string, evidenceId: string) => `/grc/test-results/${testResultId}/evidences/${evidenceId}`,
      // Test/Result Sprint - Control-centric endpoint
      BY_CONTROL: (controlId: string) => `/grc/controls/${controlId}/test-results`,
      // Issue/Finding Sprint - Create Issue from Test Result (Golden Flow)
      CREATE_ISSUE: (testResultId: string) => `/grc/test-results/${testResultId}/issues`,
    },

    // Control Tests (Test Definitions) endpoints (Control Tests v1)
    GRC_CONTROL_TESTS: {
      LIST: '/grc/control-tests',
      CREATE: '/grc/control-tests',
      GET: (id: string) => `/grc/control-tests/${id}`,
      UPDATE: (id: string) => `/grc/control-tests/${id}`,
      DELETE: (id: string) => `/grc/control-tests/${id}`,
      UPDATE_STATUS: (id: string) => `/grc/control-tests/${id}/status`,
      // Nested convenience endpoints
      BY_CONTROL: (controlId: string) => `/grc/controls/${controlId}/tests`,
      RESULTS: (testId: string) => `/grc/control-tests/${testId}/results`,
    },

  // Issues endpoints (Golden Flow Sprint 1B)
  GRC_ISSUES: {
    LIST: '/grc/issues',
    CREATE: '/grc/issues',
    GET: (id: string) => `/grc/issues/${id}`,
    UPDATE: (id: string) => `/grc/issues/${id}`,
    DELETE: (id: string) => `/grc/issues/${id}`,
    UPDATE_STATUS: (id: string) => `/grc/issues/${id}/status`,
    CONTROLS: (id: string) => `/grc/issues/${id}/controls`,
    LINK_CONTROL: (issueId: string, controlId: string) => `/grc/issues/${issueId}/controls/${controlId}`,
    UNLINK_CONTROL: (issueId: string, controlId: string) => `/grc/issues/${issueId}/controls/${controlId}`,
    TEST_RESULTS: (id: string) => `/grc/issues/${id}/test-results`,
    LINK_TEST_RESULT: (issueId: string, testResultId: string) => `/grc/issues/${issueId}/test-results/${testResultId}`,
    UNLINK_TEST_RESULT: (issueId: string, testResultId: string) => `/grc/issues/${issueId}/test-results/${testResultId}`,
    EVIDENCE: (id: string) => `/grc/issues/${id}/evidence`,
    LINK_EVIDENCE: (issueId: string, evidenceId: string) => `/grc/issues/${issueId}/evidence/${evidenceId}`,
    UNLINK_EVIDENCE: (issueId: string, evidenceId: string) => `/grc/issues/${issueId}/evidence/${evidenceId}`,
    CAPAS: (issueId: string) => `/grc/issues/${issueId}/capas`,
  },

  // CAPA endpoints (Golden Flow Sprint 1C)
  GRC_CAPAS: {
    LIST: '/grc/capas',
    CREATE: '/grc/capas',
    GET: (id: string) => `/grc/capas/${id}`,
    UPDATE: (id: string) => `/grc/capas/${id}`,
    DELETE: (id: string) => `/grc/capas/${id}`,
    UPDATE_STATUS: (id: string) => `/grc/capas/${id}/status`,
    BY_ISSUE: (issueId: string) => `/grc/capas/by-issue/${issueId}`,
    FILTERS: '/grc/capas/filters',
    TASKS: (capaId: string) => `/grc/capas/${capaId}/tasks`,
  },

  // CAPA Task endpoints (Golden Flow Sprint 1C)
  GRC_CAPA_TASKS: {
    LIST: '/grc/capa-tasks',
    CREATE: '/grc/capa-tasks',
    GET: (id: string) => `/grc/capa-tasks/${id}`,
    UPDATE: (id: string) => `/grc/capa-tasks/${id}`,
    DELETE: (id: string) => `/grc/capa-tasks/${id}`,
    UPDATE_STATUS: (id: string) => `/grc/capa-tasks/${id}/status`,
    COMPLETE: (id: string) => `/grc/capa-tasks/${id}/complete`,
    BY_CAPA: (capaId: string) => `/grc/capa-tasks/by-capa/${capaId}`,
    STATS: (capaId: string) => `/grc/capa-tasks/by-capa/${capaId}/stats`,
    FILTERS: '/grc/capa-tasks/filters',
  },

  // Onboarding Core endpoints
  ONBOARDING: {
    CONTEXT: '/onboarding/context',
  },

  // Framework Activation endpoints (Tenant-level compliance frameworks)
  GRC_FRAMEWORKS: {
    LIST: '/grc/frameworks',
  },

  // Tenant Frameworks endpoints
  TENANT_FRAMEWORKS: {
    GET: '/tenants/me/frameworks',
    UPDATE: '/tenants/me/frameworks',
  },

  // Standards Library endpoints (Audit Phase 2 - NestJS backend)
  STANDARDS_LIBRARY: {
    LIST: '/grc/standards',
    CREATE: '/grc/standards',
    GET: (id: string) => `/grc/standards/${id}`,
    GET_WITH_CLAUSES: (id: string) => `/grc/standards/${id}/with-clauses`,
    UPDATE: (id: string) => `/grc/standards/${id}`,
    DELETE: (id: string) => `/grc/standards/${id}`,
    SUMMARY: '/grc/standards/summary',
    CLAUSES: (standardId: string) => `/grc/standards/${standardId}/clauses`,
    CLAUSES_TREE: (standardId: string) => `/grc/standards/${standardId}/clauses/tree`,
    CREATE_CLAUSE: (standardId: string) => `/grc/standards/${standardId}/clauses`,
    GET_CLAUSE: (clauseId: string) => `/grc/standards/clauses/${clauseId}`,
    UPDATE_CLAUSE: (clauseId: string) => `/grc/standards/clauses/${clauseId}`,
  },

  // Audit Scope endpoints (Audit Phase 2 - NestJS backend)
  AUDIT_SCOPE: {
    GET: (auditId: string) => `/grc/audits/${auditId}/scope`,
    SET: (auditId: string) => `/grc/audits/${auditId}/scope`,
    LOCK: (auditId: string) => `/grc/audits/${auditId}/scope/lock`,
    CLAUSE_FINDINGS: (auditId: string, clauseId: string) => `/grc/audits/${auditId}/clauses/${clauseId}/findings`,
    LINK_FINDING: (auditId: string, clauseId: string) => `/grc/audits/${auditId}/clauses/${clauseId}/findings`,
    UNLINK_FINDING: (auditId: string, clauseId: string, issueId: string) => `/grc/audits/${auditId}/clauses/${clauseId}/findings/${issueId}`,
  },

  // GRC Status History endpoints (Control Detail History tab)
  GRC_STATUS_HISTORY: {
    LIST: '/grc/status-history',
    GET: (id: string) => `/grc/status-history/${id}`,
    BY_ENTITY: (entityType: string, entityId: string) => `/grc/status-history/by-entity/${entityType}/${entityId}`,
    TIMELINE: (entityType: string, entityId: string) => `/grc/status-history/timeline/${entityType}/${entityId}`,
  },

  // Admin Studio Data Model Dictionary endpoints (FAZ 2)
  DATA_MODEL: {
    TABLES: '/admin/data-model/tables',
    TABLE: (name: string) => `/admin/data-model/tables/${name}`,
    TABLE_RELATIONSHIPS: (name: string) => `/admin/data-model/tables/${name}/relationships`,
    TABLE_DOT_WALKING: (name: string) => `/admin/data-model/tables/${name}/dot-walking`,
    RELATIONSHIPS: '/admin/data-model/relationships',
    SUMMARY: '/admin/data-model/summary',
    GRAPH: '/admin/data-model/graph',
    REFRESH: '/admin/data-model/refresh',
  },

  // Platform Universal Views endpoints
  PLATFORM: {
    TABLES: '/grc/platform/tables',
    TABLE_SCHEMA: (tableName: string) => `/grc/platform/tables/${tableName}/schema`,
    VIEWS: '/grc/platform/views',
    VIEW: (tableName: string) => `/grc/platform/views/${tableName}`,
  },

  // GRC Insights endpoints (Sprint 1E)
  GRC_INSIGHTS: {
    OVERVIEW: '/grc/insights/overview',
  },

  // GRC Meta endpoints (List Toolbar Standard)
  GRC_META: {
    LIST_OPTIONS: '/grc/meta/list-options',
    LIST_OPTIONS_BY_ENTITY: (entity: string) => `/grc/meta/list-options/${entity}`,
  },

  // Platform Core - Universal Attachments
  ATTACHMENTS: {
    LIST: '/grc/attachments',
    UPLOAD: '/grc/attachments',
    GET: (id: string) => `/grc/attachments/${id}`,
    DOWNLOAD: (id: string) => `/grc/attachments/${id}/download`,
    DELETE: (id: string) => `/grc/attachments/${id}`,
  },

  // Platform Core - List Views
  LIST_VIEWS: {
    LIST: '/grc/list-views',
    CREATE: '/grc/list-views',
    GET: (id: string) => `/grc/list-views/${id}`,
    UPDATE: (id: string) => `/grc/list-views/${id}`,
    UPDATE_COLUMNS: (id: string) => `/grc/list-views/${id}/columns`,
    DELETE: (id: string) => `/grc/list-views/${id}`,
  },

  // Platform Core - Export
  EXPORT: {
    CREATE: '/grc/export',
  },

  // Platform Builder - Admin APIs
  PLATFORM_BUILDER: {
    // Table management
    TABLES: {
      LIST: '/grc/admin/tables',
      CREATE: '/grc/admin/tables',
      GET: (id: string) => `/grc/admin/tables/${id}`,
      UPDATE: (id: string) => `/grc/admin/tables/${id}`,
      DELETE: (id: string) => `/grc/admin/tables/${id}`,
    },
    // Field management
    FIELDS: {
      LIST: (tableId: string) => `/grc/admin/tables/${tableId}/fields`,
      CREATE: (tableId: string) => `/grc/admin/tables/${tableId}/fields`,
      GET: (fieldId: string) => `/grc/admin/fields/${fieldId}`,
      UPDATE: (fieldId: string) => `/grc/admin/fields/${fieldId}`,
      DELETE: (fieldId: string) => `/grc/admin/fields/${fieldId}`,
    },
    // Relationship management
    RELATIONSHIPS: {
      LIST: '/grc/admin/relationships',
      CREATE: '/grc/admin/relationships',
      GET: (id: string) => `/grc/admin/relationships/${id}`,
      DELETE: (id: string) => `/grc/admin/relationships/${id}`,
    },
  },

  // Dynamic Data - Runtime APIs
  DYNAMIC_DATA: {
    LIST: (tableName: string) => `/grc/data/${tableName}`,
    SCHEMA: (tableName: string) => `/grc/data/${tableName}/schema`,
    GET: (tableName: string, recordId: string) => `/grc/data/${tableName}/${recordId}`,
    CREATE: (tableName: string) => `/grc/data/${tableName}`,
    UPDATE: (tableName: string, recordId: string) => `/grc/data/${tableName}/${recordId}`,
    DELETE: (tableName: string, recordId: string) => `/grc/data/${tableName}/${recordId}`,
  },

  // SOA (Statement of Applicability) endpoints
  GRC_SOA: {
    // Profile endpoints
    PROFILES: {
      LIST: '/grc/soa/profiles',
      CREATE: '/grc/soa/profiles',
      GET: (id: string) => `/grc/soa/profiles/${id}`,
      UPDATE: (id: string) => `/grc/soa/profiles/${id}`,
      DELETE: (id: string) => `/grc/soa/profiles/${id}`,
      PUBLISH: (id: string) => `/grc/soa/profiles/${id}/publish`,
      INITIALIZE_ITEMS: (id: string) => `/grc/soa/profiles/${id}/initialize-items`,
      EXPORT: (id: string) => `/grc/soa/profiles/${id}/export`,
      STATISTICS: (id: string) => `/grc/soa/profiles/${id}/statistics`,
    },
    // Item endpoints
    ITEMS: {
      LIST: '/grc/soa/items',
      GET: (id: string) => `/grc/soa/items/${id}`,
      UPDATE: (id: string) => `/grc/soa/items/${id}`,
      LINK_CONTROL: (itemId: string, controlId: string) => `/grc/soa/items/${itemId}/controls/${controlId}`,
      UNLINK_CONTROL: (itemId: string, controlId: string) => `/grc/soa/items/${itemId}/controls/${controlId}`,
      LINK_EVIDENCE: (itemId: string, evidenceId: string) => `/grc/soa/items/${itemId}/evidence/${evidenceId}`,
      UNLINK_EVIDENCE: (itemId: string, evidenceId: string) => `/grc/soa/items/${itemId}/evidence/${evidenceId}`,
      LIST_ISSUES: (itemId: string) => `/grc/soa/items/${itemId}/issues`,
      CREATE_ISSUE: (itemId: string) => `/grc/soa/items/${itemId}/issues`,
      LIST_CAPAS: (itemId: string) => `/grc/soa/items/${itemId}/capas`,
      CREATE_CAPA: (itemId: string) => `/grc/soa/items/${itemId}/capas`,
    },
  },

  // BCM (Business Continuity Management) endpoints
  GRC_BCM: {
    FILTERS: '/grc/bcm/filters',
    // Service endpoints
    SERVICES: {
      LIST: '/grc/bcm/services',
      CREATE: '/grc/bcm/services',
      GET: (id: string) => `/grc/bcm/services/${id}`,
      UPDATE: (id: string) => `/grc/bcm/services/${id}`,
      DELETE: (id: string) => `/grc/bcm/services/${id}`,
      BIAS: (id: string) => `/grc/bcm/services/${id}/bias`,
      PLANS: (id: string) => `/grc/bcm/services/${id}/plans`,
      EXERCISES: (id: string) => `/grc/bcm/services/${id}/exercises`,
    },
    // BIA endpoints
    BIAS: {
      LIST: '/grc/bcm/bias',
      CREATE: '/grc/bcm/bias',
      GET: (id: string) => `/grc/bcm/bias/${id}`,
      UPDATE: (id: string) => `/grc/bcm/bias/${id}`,
      DELETE: (id: string) => `/grc/bcm/bias/${id}`,
    },
    // Plan endpoints
    PLANS: {
      LIST: '/grc/bcm/plans',
      CREATE: '/grc/bcm/plans',
      GET: (id: string) => `/grc/bcm/plans/${id}`,
      UPDATE: (id: string) => `/grc/bcm/plans/${id}`,
      DELETE: (id: string) => `/grc/bcm/plans/${id}`,
      STEPS: (id: string) => `/grc/bcm/plans/${id}/steps`,
    },
    // Plan Step endpoints
    PLAN_STEPS: {
      LIST: '/grc/bcm/plan-steps',
      CREATE: '/grc/bcm/plan-steps',
      GET: (id: string) => `/grc/bcm/plan-steps/${id}`,
      UPDATE: (id: string) => `/grc/bcm/plan-steps/${id}`,
      DELETE: (id: string) => `/grc/bcm/plan-steps/${id}`,
    },
    // Exercise endpoints
    EXERCISES: {
      LIST: '/grc/bcm/exercises',
      CREATE: '/grc/bcm/exercises',
      GET: (id: string) => `/grc/bcm/exercises/${id}`,
      UPDATE: (id: string) => `/grc/bcm/exercises/${id}`,
      DELETE: (id: string) => `/grc/bcm/exercises/${id}`,
    },
  },

  // Topology Intelligence endpoints (Change impact + MI RCA)
  ITSM_TOPOLOGY_INTELLIGENCE: {
    CHANGE_IMPACT: (changeId: string) => `/grc/itsm/changes/${changeId}/topology-impact`,
    CHANGE_RECALCULATE: (changeId: string) => `/grc/itsm/changes/${changeId}/recalculate-topology-impact`,
    CHANGE_EVALUATE_GOVERNANCE: (changeId: string) => `/grc/itsm/changes/${changeId}/evaluate-topology-governance`,
    MI_RCA_HYPOTHESES: (miId: string) => `/grc/itsm/major-incidents/${miId}/rca-topology-hypotheses`,
    MI_RCA_RECALCULATE: (miId: string) => `/grc/itsm/major-incidents/${miId}/rca-topology-hypotheses/recalculate`,
    MI_RCA_CREATE_PROBLEM: (miId: string) => `/grc/itsm/major-incidents/${miId}/rca-create-problem`,
    MI_RCA_CREATE_KNOWN_ERROR: (miId: string) => `/grc/itsm/major-incidents/${miId}/rca-create-known-error`,
    MI_RCA_CREATE_PIR_ACTION: (miId: string) => `/grc/itsm/major-incidents/${miId}/rca-create-pir-action`,
    // Phase 3: Suggested Task Pack + Traceability
    CHANGE_SUGGESTED_TASK_PACK: (changeId: string) => `/grc/itsm/changes/${changeId}/suggested-task-pack`,
    CHANGE_TRACEABILITY: (changeId: string) => `/grc/itsm/changes/${changeId}/traceability-summary`,
    MI_TRACEABILITY: (miId: string) => `/grc/itsm/major-incidents/${miId}/traceability-summary`,
  },

  // Change Risk Assessment endpoints
  ITSM_CHANGE_RISK: {
    GET: (changeId: string) => `/grc/itsm/changes/${changeId}/risk`,
    RECALCULATE: (changeId: string) => `/grc/itsm/changes/${changeId}/recalculate-risk`,
    CUSTOMER_RISK_IMPACT: (changeId: string) => `/grc/itsm/changes/${changeId}/customer-risk-impact`,
    RECALCULATE_CUSTOMER_RISK: (changeId: string) => `/grc/itsm/changes/${changeId}/recalculate-customer-risk`,
  },

  // Change Policy endpoints
  ITSM_CHANGE_POLICIES: {
    LIST: '/grc/itsm/change-policies',
    CREATE: '/grc/itsm/change-policies',
    GET: (id: string) => `/grc/itsm/change-policies/${id}`,
    UPDATE: (id: string) => `/grc/itsm/change-policies/${id}`,
    DELETE: (id: string) => `/grc/itsm/change-policies/${id}`,
  },

  // Calendar endpoints
  GRC_CALENDAR: {
    EVENTS: '/grc/calendar/events',
  },

  // Copilot endpoints (AI Decision & Action Layer)
  COPILOT: {
    INCIDENTS: {
      LIST: '/grc/copilot/incidents',
      GET: (sysId: string) => `/grc/copilot/incidents/${sysId}`,
      SUGGEST: (sysId: string) => `/grc/copilot/incidents/${sysId}/suggest`,
      APPLY: (sysId: string) => `/grc/copilot/incidents/${sysId}/apply`,
    },
    LEARNING: {
      EVENTS: '/grc/copilot/learning/events',
    },
    INDEXING: {
      INCIDENTS: '/grc/copilot/indexing/incidents',
      KB: '/grc/copilot/indexing/kb',
      STATS: '/grc/copilot/indexing/stats',
    },
  },
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Standard paginated response from NestJS backend (LIST-CONTRACT compliant)
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     items: [...],
 *     total: 100,
 *     page: 1,
 *     pageSize: 20,
 *     totalPages: 5
 *   }
 * }
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * Standard single item response from NestJS backend
 */
export interface SingleResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Dashboard overview data aggregated from multiple summary endpoints
 * Enhanced with KPI-ready fields
 */
export interface DashboardOverview {
  risks: {
    total: number;
    open: number;
    high: number;
    overdue: number;
    top5OpenRisks?: Array<{
      id: string;
      title: string;
      severity: string;
      score: number | null;
    }>;
  };
  compliance: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
    coveragePercentage?: number;
  };
  policies: {
    total: number;
    active: number;
    draft: number;
    coveragePercentage?: number;
  };
  incidents: {
    total: number;
    open: number;
    closed: number;
    resolved: number;
    resolvedToday?: number;
    avgResolutionTimeHours?: number | null;
  };
  users: {
    total: number;
    admins: number;
    managers: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create request config with tenant ID header
 */
export function withTenantId(tenantId: string, config?: AxiosRequestConfig): AxiosRequestConfig {
  return {
    ...config,
    headers: {
      ...config?.headers,
      'x-tenant-id': tenantId,
    },
  };
}

/**
 * Unwrap NestJS response envelope
 * Handles both: { success: true, data: T } (NestJS) and flat T (legacy Express)
 */
export function unwrapResponse<T>(response: { data: unknown }): T {
  const data = response.data;
  if (data && typeof data === 'object' && 'success' in data && (data as { success: boolean }).success === true && 'data' in data) {
    return (data as { data: T }).data;
  }
  return data as T;
}

/**
 * Safely unwrap a response and ensure it's an array
 * Handles multiple response shapes:
 * - { success: true, data: [...] } (NestJS envelope with array)
 * - { success: true, data: { items: [...] } } (NestJS paginated envelope)
 * - [...] (flat array)
 * - { items: [...] } (flat paginated)
 * Returns empty array if data is not array-like
 */
export function unwrapArrayResponse<T>(response: { data: unknown }): T[] {
  const unwrapped = unwrapResponse<unknown>(response);
  
  // If it's already an array, return it
  if (Array.isArray(unwrapped)) {
    return unwrapped as T[];
  }
  
  // If it's an object with items array (paginated response)
  if (unwrapped && typeof unwrapped === 'object' && 'items' in unwrapped) {
    const items = (unwrapped as { items: unknown }).items;
    if (Array.isArray(items)) {
      return items as T[];
    }
  }
  
  // If it's an object with data array (double-wrapped)
  if (unwrapped && typeof unwrapped === 'object' && 'data' in unwrapped) {
    const data = (unwrapped as { data: unknown }).data;
    if (Array.isArray(data)) {
      return data as T[];
    }
  }
  
  // Return empty array as fallback
  return [];
}

/**
 * Ensure a value is an array, with safe fallback
 * Use this when you're not sure if a value is an array
 */
export function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
}

/**
 * Transform policy response from backend format (name) to frontend format (title)
 * Also maps summary to description and snake_case date fields
 */
function transformPolicyResponse<T extends Record<string, unknown>>(policy: T): T {
  const transformed = { ...policy } as Record<string, unknown>;
  
  // Map 'name' to 'title' for frontend display
  if ('name' in transformed && !('title' in transformed)) {
    transformed.title = transformed.name;
  }
  
  // Map 'summary' to 'description' for frontend display
  if ('summary' in transformed && !('description' in transformed)) {
    transformed.description = transformed.summary;
  }
  
  // Map camelCase date fields to snake_case for frontend
  if ('effectiveDate' in transformed && !('effective_date' in transformed)) {
    transformed.effective_date = transformed.effectiveDate;
  }
  if ('reviewDate' in transformed && !('review_date' in transformed)) {
    transformed.review_date = transformed.reviewDate;
  }
  if ('createdAt' in transformed && !('created_at' in transformed)) {
    transformed.created_at = transformed.createdAt;
  }
  
  // Map owner fields if present
  if ('owner' in transformed && transformed.owner && typeof transformed.owner === 'object') {
    const owner = transformed.owner as Record<string, unknown>;
    if ('firstName' in owner) {
      transformed.owner_first_name = owner.firstName;
    }
    if ('lastName' in owner) {
      transformed.owner_last_name = owner.lastName;
    }
  }
  
  return transformed as T;
}

/**
 * Transform requirement response from backend format to frontend format
 * Maps snake_case date fields and owner information
 */
function transformRequirementResponse<T extends Record<string, unknown>>(requirement: T): T {
  const transformed = { ...requirement } as Record<string, unknown>;
  
  // Map 'description' field (already correct name)
  // Map 'framework' to 'regulation' for frontend display
  if ('framework' in transformed && !('regulation' in transformed)) {
    transformed.regulation = transformed.framework;
  }
  
  // Map camelCase date fields to snake_case for frontend
  if ('dueDate' in transformed && !('due_date' in transformed)) {
    transformed.due_date = transformed.dueDate;
  }
  if ('createdAt' in transformed && !('created_at' in transformed)) {
    transformed.created_at = transformed.createdAt;
  }
  
  // Map owner fields if present
  if ('owner' in transformed && transformed.owner && typeof transformed.owner === 'object') {
    const owner = transformed.owner as Record<string, unknown>;
    if ('firstName' in owner) {
      transformed.owner_first_name = owner.firstName;
    }
    if ('lastName' in owner) {
      transformed.owner_last_name = owner.lastName;
    }
  }
  
  return transformed as T;
}

/**
 * Unwrap paginated NestJS response (LIST-CONTRACT compliant)
 *
 * Expected response shape:
 * {
 *   success: true,
 *   data: { items: [...], total, page, pageSize, totalPages }
 * }
 */
export function unwrapPaginatedResponse<T>(response: { data: unknown }): { items: T[]; total: number; page: number; pageSize: number } {
  const data = response.data as PaginatedResponse<T> | { items: T[]; total: number; page?: number; pageSize?: number };
  
  // LIST-CONTRACT compliant format: { success: true, data: { items, total, page, pageSize, totalPages } }
  if ('success' in data && data.success && 'data' in data) {
    const paginatedData = (data as PaginatedResponse<T>).data;
    if (paginatedData && 'items' in paginatedData) {
      return {
        items: paginatedData.items,
        total: paginatedData.total,
        page: paginatedData.page,
        pageSize: paginatedData.pageSize,
      };
    }
  }
  
  // Legacy format with meta (backward compatibility)
  if ('success' in data && data.success && 'data' in data && 'meta' in data) {
    // Cast through unknown since we're doing runtime type checking
    const legacyData = data as unknown as { success: boolean; data: T[]; meta: { total: number; page: number; pageSize: number } };
    return {
      items: legacyData.data,
      total: legacyData.meta.total,
      page: legacyData.meta.page,
      pageSize: legacyData.meta.pageSize,
    };
  }
  
  // Direct paginated object format
  if ('items' in data) {
    return {
      items: data.items,
      total: data.total,
      page: data.page || 1,
      pageSize: data.pageSize || data.items.length,
    };
  }
  
  // Array format
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      pageSize: data.length,
    };
  }
  
  return { items: [], total: 0, page: 1, pageSize: 0 };
}

/**
 * Unwrap paginated policy response with field transformation
 */
export function unwrapPaginatedPolicyResponse<T>(
  response: { data: unknown }
): { items: T[]; total: number; page: number; pageSize: number } {
  const result = unwrapPaginatedResponse<Record<string, unknown>>(response);
  return {
    ...result,
    items: result.items.map(item => transformPolicyResponse(item)) as T[],
  };
}

/**
 * Unwrap paginated requirement response with field transformation
 */
export function unwrapPaginatedRequirementResponse<T>(
  response: { data: unknown }
): { items: T[]; total: number; page: number; pageSize: number } {
  const result = unwrapPaginatedResponse<Record<string, unknown>>(response);
  return {
    ...result,
    items: result.items.map(item => transformRequirementResponse(item)) as T[],
  };
}

// ============================================================================
// GRC Risk API
// ============================================================================

export const riskApi = {
  list: (tenantId: string, params?: URLSearchParams) => 
    api.get(`${API_PATHS.GRC_RISKS.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
  
  get: (tenantId: string, id: string) => 
    api.get(API_PATHS.GRC_RISKS.GET(id), withTenantId(tenantId)),
  
  getDetail: (tenantId: string, id: string) => 
    api.get(API_PATHS.GRC_RISKS.DETAIL(id), withTenantId(tenantId)),
  
  create: (tenantId: string, data: Record<string, unknown>) => 
    api.post(API_PATHS.GRC_RISKS.CREATE, data, withTenantId(tenantId)),
  
  update: (tenantId: string, id: string, data: Record<string, unknown>) => 
    api.patch(API_PATHS.GRC_RISKS.UPDATE(id), data, withTenantId(tenantId)),
  
  delete: (tenantId: string, id: string) => 
    api.delete(API_PATHS.GRC_RISKS.DELETE(id), withTenantId(tenantId)),
  
  summary: (tenantId: string) => 
    api.get(API_PATHS.GRC_RISKS.SUMMARY, withTenantId(tenantId)),
  
  statistics: (tenantId: string) => 
    api.get(API_PATHS.GRC_RISKS.STATISTICS, withTenantId(tenantId)),
  
  highSeverity: (tenantId: string) => 
    api.get(API_PATHS.GRC_RISKS.HIGH_SEVERITY, withTenantId(tenantId)),

  heatmap: (tenantId: string) =>
    api.get(API_PATHS.GRC_RISKS.HEATMAP, withTenantId(tenantId)),

  // Assessment management
  createAssessment: (tenantId: string, riskId: string, data: Record<string, unknown>) =>
    api.post(API_PATHS.GRC_RISKS.ASSESSMENTS(riskId), data, withTenantId(tenantId)),

  getAssessments: (tenantId: string, riskId: string, params?: URLSearchParams) =>
    api.get(`${API_PATHS.GRC_RISKS.ASSESSMENTS(riskId)}${params ? `?${params}` : ''}`, withTenantId(tenantId)),

  // Control management - use CONTROLS_LIST endpoint which returns { success: true, data: controls[] }
  // Note: CONTROLS endpoint returns the risk object with controls relation, not the controls array
  getLinkedControls: (tenantId: string, riskId: string) =>
    api.get(API_PATHS.GRC_RISKS.CONTROLS_LIST(riskId), withTenantId(tenantId)),

  linkControl: (tenantId: string, riskId: string, controlId: string, data?: Record<string, unknown>) =>
    api.post(API_PATHS.GRC_RISKS.LINK_CONTROL_WITH_EFFECTIVENESS(riskId, controlId), data || {}, withTenantId(tenantId)),

  unlinkControl: (tenantId: string, riskId: string, controlId: string) =>
    api.delete(API_PATHS.GRC_RISKS.LINK_CONTROL(riskId, controlId), withTenantId(tenantId)),

  updateControlEffectiveness: (tenantId: string, riskId: string, controlId: string, data: Record<string, unknown>) =>
    api.patch(API_PATHS.GRC_RISKS.UPDATE_CONTROL_EFFECTIVENESS(riskId, controlId), data, withTenantId(tenantId)),

  // Relationship management
  getLinkedPolicies: (tenantId: string, riskId: string) =>
    api.get(API_PATHS.GRC_RISKS.POLICIES(riskId), withTenantId(tenantId)),

  linkPolicies: (tenantId: string, riskId: string, policyIds: string[]) =>
    api.post(API_PATHS.GRC_RISKS.POLICIES(riskId), { policyIds }, withTenantId(tenantId)),

  linkPolicy: (tenantId: string, riskId: string, policyId: string) =>
    api.post(API_PATHS.GRC_RISKS.LINK_POLICY(riskId, policyId), {}, withTenantId(tenantId)),

  unlinkPolicy: (tenantId: string, riskId: string, policyId: string) =>
    api.delete(API_PATHS.GRC_RISKS.LINK_POLICY(riskId, policyId), withTenantId(tenantId)),

  getLinkedRequirements:(tenantId: string, riskId: string) =>
    api.get(API_PATHS.GRC_RISKS.REQUIREMENTS(riskId), withTenantId(tenantId)),

  linkRequirements: (tenantId: string, riskId: string, requirementIds: string[]) =>
    api.post(API_PATHS.GRC_RISKS.REQUIREMENTS(riskId), { requirementIds }, withTenantId(tenantId)),

  // Treatment Plan management
  getTreatmentActions: (tenantId: string, riskId: string) =>
    api.get(API_PATHS.GRC_RISKS.TREATMENT_ACTIONS(riskId), withTenantId(tenantId)),

  getTreatmentAction: (tenantId: string, riskId: string, actionId: string) =>
    api.get(API_PATHS.GRC_RISKS.TREATMENT_ACTION(riskId, actionId), withTenantId(tenantId)),

  createTreatmentAction: (tenantId: string, riskId: string, data: Record<string, unknown>) =>
    api.post(API_PATHS.GRC_RISKS.TREATMENT_ACTIONS(riskId), data, withTenantId(tenantId)),

  updateTreatmentAction: (tenantId: string, riskId: string, actionId: string, data: Record<string, unknown>) =>
    api.patch(API_PATHS.GRC_RISKS.TREATMENT_ACTION(riskId, actionId), data, withTenantId(tenantId)),

  deleteTreatmentAction: (tenantId: string, riskId: string, actionId: string) =>
    api.delete(API_PATHS.GRC_RISKS.TREATMENT_ACTION(riskId, actionId), withTenantId(tenantId)),

  getTreatmentSummary: (tenantId: string, riskId: string) =>
    api.get(API_PATHS.GRC_RISKS.TREATMENT_SUMMARY(riskId), withTenantId(tenantId)),

  // Risk Appetite methods
  getRisksAboveAppetite: (tenantId: string, appetiteScore: number, params?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC' }) => {
    const queryParams = new URLSearchParams({ appetiteScore: String(appetiteScore) });
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);
    return api.get(`${API_PATHS.GRC_RISKS.ABOVE_APPETITE}?${queryParams}`, withTenantId(tenantId));
  },

  getStatsWithAppetite: (tenantId: string, appetiteScore: number) =>
    api.get(`${API_PATHS.GRC_RISKS.STATS_WITH_APPETITE}?appetiteScore=${appetiteScore}`, withTenantId(tenantId)),

  // Residual Risk calculation methods
  recalculateResidual: (tenantId: string, riskId: string) =>
    api.post(API_PATHS.GRC_RISKS.RECALCULATE_RESIDUAL(riskId), {}, withTenantId(tenantId)),

  getControlsWithEffectiveness: (tenantId: string, riskId: string) =>
    api.get(API_PATHS.GRC_RISKS.CONTROLS_EFFECTIVENESS(riskId), withTenantId(tenantId)),

  updateEffectivenessOverride: (tenantId: string, riskId: string, controlId: string, overrideEffectivenessPercent: number | null) =>
    api.patch(API_PATHS.GRC_RISKS.UPDATE_EFFECTIVENESS_OVERRIDE(riskId, controlId), { overrideEffectivenessPercent }, withTenantId(tenantId)),
};

// ============================================================================
// GRC Policy API (Governance)
// ============================================================================

export const policyApi = {
  list: (tenantId: string, params?: URLSearchParams) => 
    api.get(`${API_PATHS.GRC_POLICIES.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
  
  get: (tenantId: string, id: string) => 
    api.get(API_PATHS.GRC_POLICIES.GET(id), withTenantId(tenantId)),
  
  create: (tenantId: string, data: Record<string, unknown>) => 
    api.post(API_PATHS.GRC_POLICIES.CREATE, data, withTenantId(tenantId)),
  
  update: (tenantId: string, id: string, data: Record<string, unknown>) => 
    api.patch(API_PATHS.GRC_POLICIES.UPDATE(id), data, withTenantId(tenantId)),
  
  delete: (tenantId: string, id: string) => 
    api.delete(API_PATHS.GRC_POLICIES.DELETE(id), withTenantId(tenantId)),
  
  summary: (tenantId: string) => 
    api.get(API_PATHS.GRC_POLICIES.SUMMARY, withTenantId(tenantId)),
  
  statistics: (tenantId: string) => 
    api.get(API_PATHS.GRC_POLICIES.STATISTICS, withTenantId(tenantId)),
  
  active: (tenantId: string) => 
    api.get(API_PATHS.GRC_POLICIES.ACTIVE, withTenantId(tenantId)),
  
  dueForReview: (tenantId: string) => 
    api.get(API_PATHS.GRC_POLICIES.DUE_FOR_REVIEW, withTenantId(tenantId)),

  // Relationship management
  getLinkedRisks: (tenantId: string, policyId: string) =>
    api.get(API_PATHS.GRC_POLICIES.RISKS(policyId), withTenantId(tenantId)),

  // Policy Version management
  versions: {
    list: (tenantId: string, policyId: string) =>
      api.get(API_PATHS.GRC_POLICIES.VERSIONS.LIST(policyId), withTenantId(tenantId)),
    
    get: (tenantId: string, policyId: string, versionId: string) =>
      api.get(API_PATHS.GRC_POLICIES.VERSIONS.GET(policyId, versionId), withTenantId(tenantId)),
    
    create: (tenantId: string, policyId: string, data: Record<string, unknown>) =>
      api.post(API_PATHS.GRC_POLICIES.VERSIONS.CREATE(policyId), data, withTenantId(tenantId)),
    
    update: (tenantId: string, policyId: string, versionId: string, data: Record<string, unknown>) =>
      api.patch(API_PATHS.GRC_POLICIES.VERSIONS.UPDATE(policyId, versionId), data, withTenantId(tenantId)),
    
    latest: (tenantId: string, policyId: string) =>
      api.get(API_PATHS.GRC_POLICIES.VERSIONS.LATEST(policyId), withTenantId(tenantId)),
    
    published: (tenantId: string, policyId: string) =>
      api.get(API_PATHS.GRC_POLICIES.VERSIONS.PUBLISHED(policyId), withTenantId(tenantId)),
    
    submitForReview: (tenantId: string, policyId: string, versionId: string) =>
      api.post(API_PATHS.GRC_POLICIES.VERSIONS.SUBMIT_FOR_REVIEW(policyId, versionId), {}, withTenantId(tenantId)),
    
    approve: (tenantId: string, policyId: string, versionId: string) =>
      api.post(API_PATHS.GRC_POLICIES.VERSIONS.APPROVE(policyId, versionId), {}, withTenantId(tenantId)),
    
    publish: (tenantId: string, policyId: string, versionId: string) =>
      api.post(API_PATHS.GRC_POLICIES.VERSIONS.PUBLISH(policyId, versionId), {}, withTenantId(tenantId)),
    
    retire: (tenantId: string, policyId: string, versionId: string) =>
      api.post(API_PATHS.GRC_POLICIES.VERSIONS.RETIRE(policyId, versionId), {}, withTenantId(tenantId)),
  },
};

// ============================================================================
// Audit Report Template API
// ============================================================================

export const auditReportTemplateApi = {
  list: (tenantId: string, params?: URLSearchParams) =>
    api.get(`${API_PATHS.AUDIT_REPORT_TEMPLATES.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
  
  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.AUDIT_REPORT_TEMPLATES.GET(id), withTenantId(tenantId)),
  
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(API_PATHS.AUDIT_REPORT_TEMPLATES.CREATE, data, withTenantId(tenantId)),
  
  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(API_PATHS.AUDIT_REPORT_TEMPLATES.UPDATE(id), data, withTenantId(tenantId)),
  
  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.AUDIT_REPORT_TEMPLATES.DELETE(id), withTenantId(tenantId)),
  
  render: (tenantId: string, id: string, context: Record<string, unknown>) =>
    api.post(API_PATHS.AUDIT_REPORT_TEMPLATES.RENDER(id), { context }, withTenantId(tenantId)),
  
  preview: (tenantId: string, templateBody: string, context: Record<string, unknown>) =>
    api.post(API_PATHS.AUDIT_REPORT_TEMPLATES.PREVIEW, { templateBody, context }, withTenantId(tenantId)),
  
  validate: (tenantId: string, templateBody: string) =>
    api.post(API_PATHS.AUDIT_REPORT_TEMPLATES.VALIDATE, { templateBody }, withTenantId(tenantId)),
  
  getPlaceholders: (tenantId: string, id: string) =>
    api.get(API_PATHS.AUDIT_REPORT_TEMPLATES.PLACEHOLDERS(id), withTenantId(tenantId)),
};

// ============================================================================
// Search API
// ============================================================================

export const searchApi = {
  search: (tenantId: string, entity: string, query: Record<string, unknown>) =>
    api.post(API_PATHS.SEARCH.GENERIC, { entity, ...query }, withTenantId(tenantId)),
  
  searchRisks: (tenantId: string, query: Record<string, unknown>) =>
    api.post(API_PATHS.SEARCH.RISKS, query, withTenantId(tenantId)),
  
  searchPolicies: (tenantId: string, query: Record<string, unknown>) =>
    api.post(API_PATHS.SEARCH.POLICIES, query, withTenantId(tenantId)),
  
  searchRequirements: (tenantId: string, query: Record<string, unknown>) =>
    api.post(API_PATHS.SEARCH.REQUIREMENTS, query, withTenantId(tenantId)),

  searchIssues: (tenantId: string, query: Record<string, unknown>) =>
    api.post(API_PATHS.SEARCH.ISSUES, query, withTenantId(tenantId)),

  searchAudits: (tenantId: string, query: Record<string, unknown>) =>
    api.post(API_PATHS.SEARCH.AUDITS, query, withTenantId(tenantId)),
};

// ============================================================================
// Metadata API
// ============================================================================

export const metadataApi = {
  // Field Metadata
  fields: {
    list: (tenantId: string, params?: URLSearchParams) =>
      api.get(`${API_PATHS.METADATA.FIELDS.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
    
    get: (tenantId: string, id: string) =>
      api.get(API_PATHS.METADATA.FIELDS.GET(id), withTenantId(tenantId)),
    
    create: (tenantId: string, data: Record<string, unknown>) =>
      api.post(API_PATHS.METADATA.FIELDS.CREATE, data, withTenantId(tenantId)),
    
    update: (tenantId: string, id: string, data: Record<string, unknown>) =>
      api.patch(API_PATHS.METADATA.FIELDS.UPDATE(id), data, withTenantId(tenantId)),
    
    delete: (tenantId: string, id: string) =>
      api.delete(API_PATHS.METADATA.FIELDS.DELETE(id), withTenantId(tenantId)),
    
    getTables: (tenantId: string) =>
      api.get(API_PATHS.METADATA.FIELDS.TABLES, withTenantId(tenantId)),
    
    getTags: (tenantId: string, fieldId: string) =>
      api.get(API_PATHS.METADATA.FIELDS.TAGS(fieldId), withTenantId(tenantId)),
    
    assignTag: (tenantId: string, fieldId: string, tagId: string) =>
      api.post(API_PATHS.METADATA.FIELDS.ASSIGN_TAG(fieldId), { tagId }, withTenantId(tenantId)),
    
    removeTag: (tenantId: string, fieldId: string, tagId: string) =>
      api.delete(API_PATHS.METADATA.FIELDS.REMOVE_TAG(fieldId, tagId), withTenantId(tenantId)),
  },
  
  // Classification Tags
  tags: {
    list: (tenantId: string, params?: URLSearchParams) =>
      api.get(`${API_PATHS.METADATA.TAGS.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
    
    get: (tenantId: string, id: string) =>
      api.get(API_PATHS.METADATA.TAGS.GET(id), withTenantId(tenantId)),
    
    create: (tenantId: string, data: Record<string, unknown>) =>
      api.post(API_PATHS.METADATA.TAGS.CREATE, data, withTenantId(tenantId)),
    
    update: (tenantId: string, id: string, data: Record<string, unknown>) =>
      api.patch(API_PATHS.METADATA.TAGS.UPDATE(id), data, withTenantId(tenantId)),
    
    delete: (tenantId: string, id: string) =>
      api.delete(API_PATHS.METADATA.TAGS.DELETE(id), withTenantId(tenantId)),
    
    getFields: (tenantId: string, tagId: string) =>
      api.get(API_PATHS.METADATA.TAGS.FIELDS(tagId), withTenantId(tenantId)),
  },
  
  // Seed default tags
  seed: (tenantId: string) =>
    api.post(API_PATHS.METADATA.SEED, {}, withTenantId(tenantId)),
};

// ============================================================================
// GRC Requirement API (Compliance)
// ============================================================================

export const requirementApi = {
  list: (tenantId: string, params?: URLSearchParams) => 
    api.get(`${API_PATHS.GRC_REQUIREMENTS.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
  
  get: (tenantId: string, id: string) => 
    api.get(API_PATHS.GRC_REQUIREMENTS.GET(id), withTenantId(tenantId)),
  
  create: (tenantId: string, data: Record<string, unknown>) => 
    api.post(API_PATHS.GRC_REQUIREMENTS.CREATE, data, withTenantId(tenantId)),
  
  update: (tenantId: string, id: string, data: Record<string, unknown>) => 
    api.patch(API_PATHS.GRC_REQUIREMENTS.UPDATE(id), data, withTenantId(tenantId)),
  
  delete: (tenantId: string, id: string) => 
    api.delete(API_PATHS.GRC_REQUIREMENTS.DELETE(id), withTenantId(tenantId)),
  
  summary: (tenantId: string) => 
    api.get(API_PATHS.GRC_REQUIREMENTS.SUMMARY, withTenantId(tenantId)),
  
  statistics: (tenantId: string) => 
    api.get(API_PATHS.GRC_REQUIREMENTS.STATISTICS, withTenantId(tenantId)),
  
  frameworks: (tenantId: string) => 
    api.get(API_PATHS.GRC_REQUIREMENTS.FRAMEWORKS, withTenantId(tenantId)),

  // Relationship management
  getLinkedRisks: (tenantId: string, requirementId: string) =>
    api.get(API_PATHS.GRC_REQUIREMENTS.RISKS(requirementId), withTenantId(tenantId)),
};

// ============================================================================
// ITSM API (IT Service Management) - ITIL v5 aligned
// ============================================================================

// Type definitions for ITSM entities
export interface ItsmServiceData {
  id: string;
  name: string;
  description?: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'MAINTENANCE';
  ownerUserId?: string;
  serviceId?: string;
  offeringId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItsmServiceDto {
  name: string;
  description?: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'MAINTENANCE';
  ownerUserId?: string;
  serviceId?: string;
  offeringId?: string;
}

export interface UpdateItsmServiceDto {
  name?: string;
  description?: string;
  criticality?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'MAINTENANCE';
  ownerUserId?: string;
  serviceId?: string;
  offeringId?: string;
}

export interface ItsmIncidentData {
  id: string;
  number: string;
  shortDescription: string;
  description?: string;
  state: string;
  status?: string;
  priority: string;
  impact: string;
  urgency: string;
  category?: string;
  riskReviewRequired: boolean;
  serviceId?: string;
  offeringId?: string;
  service?: ItsmServiceData;
  assigneeId?: string;
  requesterId?: string;
  resolutionNotes?: string;
  openedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItsmIncidentDto {
  shortDescription: string;
  description?: string;
  state?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  category?: string;
  serviceId?: string;
  offeringId?: string;
  assigneeId?: string;
  requesterId?: string;
}

export interface UpdateItsmIncidentDto {
  shortDescription?: string;
  description?: string;
  state?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  category?: string;
  resolutionNotes?: string;
  serviceId?: string;
  offeringId?: string;
  assigneeId?: string;
}

export interface ItsmAffectedCiListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  relationshipType?: string;
  impactScope?: string;
}

export interface ItsmIncidentCiLinkData {
  id: string;
  incidentId: string;
  ciId: string;
  relationshipType: string;
  impactScope: string | null;
  ci?: CmdbCiData;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItsmIncidentCiDto {
  ciId: string;
  relationshipType: string;
  impactScope?: string;
}

export interface ItsmIncidentImpactSummary {
  affectedCis: {
    count: number;
    topClasses: { className: string; count: number }[];
    criticalCount: number;
  };
  impactedServices: {
    serviceId: string;
    name: string;
    criticality: string | null;
    status: string;
    offeringsCount: number;
    isBoundToIncident: boolean;
  }[];
  impactedOfferings: {
    offeringId: string;
    name: string;
    serviceId: string;
    serviceName: string;
    status: string;
    isInferred: boolean;
  }[];
}

export interface ItsmChangeData {
  id: string;
  number: string;
  title: string;
  description?: string;
  type: 'STANDARD' | 'NORMAL' | 'EMERGENCY';
  state: 'DRAFT' | 'ASSESS' | 'AUTHORIZE' | 'IMPLEMENT' | 'REVIEW' | 'CLOSED';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  approvalStatus: 'NOT_REQUESTED' | 'REQUESTED' | 'APPROVED' | 'REJECTED';
  implementationPlan?: string;
  backoutPlan?: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  actualStartAt?: string;
  actualEndAt?: string;
  serviceId?: string;
  offeringId?: string;
  service?: ItsmServiceData;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItsmChangeDto {
  title: string;
  description?: string;
  type?: 'STANDARD' | 'NORMAL' | 'EMERGENCY';
  state?: 'DRAFT' | 'ASSESS' | 'AUTHORIZE' | 'IMPLEMENT' | 'REVIEW' | 'CLOSED';
  risk?: 'LOW' | 'MEDIUM' | 'HIGH';
  approvalStatus?: 'NOT_REQUESTED' | 'REQUESTED' | 'APPROVED' | 'REJECTED';
  implementationPlan?: string;
  backoutPlan?: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  serviceId?: string;
  offeringId?: string;
}

export interface UpdateItsmChangeDto {
  title?: string;
  description?: string;
  type?: 'STANDARD' | 'NORMAL' | 'EMERGENCY';
  state?: 'DRAFT' | 'ASSESS' | 'AUTHORIZE' | 'IMPLEMENT' | 'REVIEW' | 'CLOSED';
  risk?: 'LOW' | 'MEDIUM' | 'HIGH';
  approvalStatus?: 'NOT_REQUESTED' | 'REQUESTED' | 'APPROVED' | 'REJECTED';
  implementationPlan?: string;
  backoutPlan?: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  serviceId?: string;
  offeringId?: string;
}

export interface ItsmCalendarEventData {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string;
  changeId?: string | null;
  change?: Partial<ItsmChangeData>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItsmCalendarEventDto {
  title: string;
  type?: string;
  status?: string;
  startAt: string;
  endAt: string;
  changeId?: string;
}

export interface UpdateItsmCalendarEventDto {
  title?: string;
  type?: string;
  status?: string;
  startAt?: string;
  endAt?: string;
  changeId?: string | null;
}

export interface ItsmFreezeWindowData {
  id: string;
  name: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  scope: string;
  scopeRefId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItsmFreezeWindowDto {
  name: string;
  description?: string;
  startAt: string;
  endAt: string;
  scope: string;
  scopeRefId?: string;
  isActive?: boolean;
}

export interface UpdateItsmFreezeWindowDto {
  name?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  scope?: string;
  scopeRefId?: string | null;
  isActive?: boolean;
}

export interface ItsmCalendarConflictData {
  id: string;
  changeId: string;
  conflictType: string;
  severity: string;
  conflictingEventId?: string | null;
  conflictingFreezeId?: string | null;
  details: Record<string, unknown>;
  conflictingEvent?: ItsmCalendarEventData | null;
  conflictingFreeze?: ItsmFreezeWindowData | null;
  createdAt: string;
}

export interface ItsmPreviewConflictsDto {
  startAt: string;
  endAt: string;
  changeId?: string;
  serviceId?: string;
}

export interface ItsmConflictResult {
  conflictType: string;
  severity: string;
  conflictingEventId?: string;
  conflictingFreezeId?: string;
  details: Record<string, unknown>;
}

export interface ItsmApprovalData {
  id: string;
  tenantId: string;
  recordTable: string;
  recordId: string;
  state: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approverRole: string;
  approverUserId?: string;
  requestedBy: string;
  decidedAt?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskFactorData {
  name: string;
  weight: number;
  score: number;
  weightedScore: number;
  evidence: string;
}

export interface RiskAssessmentData {
  id: string;
  changeId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  computedAt: string;
  breakdown: RiskFactorData[];
  impactedCiCount: number;
  impactedServiceCount: number;
  hasFreezeConflict: boolean;
  hasSlaRisk: boolean;
}

export interface PolicyEvaluationResult {
  policyId: string;
  policyName: string;
  matched: boolean;
  actionsTriggered: Record<string, unknown>;
}

export type DecisionRecommendation = 'ALLOW' | 'REVIEW' | 'CAB_REQUIRED' | 'BLOCK';

export interface RuleTriggeredData {
  policyId: string;
  policyName: string;
  conditionsSummary: string;
  actionsSummary: string;
}

export interface PolicyEvaluationSummary {
  requireCABApproval: boolean;
  blockDuringFreeze: boolean;
  minLeadTimeHours: number | null;
  autoApproveIfRiskBelow: number | null;
  matchedPolicies: PolicyEvaluationResult[];
  rulesTriggered: RuleTriggeredData[];
  reasons: string[];
  requiredActions: string[];
  decisionRecommendation: DecisionRecommendation;
}

export interface RiskRecalculateResponse {
  assessment: RiskAssessmentData;
  policyEvaluation: PolicyEvaluationSummary;
}

export interface RiskAssessmentWithPolicyData {
  assessment: RiskAssessmentData | null;
  policyEvaluation: PolicyEvaluationSummary | null;
}

// Customer Risk Intelligence types
export type RelevancePath = 'service_binding' | 'offering_binding' | 'affected_ci' | 'blast_radius_ci';

export interface ResolvedCustomerRiskData {
  catalogRiskId: string;
  title: string;
  code: string | null;
  category: string;
  severity: string;
  likelihoodWeight: number;
  impactWeight: number;
  scoreContributionModel: string;
  scoreValue: number;
  status: string;
  remediationGuidance: string | null;
  relevancePaths: RelevancePath[];
  activeObservationCount: number;
  latestObservationStatus: string | null;
  contributionScore: number;
  contributionReason: string;
}

export interface CustomerRiskImpactData {
  changeId: string;
  resolvedRisks: ResolvedCustomerRiskData[];
  aggregateScore: number;
  aggregateLabel: string;
  topReasons: string[];
  calculatedAt: string;
  riskFactor: RiskFactorData;
}

export interface CustomerRiskRecalculateResponse {
  customerRiskImpact: CustomerRiskImpactData;
  assessment: RiskAssessmentData;
  policyEvaluation: PolicyEvaluationSummary;
}

export interface ChangePolicyData {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChangePolicyDto {
  name: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  conditions?: Record<string, unknown>;
  actions?: Record<string, unknown>;
}

export interface UpdateChangePolicyDto {
  name?: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  conditions?: Record<string, unknown>;
  actions?: Record<string, unknown>;
}

export interface ItsmChoiceData {
  id: string;
  tenantId: string;
  tableName: string;
  fieldName: string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  parentValue?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItsmChoiceDto {
  tableName: string;
  fieldName: string;
  value: string;
  label: string;
  sortOrder?: number;
  isActive?: boolean;
  parentValue?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateItsmChoiceDto {
  label?: string;
  sortOrder?: number;
  isActive?: boolean;
  parentValue?: string;
  metadata?: Record<string, unknown>;
}

export type ItsmJournalType = 'work_note' | 'comment';

export interface ItsmJournalEntryData {
  id: string;
  tenantId: string;
  tableName: string;
  recordId: string;
  type: ItsmJournalType;
  message: string;
  createdAt: string;
  createdBy?: string | null;
}

export interface CreateItsmJournalDto {
  type: ItsmJournalType;
  message: string;
}

export interface ItsmManagedTable {
  name: string;
  fields: string[];
}

export interface ItsmListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  state?: string;
  priority?: string;
  type?: string;
}

// ITSM API object with all endpoints
export const itsmApi = {
  // ITSM Services
  services: {
    list: (params?: ItsmListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.ITSM.SERVICES.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.ITSM.SERVICES.GET(id)),
    create: (data: CreateItsmServiceDto) => api.post(API_PATHS.ITSM.SERVICES.CREATE, data),
    update: (id: string, data: UpdateItsmServiceDto) => api.patch(API_PATHS.ITSM.SERVICES.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.SERVICES.DELETE(id)),
  },

  // ITSM Incidents
  incidents: {
    list: (params?: ItsmListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      if (params?.state) searchParams.set('state', params.state);
      if (params?.priority) searchParams.set('priority', params.priority);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.ITSM.INCIDENTS.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.ITSM.INCIDENTS.GET(id)),
    create: (data: CreateItsmIncidentDto) => api.post(API_PATHS.ITSM.INCIDENTS.CREATE, data),
    update: (id: string, data: UpdateItsmIncidentDto) => api.patch(API_PATHS.ITSM.INCIDENTS.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.INCIDENTS.DELETE(id)),
    // GRC Bridge - Risk linking
    getLinkedRisks: (incidentId: string) => api.get(API_PATHS.ITSM.INCIDENTS.RISKS(incidentId)),
    linkRisk: (incidentId: string, riskId: string) => api.post(API_PATHS.ITSM.INCIDENTS.LINK_RISK(incidentId, riskId), {}),
    unlinkRisk: (incidentId: string, riskId: string) => api.delete(API_PATHS.ITSM.INCIDENTS.UNLINK_RISK(incidentId, riskId)),
    // GRC Bridge - Control linking
    getLinkedControls: (incidentId: string) => api.get(API_PATHS.ITSM.INCIDENTS.CONTROLS(incidentId)),
    linkControl: (incidentId: string, controlId: string) => api.post(API_PATHS.ITSM.INCIDENTS.LINK_CONTROL(incidentId, controlId), {}),
    unlinkControl: (incidentId: string, controlId: string) => api.delete(API_PATHS.ITSM.INCIDENTS.UNLINK_CONTROL(incidentId, controlId)),
    // Impact & Blast Radius
    listAffectedCis: (incidentId: string, params?: ItsmAffectedCiListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.search) searchParams.set('search', params.search);
      if (params?.relationshipType) searchParams.set('relationshipType', params.relationshipType);
      if (params?.impactScope) searchParams.set('impactScope', params.impactScope);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.ITSM.INCIDENTS.AFFECTED_CIS(incidentId)}${queryString ? `?${queryString}` : ''}`);
    },
    addAffectedCi: (incidentId: string, data: CreateItsmIncidentCiDto) =>
      api.post(API_PATHS.ITSM.INCIDENTS.AFFECTED_CIS(incidentId), data),
    removeAffectedCi: (incidentId: string, linkId: string) =>
      api.delete(API_PATHS.ITSM.INCIDENTS.DELETE_AFFECTED_CI(incidentId, linkId)),
    getImpactSummary: (incidentId: string) =>
      api.get(API_PATHS.ITSM.INCIDENTS.IMPACT_SUMMARY(incidentId)),
  },

  // ITSM Changes
  changes: {
    list: (params?: ItsmListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      if (params?.state) searchParams.set('state', params.state);
      if (params?.type) searchParams.set('type', params.type);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.ITSM.CHANGES.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.ITSM.CHANGES.GET(id)),
    create: (data: CreateItsmChangeDto) => api.post(API_PATHS.ITSM.CHANGES.CREATE, data),
    update: (id: string, data: UpdateItsmChangeDto) => api.patch(API_PATHS.ITSM.CHANGES.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.CHANGES.DELETE(id)),
    // GRC Bridge - Risk linking
    getLinkedRisks: (changeId: string) => api.get(API_PATHS.ITSM.CHANGES.RISKS(changeId)),
    linkRisk: (changeId: string, riskId: string) => api.post(API_PATHS.ITSM.CHANGES.LINK_RISK(changeId, riskId), {}),
    unlinkRisk: (changeId: string, riskId: string) => api.delete(API_PATHS.ITSM.CHANGES.UNLINK_RISK(changeId, riskId)),
    // GRC Bridge - Control linking
    getLinkedControls: (changeId: string) => api.get(API_PATHS.ITSM.CHANGES.CONTROLS(changeId)),
    linkControl: (changeId: string, controlId: string) => api.post(API_PATHS.ITSM.CHANGES.LINK_CONTROL(changeId, controlId), {}),
    unlinkControl: (changeId: string, controlId: string) => api.delete(API_PATHS.ITSM.CHANGES.UNLINK_CONTROL(changeId, controlId)),
    conflicts: (changeId: string) => api.get(API_PATHS.ITSM.CHANGES.CONFLICTS(changeId)),
    refreshConflicts: (changeId: string) => api.post(API_PATHS.ITSM.CHANGES.REFRESH_CONFLICTS(changeId), {}),
    getRiskAssessment: (changeId: string) => api.get(API_PATHS.ITSM_CHANGE_RISK.GET(changeId)),
    recalculateRisk: (changeId: string) => api.post(API_PATHS.ITSM_CHANGE_RISK.RECALCULATE(changeId), {}),
    getCustomerRiskImpact: (changeId: string) => api.get(API_PATHS.ITSM_CHANGE_RISK.CUSTOMER_RISK_IMPACT(changeId)),
    recalculateCustomerRisk: (changeId: string) => api.post(API_PATHS.ITSM_CHANGE_RISK.RECALCULATE_CUSTOMER_RISK(changeId), {}),
    // Topology Intelligence - Change Impact
    getTopologyImpact: (changeId: string) =>
      api.get(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.CHANGE_IMPACT(changeId)),
    recalculateTopologyImpact: (changeId: string) =>
      api.post(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.CHANGE_RECALCULATE(changeId), {}),
    evaluateTopologyGovernance: (changeId: string) =>
      api.post(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.CHANGE_EVALUATE_GOVERNANCE(changeId), {}),
    // Topology Intelligence - Suggested Task Pack
    getSuggestedTaskPack: (changeId: string) =>
      api.get(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.CHANGE_SUGGESTED_TASK_PACK(changeId)),
    // Topology Intelligence - Traceability
    getTraceabilitySummary: (changeId: string) =>
      api.get(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.CHANGE_TRACEABILITY(changeId)),
    requestApproval:(changeId: string, comment?: string) =>
      api.post(API_PATHS.ITSM.CHANGES.REQUEST_APPROVAL(changeId), { comment }),
    listApprovals: (changeId: string) =>
      api.get(API_PATHS.ITSM.CHANGES.APPROVALS(changeId)),
    approveApproval: (approvalId: string, comment?: string) =>
      api.post(API_PATHS.ITSM.APPROVALS.APPROVE(approvalId), { comment }),
    rejectApproval: (approvalId: string, comment?: string) =>
      api.post(API_PATHS.ITSM.APPROVALS.REJECT(approvalId), { comment }),
  },

  changePolicies: {
    list: (params?: { page?: number; pageSize?: number; isActive?: boolean; q?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
      if (params?.q) searchParams.set('q', params.q);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.ITSM_CHANGE_POLICIES.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.ITSM_CHANGE_POLICIES.GET(id)),
    create: (data: CreateChangePolicyDto) => api.post(API_PATHS.ITSM_CHANGE_POLICIES.CREATE, data),
    update: (id: string, data: UpdateChangePolicyDto) => api.put(API_PATHS.ITSM_CHANGE_POLICIES.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM_CHANGE_POLICIES.DELETE(id)),
  },

  // ITSM Change Calendar
  calendar: {
    events: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        type?: string;
        status?: string;
        startFrom?: string;
        startTo?: string;
        q?: string;
      }) => {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
        if (params?.type) searchParams.set('type', params.type);
        if (params?.status) searchParams.set('status', params.status);
        if (params?.startFrom) searchParams.set('startFrom', params.startFrom);
        if (params?.startTo) searchParams.set('startTo', params.startTo);
        if (params?.q) searchParams.set('q', params.q);
        const queryString = searchParams.toString();
        return api.get(`${API_PATHS.ITSM.CALENDAR.EVENTS.LIST}${queryString ? `?${queryString}` : ''}`);
      },
      get: (id: string) => api.get(API_PATHS.ITSM.CALENDAR.EVENTS.GET(id)),
      create: (data: CreateItsmCalendarEventDto) =>
        api.post(API_PATHS.ITSM.CALENDAR.EVENTS.CREATE, data),
      update: (id: string, data: UpdateItsmCalendarEventDto) =>
        api.patch(API_PATHS.ITSM.CALENDAR.EVENTS.UPDATE(id), data),
      delete: (id: string) => api.delete(API_PATHS.ITSM.CALENDAR.EVENTS.DELETE(id)),
      previewConflicts: (data: ItsmPreviewConflictsDto) =>
        api.post(API_PATHS.ITSM.CALENDAR.EVENTS.PREVIEW_CONFLICTS, data),
    },
    freezeWindows: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        scope?: string;
        isActive?: string;
        startFrom?: string;
        startTo?: string;
        q?: string;
      }) => {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
        if (params?.scope) searchParams.set('scope', params.scope);
        if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
        if (params?.startFrom) searchParams.set('startFrom', params.startFrom);
        if (params?.startTo) searchParams.set('startTo', params.startTo);
        if (params?.q) searchParams.set('q', params.q);
        const queryString = searchParams.toString();
        return api.get(`${API_PATHS.ITSM.CALENDAR.FREEZE_WINDOWS.LIST}${queryString ? `?${queryString}` : ''}`);
      },
      get: (id: string) => api.get(API_PATHS.ITSM.CALENDAR.FREEZE_WINDOWS.GET(id)),
      create: (data: CreateItsmFreezeWindowDto) =>
        api.post(API_PATHS.ITSM.CALENDAR.FREEZE_WINDOWS.CREATE, data),
      update: (id: string, data: UpdateItsmFreezeWindowDto) =>
        api.patch(API_PATHS.ITSM.CALENDAR.FREEZE_WINDOWS.UPDATE(id), data),
      delete: (id: string) => api.delete(API_PATHS.ITSM.CALENDAR.FREEZE_WINDOWS.DELETE(id)),
    },
  },

  // ITSM Journal
  journal: {
    list: (
      table: string,
      recordId: string,
      params?: { page?: number; pageSize?: number; type?: ItsmJournalType; sortOrder?: 'ASC' | 'DESC' },
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.type) searchParams.set('type', params.type);
      if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
      const queryString = searchParams.toString();
      const url = API_PATHS.ITSM.JOURNAL.LIST(table, recordId);
      return api.get(`${url}${queryString ? `?${queryString}` : ''}`);
    },
    create: (table: string, recordId: string, data: CreateItsmJournalDto) =>
      api.post(API_PATHS.ITSM.JOURNAL.CREATE(table, recordId), data),
  },

  // ITSM Choices
  choices: {
    list: (tableName: string, fieldName?: string) => {
      const searchParams = new URLSearchParams();
      searchParams.set('table', tableName);
      if (fieldName) searchParams.set('field', fieldName);
      return api.get(`${API_PATHS.ITSM.CHOICES.LIST}?${searchParams.toString()}`);
    },
    tables: () => api.get(API_PATHS.ITSM.CHOICES.TABLES),
    get: (id: string) => api.get(API_PATHS.ITSM.CHOICES.GET(id)),
    create: (data: CreateItsmChoiceDto) => api.post(API_PATHS.ITSM.CHOICES.CREATE, data),
    update: (id: string, data: UpdateItsmChoiceDto) => api.patch(API_PATHS.ITSM.CHOICES.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.CHOICES.DELETE(id)),
  },

  // ITSM Business Rules
  businessRules: {
    list: () => api.get(API_PATHS.ITSM.BUSINESS_RULES.LIST),
    get: (id: string) => api.get(API_PATHS.ITSM.BUSINESS_RULES.GET(id)),
    create: (data: Record<string, unknown>) => api.post(API_PATHS.ITSM.BUSINESS_RULES.CREATE, data),
    update: (id: string, data: Record<string, unknown>) => api.patch(API_PATHS.ITSM.BUSINESS_RULES.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.BUSINESS_RULES.DELETE(id)),
    evaluate: (data: Record<string, unknown>) => api.post(API_PATHS.ITSM.BUSINESS_RULES.EVALUATE, data),
  },

  // ITSM UI Policies
  uiPolicies: {
    list: () => api.get(API_PATHS.ITSM.UI_POLICIES.LIST),
    get: (id: string) => api.get(API_PATHS.ITSM.UI_POLICIES.GET(id)),
    create: (data: Record<string, unknown>) => api.post(API_PATHS.ITSM.UI_POLICIES.CREATE, data),
    update: (id: string, data: Record<string, unknown>) => api.patch(API_PATHS.ITSM.UI_POLICIES.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.UI_POLICIES.DELETE(id)),
    byTable: (tableName: string) => api.get(API_PATHS.ITSM.UI_POLICIES.BY_TABLE(tableName)),
    evaluate: (data: Record<string, unknown>) => api.post(API_PATHS.ITSM.UI_POLICIES.EVALUATE, data),
  },

  // ITSM UI Actions
  uiActions: {
    list: () => api.get(API_PATHS.ITSM.UI_POLICIES.ACTIONS_LIST),
    get: (id: string) => api.get(API_PATHS.ITSM.UI_POLICIES.ACTIONS_GET(id)),
    create: (data: Record<string, unknown>) => api.post(API_PATHS.ITSM.UI_POLICIES.ACTIONS_CREATE, data),
    update: (id: string, data: Record<string, unknown>) => api.patch(API_PATHS.ITSM.UI_POLICIES.ACTIONS_UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.UI_POLICIES.ACTIONS_DELETE(id)),
  },

  // ITSM Workflows
  workflows: {
    list: () => api.get(API_PATHS.ITSM.WORKFLOWS.LIST),
    get: (id: string) => api.get(API_PATHS.ITSM.WORKFLOWS.GET(id)),
    create: (data: Record<string, unknown>) => api.post(API_PATHS.ITSM.WORKFLOWS.CREATE, data),
    update: (id: string, data: Record<string, unknown>) => api.patch(API_PATHS.ITSM.WORKFLOWS.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.WORKFLOWS.DELETE(id)),
    byTable: (tableName: string) => api.get(API_PATHS.ITSM.WORKFLOWS.BY_TABLE(tableName)),
    availableTransitions: (id: string, data: Record<string, unknown>) => api.post(API_PATHS.ITSM.WORKFLOWS.AVAILABLE_TRANSITIONS(id), data),
    validateTransition: (id: string, data: Record<string, unknown>) => api.post(API_PATHS.ITSM.WORKFLOWS.VALIDATE_TRANSITION(id), data),
  },

  // ITSM SLA
  sla: {
    listDefinitions: () => api.get(API_PATHS.ITSM.SLA.DEFINITIONS_LIST),
    getDefinition: (id: string) => api.get(API_PATHS.ITSM.SLA.DEFINITIONS_GET(id)),
    createDefinition: (data: Record<string, unknown>) => api.post(API_PATHS.ITSM.SLA.DEFINITIONS_CREATE, data),
    updateDefinition: (id: string, data: Record<string, unknown>) => api.patch(API_PATHS.ITSM.SLA.DEFINITIONS_UPDATE(id), data),
    deleteDefinition: (id: string) => api.delete(API_PATHS.ITSM.SLA.DEFINITIONS_DELETE(id)),
    listInstances: () => api.get(API_PATHS.ITSM.SLA.INSTANCES_LIST),
    recordSlas: (recordType: string, recordId: string) => api.get(API_PATHS.ITSM.SLA.RECORD_SLAS(recordType, recordId)),
    recompute: (id: string) => api.post(API_PATHS.ITSM.SLA.RECOMPUTE(id), {}),
  },

  // ITSM Diagnostics
  diagnostics: {
    health: () => api.get(API_PATHS.ITSM.DIAGNOSTICS.HEALTH),
    counts: () => api.get(API_PATHS.ITSM.DIAGNOSTICS.COUNTS),
    validateBaseline: () => api.post(API_PATHS.ITSM.DIAGNOSTICS.VALIDATE_BASELINE, {}),
    slaSummary: () => api.get(API_PATHS.ITSM.DIAGNOSTICS.SLA_SUMMARY),
  },

  // ITSM Problems
  problems: {
    list: (params?: ItsmProblemListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.search) searchParams.set('search', params.search);
      if (params?.state) searchParams.set('state', params.state);
      if (params?.priority) searchParams.set('priority', params.priority);
      if (params?.impact) searchParams.set('impact', params.impact);
      if (params?.category) searchParams.set('category', params.category);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.ITSM.PROBLEMS.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.ITSM.PROBLEMS.GET(id)),
    create: (data: CreateItsmProblemDto) => api.post(API_PATHS.ITSM.PROBLEMS.CREATE, data),
    update: (id: string, data: UpdateItsmProblemDto) => api.patch(API_PATHS.ITSM.PROBLEMS.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.PROBLEMS.DELETE(id)),
    statistics: () => api.get(API_PATHS.ITSM.PROBLEMS.STATISTICS),
    summary: (id: string) => api.get(API_PATHS.ITSM.PROBLEMS.SUMMARY(id)),
    rca: (id: string) => api.get(API_PATHS.ITSM.PROBLEMS.RCA(id)),
    markKnownError: (id: string) => api.post(API_PATHS.ITSM.PROBLEMS.MARK_KNOWN_ERROR(id), {}),
    unmarkKnownError: (id: string) => api.post(API_PATHS.ITSM.PROBLEMS.UNMARK_KNOWN_ERROR(id), {}),
    // Incident linking
    listIncidents: (id: string) => api.get(API_PATHS.ITSM.PROBLEMS.INCIDENTS(id)),
    linkIncident: (id: string, incidentId: string) => api.post(API_PATHS.ITSM.PROBLEMS.LINK_INCIDENT(id, incidentId), {}),
    unlinkIncident: (id: string, incidentId: string) => api.delete(API_PATHS.ITSM.PROBLEMS.UNLINK_INCIDENT(id, incidentId)),
    // Change linking
    listChanges: (id: string) => api.get(API_PATHS.ITSM.PROBLEMS.CHANGES(id)),
    linkChange: (id: string, changeId: string) => api.post(API_PATHS.ITSM.PROBLEMS.LINK_CHANGE(id, changeId), {}),
    unlinkChange: (id: string, changeId: string) => api.delete(API_PATHS.ITSM.PROBLEMS.UNLINK_CHANGE(id, changeId)),
    // Phase 2: RCA completion, reopen, recurrence
    completeRca: (id: string, data: CompleteRcaDto) => api.post(API_PATHS.ITSM.PROBLEMS.RCA_COMPLETE(id), data),
    reopen: (id: string, reason: string) => api.post(API_PATHS.ITSM.PROBLEMS.REOPEN(id), { reason }),
    recurrenceCandidates: (params?: { serviceId?: string; daysWindow?: number; minIncidents?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.serviceId) searchParams.set('serviceId', params.serviceId);
      if (params?.daysWindow) searchParams.set('daysWindow', String(params.daysWindow));
      if (params?.minIncidents) searchParams.set('minIncidents', String(params.minIncidents));
      const qs = searchParams.toString();
      return api.get(`${API_PATHS.ITSM.PROBLEMS.RECURRENCE_CANDIDATES}${qs ? `?${qs}` : ''}`);
    },
  },

  // ITSM Known Errors
  knownErrors: {
    list: (params?: ItsmKnownErrorListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.search) searchParams.set('search', params.search);
      if (params?.state) searchParams.set('state', params.state);
      if (params?.permanentFixStatus) searchParams.set('permanentFixStatus', params.permanentFixStatus);
      if (params?.problemId) searchParams.set('problemId', params.problemId);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.ITSM.KNOWN_ERRORS.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.ITSM.KNOWN_ERRORS.GET(id)),
    create: (data: CreateItsmKnownErrorDto) => api.post(API_PATHS.ITSM.KNOWN_ERRORS.CREATE, data),
    update: (id: string, data: UpdateItsmKnownErrorDto) => api.patch(API_PATHS.ITSM.KNOWN_ERRORS.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.KNOWN_ERRORS.DELETE(id)),
    // Phase 2: Lifecycle actions
    validate: (id: string) => api.post(API_PATHS.ITSM.KNOWN_ERRORS.VALIDATE(id), {}),
    publish: (id: string) => api.post(API_PATHS.ITSM.KNOWN_ERRORS.PUBLISH(id), {}),
    retire: (id: string) => api.post(API_PATHS.ITSM.KNOWN_ERRORS.RETIRE(id), {}),
    reopen: (id: string, reason: string) => api.post(API_PATHS.ITSM.KNOWN_ERRORS.REOPEN(id), { reason }),
  },

  // ITSM Major Incidents
  majorIncidents: {
    list: (params?: ItsmMajorIncidentListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.severity) searchParams.set('severity', params.severity);
      if (params?.commanderId) searchParams.set('commanderId', params.commanderId);
      if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
      if (params?.createdFrom) searchParams.set('createdFrom', params.createdFrom);
      if (params?.createdTo) searchParams.set('createdTo', params.createdTo);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.ITSM.MAJOR_INCIDENTS.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.ITSM.MAJOR_INCIDENTS.GET(id)),
    create: (data: CreateItsmMajorIncidentDto) => api.post(API_PATHS.ITSM.MAJOR_INCIDENTS.CREATE, data),
    update: (id: string, data: UpdateItsmMajorIncidentDto) => api.patch(API_PATHS.ITSM.MAJOR_INCIDENTS.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.ITSM.MAJOR_INCIDENTS.DELETE(id)),
    statistics: () => api.get(API_PATHS.ITSM.MAJOR_INCIDENTS.STATISTICS),
    getTimeline: (id: string, page?: number, pageSize?: number) => {
      const searchParams = new URLSearchParams();
      if (page) searchParams.set('page', String(page));
      if (pageSize) searchParams.set('pageSize', String(pageSize));
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.ITSM.MAJOR_INCIDENTS.TIMELINE(id)}${queryString ? `?${queryString}` : ''}`);
    },
    postTimelineUpdate: (id: string, data: CreateItsmMajorIncidentUpdateDto) =>
      api.post(API_PATHS.ITSM.MAJOR_INCIDENTS.TIMELINE(id), data),
    getLinks: (id: string, linkType?: string) => {
      const queryString = linkType ? `?linkType=${linkType}` : '';
      return api.get(`${API_PATHS.ITSM.MAJOR_INCIDENTS.LINKS(id)}${queryString}`);
    },
    linkRecord: (id: string, data: CreateItsmMajorIncidentLinkDto) =>
      api.post(API_PATHS.ITSM.MAJOR_INCIDENTS.LINKS(id), data),
    unlinkRecord: (id: string, linkId: string) =>
      api.delete(API_PATHS.ITSM.MAJOR_INCIDENTS.UNLINK(id, linkId)),
    // Topology Intelligence - RCA Hypotheses
    getRcaTopologyHypotheses: (id: string) =>
      api.get(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.MI_RCA_HYPOTHESES(id)),
    recalculateRcaTopologyHypotheses: (id: string) =>
      api.post(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.MI_RCA_RECALCULATE(id), {}),
    // RCA Orchestration — create records from hypotheses
    createProblemFromHypothesis: (miId: string, data: CreateProblemFromHypothesisRequest) =>
      api.post(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.MI_RCA_CREATE_PROBLEM(miId), data),
    createKnownErrorFromHypothesis: (miId: string, data: CreateKnownErrorFromHypothesisRequest) =>
      api.post(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.MI_RCA_CREATE_KNOWN_ERROR(miId), data),
    createPirActionFromHypothesis: (miId: string, data: CreatePirActionFromHypothesisRequest) =>
      api.post(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.MI_RCA_CREATE_PIR_ACTION(miId), data),
    // Traceability
    getTraceabilitySummary: (miId: string) =>
      api.get(API_PATHS.ITSM_TOPOLOGY_INTELLIGENCE.MI_TRACEABILITY(miId)),
  },
};

// ============================================================================
// Problem Management Types
// ============================================================================

export interface ItsmProblemData {
  id: string;
  number: string;
  shortDescription: string;
  title?: string; // deprecated alias – backend returns shortDescription
  description?: string;
  state: string;
  priority: string;
  impact: string;
  urgency: string;
  category?: string;
  source?: string;
  rootCauseSummary?: string;
  workaroundSummary?: string;
  knownErrorStatus?: string;
  riskLevel?: string;
  detectedAt?: string;
  openedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  ownerGroup?: string;
  assigneeId?: string;
  serviceId?: string;
  offeringId?: string;
  tenantId: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItsmProblemDto {
  shortDescription: string;
  description?: string;
  state?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  category?: string;
  source?: string;
  rootCauseSummary?: string;
  workaroundSummary?: string;
  assigneeId?: string;
  serviceId?: string;
  offeringId?: string;
}

export interface UpdateItsmProblemDto {
  shortDescription?: string;
  description?: string;
  state?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  category?: string;
  source?: string;
  rootCauseSummary?: string;
  workaroundSummary?: string;
  knownErrorStatus?: string;
  riskLevel?: string;
  assigneeId?: string;
  serviceId?: string;
  offeringId?: string;
  // Phase 2: Structured RCA fields
  fiveWhySummary?: string;
  contributingFactors?: string[];
  rootCauseCategory?: string;
  detectionGap?: string;
  monitoringGap?: string;
}

export interface CompleteRcaDto {
  rootCauseSummary?: string;
  fiveWhySummary?: string;
  contributingFactors?: string[];
  rootCauseCategory?: string;
  detectionGap?: string;
  monitoringGap?: string;
}

export interface ProblemRcaData {
  problemId: string;
  rcaEntries: Array<{ type: string; content: string; order: number; createdAt?: string; createdBy?: string }>;
  rootCauseSummary: string | null;
  fiveWhySummary: string | null;
  contributingFactors: string[];
  rootCauseCategory: string | null;
  detectionGap: string | null;
  monitoringGap: string | null;
  rcaCompletedAt: string | null;
  rcaCompletedBy: string | null;
}

export interface RecurrenceCandidateData {
  problemId: string;
  problemNumber: string;
  shortDescription: string;
  incidentCount: number;
  reopenCount: number;
  serviceId: string | null;
  state: string;
}

export interface ItsmProblemListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  state?: string;
  priority?: string;
  impact?: string;
  category?: string;
}

export interface ItsmKnownErrorData {
  id: string;
  title: string;
  symptoms?: string;
  rootCause?: string;
  workaround?: string;
  permanentFixStatus: string;
  articleRef?: string;
  state: string;
  publishedAt?: string;
  validatedAt?: string;
  validatedBy?: string;
  retiredAt?: string;
  knowledgeCandidate?: boolean;
  knowledgeCandidatePayload?: Record<string, unknown>;
  problemId?: string;
  metadata?: Record<string, unknown>;
  tenantId: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItsmKnownErrorDto {
  title: string;
  symptoms?: string;
  rootCause?: string;
  workaround?: string;
  permanentFixStatus?: string;
  articleRef?: string;
  state?: string;
  problemId?: string;
}

export interface UpdateItsmKnownErrorDto {
  title?: string;
  symptoms?: string;
  rootCause?: string;
  workaround?: string;
  permanentFixStatus?: string;
  articleRef?: string;
  state?: string;
  problemId?: string;
  knowledgeCandidate?: boolean;
  knowledgeCandidatePayload?: Record<string, unknown>;
}

export interface ItsmKnownErrorListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  state?: string;
  permanentFixStatus?: string;
  problemId?: string;
}

// ============================================================================
// ITSM Major Incident Types
// ============================================================================

export interface ItsmMajorIncidentData {
  id: string;
  tenantId: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  commanderId: string | null;
  communicationsLeadId: string | null;
  techLeadId: string | null;
  bridgeUrl: string | null;
  bridgeChannel: string | null;
  bridgeStartedAt: string | null;
  bridgeEndedAt: string | null;
  customerImpactSummary: string | null;
  businessImpactSummary: string | null;
  primaryServiceId: string | null;
  primaryOfferingId: string | null;
  declaredAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionSummary: string | null;
  resolutionCode: string | null;
  sourceIncidentId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  isDeleted: boolean;
}

export interface CreateItsmMajorIncidentDto {
  title: string;
  description?: string;
  severity?: string;
  commanderId?: string;
  communicationsLeadId?: string;
  techLeadId?: string;
  bridgeUrl?: string;
  bridgeChannel?: string;
  bridgeStartedAt?: string;
  customerImpactSummary?: string;
  businessImpactSummary?: string;
  primaryServiceId?: string;
  primaryOfferingId?: string;
  sourceIncidentId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateItsmMajorIncidentDto {
  title?: string;
  description?: string;
  status?: string;
  severity?: string;
  commanderId?: string;
  communicationsLeadId?: string;
  techLeadId?: string;
  bridgeUrl?: string;
  bridgeChannel?: string;
  bridgeStartedAt?: string;
  bridgeEndedAt?: string;
  customerImpactSummary?: string;
  businessImpactSummary?: string;
  primaryServiceId?: string;
  primaryOfferingId?: string;
  resolutionSummary?: string;
  resolutionCode?: string;
  metadata?: Record<string, unknown>;
}

export interface ItsmMajorIncidentUpdateData {
  id: string;
  tenantId: string;
  majorIncidentId: string;
  message: string;
  updateType: string;
  visibility: string;
  previousStatus: string | null;
  newStatus: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  createdBy: string | null;
}

export interface CreateItsmMajorIncidentUpdateDto {
  message: string;
  updateType?: string;
  visibility?: string;
  metadata?: Record<string, unknown>;
}

export interface ItsmMajorIncidentLinkData {
  id: string;
  tenantId: string;
  majorIncidentId: string;
  linkType: string;
  linkedRecordId: string;
  linkedRecordLabel: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface CreateItsmMajorIncidentLinkDto {
  linkType: string;
  linkedRecordId: string;
  linkedRecordLabel?: string;
  notes?: string;
}

export interface ItsmMajorIncidentListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  severity?: string;
  commanderId?: string;
  sortBy?: string;
  sortOrder?: string;
  createdFrom?: string;
  createdTo?: string;
}

// ============================================================================
// Topology Intelligence Types (Change Impact + MI RCA)
// ============================================================================

/** A single impacted node discovered via topology traversal */
export interface TopologyImpactedNode {
  id: string;
  type: 'ci' | 'service' | 'service_offering';
  label: string;
  className?: string;
  depth: number;
  criticality?: string;
  environment?: string;
}

/** A dependency path from root to an impacted node */
export interface TopologyImpactPath {
  nodeIds: string[];
  nodeLabels: string[];
  depth: number;
  relationTypes: string[];
}

/** Fragility signal - SPOF, no redundancy, high fan-out, deep chain */
export type FragilitySignalType =
  | 'single_point_of_failure'
  | 'no_redundancy'
  | 'high_fan_out'
  | 'deep_chain';

export interface FragilitySignal {
  type: FragilitySignalType;
  nodeId: string;
  nodeLabel: string;
  reason: string;
  severity: number;
}

/** Blast radius metrics breakdown */
export interface TopologyBlastRadiusMetrics {
  totalImpactedNodes: number;
  impactedByDepth: Record<number, number>;
  impactedServiceCount: number;
  impactedOfferingCount: number;
  impactedCiCount: number;
  criticalCiCount: number;
  maxChainDepth: number;
  crossServicePropagation: boolean;
  crossServiceCount: number;
}

/** Full topology impact response for a change */
export interface TopologyImpactResponseData {
  changeId: string;
  rootNodeIds: string[];
  metrics: TopologyBlastRadiusMetrics;
  impactedNodes: TopologyImpactedNode[];
  topPaths: TopologyImpactPath[];
  fragilitySignals: FragilitySignal[];
  topologyRiskScore: number;
  riskExplanation: string;
  computedAt: string;
  warnings: string[];
}

/** RCA hypothesis type */
export type RcaHypothesisType =
  | 'common_upstream_dependency'
  | 'recent_change_on_shared_node'
  | 'single_point_of_failure'
  | 'high_impact_node'
  | 'cross_service_dependency';

/** Evidence supporting an RCA hypothesis */
export interface RcaEvidence {
  type: 'topology_path' | 'recent_change' | 'health_violation' | 'customer_risk' | 'incident_history';
  description: string;
  referenceId?: string;
  referenceLabel?: string;
}

/** Recommended follow-up action from RCA */
export interface RcaRecommendedAction {
  type: 'create_problem' | 'link_problem' | 'create_known_error' | 'create_change_task';
  label: string;
  reason: string;
  confidence: number;
}

/** A single RCA hypothesis for a major incident */
export interface RcaHypothesisData {
  id: string;
  type: RcaHypothesisType;
  score: number;
  suspectNodeId: string;
  suspectNodeLabel: string;
  suspectNodeType: 'ci' | 'service' | 'service_offering';
  explanation: string;
  evidence: RcaEvidence[];
  affectedServiceIds: string[];
  recommendedActions: RcaRecommendedAction[];
}

/** Full RCA topology hypotheses response for a major incident */
export interface RcaTopologyHypothesesResponseData {
  majorIncidentId: string;
  rootServiceIds: string[];
  linkedCiIds: string[];
  hypotheses: RcaHypothesisData[];
  nodesAnalyzed: number;
  computedAt: string;
  warnings: string[];
}

// ============================================================================
// Topology Governance Types (Change Governance Auto-Enforcement)
// ============================================================================

/** Governance decision recommendation level */
export type TopologyGovernanceDecision =
  | 'ALLOWED'
  | 'CAB_REQUIRED'
  | 'BLOCKED'
  | 'ADDITIONAL_EVIDENCE_REQUIRED';

/** A single topology factor that contributed to the governance decision */
export interface TopologyGovernanceFactor {
  key: string;
  label: string;
  value: string | number | boolean;
  severity: 'info' | 'warning' | 'critical';
  explanation: string;
}

/** A single recommended action from the governance evaluation */
export interface TopologyGovernanceAction {
  key: string;
  label: string;
  required: boolean;
  satisfied: boolean;
  reason: string;
}

/** Policy-ready computed flags from topology analysis */
export interface TopologyPolicyFlags {
  topologyRiskScore: number;
  topologyHighBlastRadius: boolean;
  topologyFragilitySignalsCount: number;
  topologyCriticalDependencyTouched: boolean;
  topologySinglePointOfFailureRisk: boolean;
}

/** Explainability payload for governance decisions */
export interface TopologyGovernanceExplainability {
  summary: string;
  factors: TopologyGovernanceFactor[];
  topDependencyPaths: Array<{
    nodeLabels: string[];
    depth: number;
  }>;
  matchedPolicyNames: string[];
}

/** Full topology governance evaluation response */
export interface TopologyGovernanceEvaluationData {
  changeId: string;
  decision: TopologyGovernanceDecision;
  policyFlags: TopologyPolicyFlags;
  recommendedActions: TopologyGovernanceAction[];
  explainability: TopologyGovernanceExplainability;
  topologyDataAvailable: boolean;
  evaluatedAt: string;
  warnings: string[];
}

// ============================================================================
// RCA Orchestration Types (Phase-C, Phase 2)
// ============================================================================

/** Traceability metadata attached to records created from RCA hypotheses */
export interface RcaTraceabilityMeta {
  sourceType: 'TOPOLOGY_RCA_HYPOTHESIS';
  sourceHypothesisId: string;
  sourceMajorIncidentId: string;
  suspectNodeLabel: string;
  suspectNodeType: string;
  hypothesisType: string;
  hypothesisScore: number;
}

/** Request to create a Problem from an RCA hypothesis */
export interface CreateProblemFromHypothesisRequest {
  majorIncidentId: string;
  hypothesisId: string;
  shortDescription: string;
  description?: string;
  category?: string;
  impact?: string;
  urgency?: string;
  serviceId?: string;
  assignmentGroup?: string;
}

/** Request to create a Known Error from an RCA hypothesis */
export interface CreateKnownErrorFromHypothesisRequest {
  majorIncidentId: string;
  hypothesisId: string;
  title: string;
  symptoms?: string;
  rootCause?: string;
  workaround?: string;
  problemId?: string;
}

/** Request to create a PIR Action from an RCA hypothesis */
export interface CreatePirActionFromHypothesisRequest {
  majorIncidentId: string;
  hypothesisId: string;
  pirId: string;
  title: string;
  description?: string;
  priority?: string;
  ownerId?: string;
  dueDate?: string;
}

/** Response from RCA orchestration endpoints */
export interface RcaOrchestrationResultData<T = Record<string, unknown>> {
  record: T;
  traceability: RcaTraceabilityMeta;
  summary: string;
}

// ============================================================================
// Suggested Task Pack Types (Phase-C, Phase 3)
// ============================================================================

/** A single suggested task from topology analysis */
export interface SuggestedTaskData {
  templateKey: string;
  category: 'VALIDATION' | 'ROLLBACK_READINESS' | 'DEPENDENCY_COMMUNICATION' | 'MONITORING' | 'DOCUMENTATION';
  title: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  triggerSignals: string[];
  recommended: boolean;
}

/** Suggested task pack response */
export interface SuggestedTaskPackResponseData {
  changeId: string;
  riskLevel: string;
  topologyRiskScore: number;
  tasks: SuggestedTaskData[];
  totalTasks: number;
  recommendedCount: number;
  generatedAt: string;
  warnings: string[];
}

// ============================================================================
// Closed-Loop Traceability Types (Phase-C, Phase 3)
// ============================================================================

/** A node in the traceability chain */
export interface TraceabilityNodeData {
  type: 'CHANGE' | 'MAJOR_INCIDENT' | 'PROBLEM' | 'KNOWN_ERROR' | 'PIR' | 'PIR_ACTION' | 'TOPOLOGY_ANALYSIS' | 'GOVERNANCE_DECISION' | 'RCA_HYPOTHESIS';
  id: string;
  label: string;
  status: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

/** An edge in the traceability chain */
export interface TraceabilityEdgeData {
  fromId: string;
  toId: string;
  relation: 'TRIGGERED' | 'CREATED_FROM' | 'ANALYZED_BY' | 'DECIDED_BY' | 'RESULTED_IN' | 'LINKED_TO';
  label: string;
}

/** Traceability summary response */
export interface TraceabilitySummaryResponseData {
  rootId: string;
  rootType: 'CHANGE' | 'MAJOR_INCIDENT';
  nodes: TraceabilityNodeData[];
  edges: TraceabilityEdgeData[];
  summary: string;
  metrics: {
    totalNodes: number;
    totalEdges: number;
    hasTopologyAnalysis: boolean;
    hasGovernanceDecision: boolean;
    hasOrchestrationActions: boolean;
    completenessScore: number;
  };
  generatedAt: string;
}

// ============================================================================
// PIR (Post-Incident Review) Types
// ============================================================================

export interface ItsmPirData {
  id: string;
  tenantId: string;
  majorIncidentId: string;
  title: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'CLOSED';
  summary: string | null;
  whatHappened: string | null;
  timelineHighlights: string | null;
  rootCauses: string | null;
  whatWorkedWell: string | null;
  whatDidNotWork: string | null;
  customerImpact: string | null;
  detectionEffectiveness: string | null;
  responseEffectiveness: string | null;
  preventiveActions: string | null;
  correctiveActions: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  submittedAt: string | null;
  closedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateItsmPirDto {
  majorIncidentId: string;
  title: string;
  summary?: string;
  whatHappened?: string;
  timelineHighlights?: string;
  rootCauses?: string;
  whatWorkedWell?: string;
  whatDidNotWork?: string;
  customerImpact?: string;
  detectionEffectiveness?: string;
  responseEffectiveness?: string;
  preventiveActions?: string;
  correctiveActions?: string;
}

export interface UpdateItsmPirDto {
  title?: string;
  status?: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'CLOSED';
  summary?: string;
  whatHappened?: string;
  timelineHighlights?: string;
  rootCauses?: string;
  whatWorkedWell?: string;
  whatDidNotWork?: string;
  customerImpact?: string;
  detectionEffectiveness?: string;
  responseEffectiveness?: string;
  preventiveActions?: string;
  correctiveActions?: string;
}

export interface ItsmPirActionData {
  id: string;
  tenantId: string;
  pirId: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  dueDate: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  problemId: string | null;
  changeId: string | null;
  riskObservationId: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItsmPirActionDto {
  pirId: string;
  title: string;
  description?: string;
  ownerId?: string;
  dueDate?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  problemId?: string;
  changeId?: string;
  riskObservationId?: string;
}

export interface UpdateItsmPirActionDto {
  title?: string;
  description?: string;
  ownerId?: string;
  dueDate?: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  problemId?: string;
  changeId?: string;
  riskObservationId?: string;
}

export interface ItsmKnowledgeCandidateData {
  id: string;
  tenantId: string;
  title: string;
  sourceType: 'PIR' | 'KNOWN_ERROR' | 'PROBLEM';
  sourceId: string;
  status: 'DRAFT' | 'REVIEWED' | 'PUBLISHED' | 'REJECTED';
  content: Record<string, unknown> | null;
  synopsis: string | null;
  resolution: string | null;
  rootCauseSummary: string | null;
  workaround: string | null;
  symptoms: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItsmPirListParams {
  page?: number;
  pageSize?: number;
  majorIncidentId?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface ItsmPirActionListParams {
  page?: number;
  pageSize?: number;
  pirId?: string;
  status?: string;
  ownerId?: string;
  overdue?: string;
  sortBy?: string;
  sortOrder?: string;
}

// PIR API methods
export const pirApi = {
  list: (params?: ItsmPirListParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.majorIncidentId) searchParams.set('majorIncidentId', params.majorIncidentId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    const queryString = searchParams.toString();
    return api.get(`${API_PATHS.ITSM.PIRS.LIST}${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => api.get(API_PATHS.ITSM.PIRS.GET(id)),
  getByMajorIncident: (majorIncidentId: string) => api.get(API_PATHS.ITSM.PIRS.BY_MI(majorIncidentId)),
  create: (data: CreateItsmPirDto) => api.post(API_PATHS.ITSM.PIRS.CREATE, data),
  update: (id: string, data: UpdateItsmPirDto) => api.patch(API_PATHS.ITSM.PIRS.UPDATE(id), data),
  approve: (id: string) => api.post(API_PATHS.ITSM.PIRS.APPROVE(id), {}),
  delete: (id: string) => api.delete(API_PATHS.ITSM.PIRS.DELETE(id)),
};

export const pirActionApi = {
  list: (params?: ItsmPirActionListParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.pirId) searchParams.set('pirId', params.pirId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.ownerId) searchParams.set('ownerId', params.ownerId);
    if (params?.overdue) searchParams.set('overdue', params.overdue);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    const queryString = searchParams.toString();
    return api.get(`${API_PATHS.ITSM.PIR_ACTIONS.LIST}${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => api.get(API_PATHS.ITSM.PIR_ACTIONS.GET(id)),
  create: (data: CreateItsmPirActionDto) => api.post(API_PATHS.ITSM.PIR_ACTIONS.CREATE, data),
  update: (id: string, data: UpdateItsmPirActionDto) => api.patch(API_PATHS.ITSM.PIR_ACTIONS.UPDATE(id), data),
  delete: (id: string) => api.delete(API_PATHS.ITSM.PIR_ACTIONS.DELETE(id)),
  overdue: () => api.get(API_PATHS.ITSM.PIR_ACTIONS.OVERDUE),
};

export const knowledgeCandidateApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string; sourceType?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.status) searchParams.set('status', params.status);
    if (params?.sourceType) searchParams.set('sourceType', params.sourceType);
    if (params?.search) searchParams.set('search', params.search);
    const queryString = searchParams.toString();
    return api.get(`${API_PATHS.ITSM.KNOWLEDGE_CANDIDATES.LIST}${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => api.get(API_PATHS.ITSM.KNOWLEDGE_CANDIDATES.GET(id)),
  generateFromPir: (pirId: string) => api.post(API_PATHS.ITSM.KNOWLEDGE_CANDIDATES.GENERATE_FROM_PIR(pirId), {}),
  generateFromKnownError: (keId: string) => api.post(API_PATHS.ITSM.KNOWLEDGE_CANDIDATES.GENERATE_FROM_KE(keId), {}),
  generateFromProblem: (problemId: string) => api.post(API_PATHS.ITSM.KNOWLEDGE_CANDIDATES.GENERATE_FROM_PROBLEM(problemId), {}),
  review: (id: string) => api.post(API_PATHS.ITSM.KNOWLEDGE_CANDIDATES.REVIEW(id), {}),
  publish: (id: string) => api.post(API_PATHS.ITSM.KNOWLEDGE_CANDIDATES.PUBLISH(id), {}),
  reject: (id: string) => api.post(API_PATHS.ITSM.KNOWLEDGE_CANDIDATES.REJECT(id), {}),
  delete: (id: string) => api.delete(API_PATHS.ITSM.KNOWLEDGE_CANDIDATES.DELETE(id)),
};

// ============================================================================
// ITSM Analytics Types (Phase 4 - Closed-Loop Analytics Dashboard)
// ============================================================================

export interface AnalyticsFilterParams {
  dateFrom?: string;
  dateTo?: string;
  serviceId?: string;
  severity?: string;
  team?: string;
  priority?: string;
  category?: string;
}

export interface CountByLabel {
  label: string;
  count: number;
}

export interface TrendPoint {
  [key: string]: string | number;
  period: string;
  opened: number;
  closed: number;
  resolved: number;
}

export interface AgingBucket {
  bucket: string;
  count: number;
}

export interface BacklogItem {
  id: string;
  type: string;
  title: string;
  priority: string;
  state: string;
  ageDays: number;
  lastUpdated: string;
  assignee: string | null;
}

export interface ExecutiveSummaryData {
  kpis: {
    totalProblems: number;
    openProblems: number;
    openMajorIncidents: number;
    pirCompletionPct: number;
    actionOverdueCount: number;
    knownErrorsPublished: number;
    knowledgeCandidatesGenerated: number;
    problemReopenRate: number;
  };
  problemTrend: TrendPoint[];
  majorIncidentTrend: TrendPoint[];
  closureEffectiveness: {
    problemClosureRate: number;
    actionClosureRate: number;
    avgDaysToCloseProblem: number;
    avgDaysToCloseAction: number;
  };
  severityDistribution: CountByLabel[];
  generatedAt: string;
}

export interface ProblemTrendsData {
  stateDistribution: CountByLabel[];
  priorityDistribution: CountByLabel[];
  categoryDistribution: CountByLabel[];
  trend: TrendPoint[];
  aging: AgingBucket[];
  reopenedCount: number;
  avgDaysOpen: number;
}

export interface MajorIncidentMetricsData {
  totalCount: number;
  byStatus: CountByLabel[];
  bySeverity: CountByLabel[];
  mttrHours: number | null;
  avgBridgeDurationHours: number | null;
  pirCompletionRate: number;
  trend: TrendPoint[];
  generatedAt: string;
}

export interface PirEffectivenessData {
  totalPirs: number;
  statusDistribution: CountByLabel[];
  actionCompletionRate: number;
  actionOverdueCount: number;
  avgDaysToCompleteAction: number | null;
  knowledgeCandidateCount: number;
  knowledgeCandidatesByStatus: CountByLabel[];
  generatedAt: string;
}

export interface KnownErrorLifecycleData {
  totalCount: number;
  stateDistribution: CountByLabel[];
  fixStatusDistribution: CountByLabel[];
  publicationRate: number;
  retirementRate: number;
  problemToKeConversionRate: number;
  generatedAt: string;
}

export interface ClosureEffectivenessData {
  problemClosureRateTrend: TrendPoint[];
  reopenedProblemRate: number;
  reopenedProblems: number;
  actionClosureRate: number;
  avgDaysToCloseProblem: number | null;
  avgDaysToCloseAction: number | null;
  pirClosureRate: number;
  generatedAt: string;
}

export interface BacklogSummaryData {
  openProblemsByPriority: CountByLabel[];
  openActionsByPriority: CountByLabel[];
  overdueActions: number;
  staleItems: number;
  items: BacklogItem[];
  generatedAt: string;
}

function buildAnalyticsQuery(params?: AnalyticsFilterParams): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params.dateTo) searchParams.set('dateTo', params.dateTo);
  if (params.serviceId) searchParams.set('serviceId', params.serviceId);
  if (params.severity) searchParams.set('severity', params.severity);
  if (params.team) searchParams.set('team', params.team);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.category) searchParams.set('category', params.category);
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const itsmAnalyticsApi = {
  getExecutiveSummary: async (params?: AnalyticsFilterParams): Promise<ExecutiveSummaryData> => {
    const response = await api.get(`${API_PATHS.ITSM.ANALYTICS.EXECUTIVE_SUMMARY}${buildAnalyticsQuery(params)}`);
    return unwrapResponse<ExecutiveSummaryData>(response);
  },
  getProblemTrends: async (params?: AnalyticsFilterParams): Promise<ProblemTrendsData> => {
    const response = await api.get(`${API_PATHS.ITSM.ANALYTICS.PROBLEM_TRENDS}${buildAnalyticsQuery(params)}`);
    return unwrapResponse<ProblemTrendsData>(response);
  },
  getMajorIncidentMetrics: async (params?: AnalyticsFilterParams): Promise<MajorIncidentMetricsData> => {
    const response = await api.get(`${API_PATHS.ITSM.ANALYTICS.MAJOR_INCIDENT_METRICS}${buildAnalyticsQuery(params)}`);
    return unwrapResponse<MajorIncidentMetricsData>(response);
  },
  getPirEffectiveness: async (params?: AnalyticsFilterParams): Promise<PirEffectivenessData> => {
    const response = await api.get(`${API_PATHS.ITSM.ANALYTICS.PIR_EFFECTIVENESS}${buildAnalyticsQuery(params)}`);
    return unwrapResponse<PirEffectivenessData>(response);
  },
  getKnownErrorLifecycle: async (params?: AnalyticsFilterParams): Promise<KnownErrorLifecycleData> => {
    const response = await api.get(`${API_PATHS.ITSM.ANALYTICS.KNOWN_ERROR_LIFECYCLE}${buildAnalyticsQuery(params)}`);
    return unwrapResponse<KnownErrorLifecycleData>(response);
  },
  getClosureEffectiveness: async (params?: AnalyticsFilterParams): Promise<ClosureEffectivenessData> => {
    const response = await api.get(`${API_PATHS.ITSM.ANALYTICS.CLOSURE_EFFECTIVENESS}${buildAnalyticsQuery(params)}`);
    return unwrapResponse<ClosureEffectivenessData>(response);
  },
  getBacklog: async (params?: AnalyticsFilterParams): Promise<BacklogSummaryData> => {
    const response = await api.get(`${API_PATHS.ITSM.ANALYTICS.BACKLOG}${buildAnalyticsQuery(params)}`);
    return unwrapResponse<BacklogSummaryData>(response);
  },
};

// CMDB Types
export interface CmdbCiClassData {
  id: string;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  parentClassId?: string;
  isActive: boolean;
  sortOrder: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCmdbCiClassDto {
  name: string;
  label: string;
  description?: string;
  icon?: string;
  parentClassId?: string;
  isActive?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateCmdbCiClassDto {
  name?: string;
  label?: string;
  description?: string;
  icon?: string;
  parentClassId?: string;
  isActive?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface CmdbCiData {
  id: string;
  name: string;
  description?: string;
  classId: string;
  ciClass?: CmdbCiClassData;
  lifecycle: string;
  environment: string;
  category?: string;
  assetTag?: string;
  serialNumber?: string;
  ipAddress?: string;
  dnsName?: string;
  managedBy?: string;
  ownedBy?: string;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCmdbCiDto {
  name: string;
  description?: string;
  classId: string;
  lifecycle?: string;
  environment?: string;
  category?: string;
  assetTag?: string;
  serialNumber?: string;
  ipAddress?: string;
  dnsName?: string;
  managedBy?: string;
  ownedBy?: string;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateCmdbCiDto {
  name?: string;
  description?: string;
  classId?: string;
  lifecycle?: string;
  environment?: string;
  category?: string;
  assetTag?: string;
  serialNumber?: string;
  ipAddress?: string;
  dnsName?: string;
  managedBy?: string;
  ownedBy?: string;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CmdbCiRelData {
  id: string;
  sourceCiId: string;
  sourceCi?: CmdbCiData;
  targetCiId: string;
  targetCi?: CmdbCiData;
  type: string;
  notes?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCmdbCiRelDto {
  sourceCiId: string;
  targetCiId: string;
  type: string;
  notes?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CmdbServiceData {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  tier: string | null;
  criticality: string | null;
  ownerUserId: string | null;
  ownerEmail: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isDeleted: boolean;
  offerings?: CmdbServiceOfferingData[];
}

export interface CreateCmdbServiceDto {
  name: string;
  description?: string;
  type: string;
  status?: string;
  tier?: string;
  criticality?: string;
  ownerUserId?: string;
  ownerEmail?: string;
}

export interface UpdateCmdbServiceDto {
  name?: string;
  description?: string;
  type?: string;
  status?: string;
  tier?: string;
  criticality?: string;
  ownerUserId?: string;
  ownerEmail?: string;
}

export interface CmdbServiceOfferingData {
  id: string;
  tenantId: string;
  serviceId: string;
  name: string;
  status: string;
  supportHours: string | null;
  defaultSlaProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isDeleted: boolean;
  service?: CmdbServiceData;
}

export interface CreateCmdbServiceOfferingDto {
  serviceId: string;
  name: string;
  status?: string;
  supportHours?: string;
  defaultSlaProfileId?: string;
}

export interface UpdateCmdbServiceOfferingDto {
  name?: string;
  status?: string;
  supportHours?: string;
  defaultSlaProfileId?: string;
}

export interface CmdbServiceCiData {
  id: string;
  tenantId: string;
  serviceId: string;
  ciId: string;
  relationshipType: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isDeleted: boolean;
  service?: CmdbServiceData;
  ci?: CmdbCiData;
}

export interface CreateCmdbServiceCiDto {
  relationshipType: string;
  isPrimary?: boolean;
}

// CMDB Import & Reconciliation types
export interface CmdbImportSourceData {
  id: string;
  tenantId: string;
  name: string;
  type: 'CSV' | 'HTTP' | 'WEBHOOK' | 'JSON';
  config: Record<string, unknown> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCmdbImportSourceDto {
  name: string;
  type?: 'CSV' | 'HTTP' | 'WEBHOOK' | 'JSON';
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface CmdbImportJobData {
  id: string;
  tenantId: string;
  sourceId: string | null;
  source: CmdbImportSourceData | null;
  status: 'PENDING' | 'PARSING' | 'RECONCILING' | 'COMPLETED' | 'FAILED' | 'APPLIED';
  dryRun: boolean;
  totalRows: number;
  parsedCount: number;
  matchedCount: number;
  createdCount: number;
  updatedCount: number;
  conflictCount: number;
  errorCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateCmdbImportJobDto {
  sourceId?: string;
  dryRun?: boolean;
  rows: Record<string, unknown>[];
}

export interface CmdbImportRowData {
  id: string;
  jobId: string;
  rowNo: number;
  raw: Record<string, unknown> | null;
  parsed: Record<string, unknown> | null;
  fingerprint: string | null;
  status: 'PARSED' | 'MATCHED' | 'CREATED' | 'UPDATED' | 'CONFLICT' | 'ERROR';
  errorMessage: string | null;
  createdAt: string;
}

export interface ReconcileDiffField {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  classification: 'safe_update' | 'conflict';
}

export interface ReconcileExplainData {
  ruleId: string;
  ruleName: string;
  fieldsUsed: string[];
  confidence: number;
  matchedCiId?: string;
  matchedCiName?: string;
}

export interface CmdbReconcileResultData {
  id: string;
  jobId: string;
  rowId: string | null;
  ciId: string | null;
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'CONFLICT';
  matchedBy: string | null;
  diff: ReconcileDiffField[] | null;
  explain: ReconcileExplainData | null;
  createdAt: string;
}

export interface CmdbReconcileRuleData {
  id: string;
  tenantId: string;
  name: string;
  targetClassId: string | null;
  matchStrategy: {
    type: 'exact' | 'composite';
    fields: Array<{
      field: string;
      ciField: string;
      weight?: number;
      uniqueRequired?: boolean;
    }>;
  };
  precedence: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCmdbReconcileRuleDto {
  name: string;
  targetClassId?: string;
  matchStrategy: Record<string, unknown>;
  precedence?: number;
  enabled?: boolean;
}

export interface UpdateCmdbReconcileRuleDto {
  name?: string;
  targetClassId?: string;
  matchStrategy?: Record<string, unknown>;
  precedence?: number;
  enabled?: boolean;
}

export interface CmdbImportJobReport {
  job: CmdbImportJobData;
  summary: {
    totalRows: number;
    wouldCreate: number;
    wouldUpdate: number;
    conflicts: number;
    errors: number;
    skipped: number;
  };
  topConflicts: CmdbReconcileResultData[];
  explainSamples: CmdbReconcileResultData[];
}

export interface CmdbImportListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
}

export interface CmdbListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  classId?: string;
  lifecycle?: string;
  environment?: string;
  isActive?: boolean;
}

// CMDB Topology Types
export interface TopologyNode {
  id: string;
  type: 'ci' | 'service' | 'service_offering';
  label: string;
  className?: string;
  status?: string;
  criticality?: string;
  owner?: string;
  environment?: string;
  ipAddress?: string;
  tier?: string;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  relationType: string;
  direction?: 'upstream' | 'downstream' | 'bidirectional';
  strength?: number;
  inferred: boolean;
}

export interface TopologyMeta {
  rootNodeId: string;
  depth: number;
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  warnings: string[];
}

export interface TopologyAnnotations {
  highlightedNodeIds?: string[];
  highlightedEdgeIds?: string[];
  badgesByNodeId?: Record<string, { type: string; label: string; color?: string }>;
}

export interface TopologyResponse {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  meta: TopologyMeta;
  annotations: TopologyAnnotations;
}

export interface TopologyQueryParams {
  depth?: number;
  relationTypes?: string;
  includeOrphans?: boolean;
  direction?: 'both' | 'upstream' | 'downstream';
}

// CMDB API object
// CMDB Import & Reconciliation API
export const cmdbImportApi = {
  sources: {
    list: (params?: CmdbImportListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      const qs = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.IMPORT_SOURCES.LIST}${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.CMDB.IMPORT_SOURCES.GET(id)),
    create: (data: CreateCmdbImportSourceDto) => api.post(API_PATHS.CMDB.IMPORT_SOURCES.CREATE, data),
    update: (id: string, data: Partial<CreateCmdbImportSourceDto>) => api.patch(API_PATHS.CMDB.IMPORT_SOURCES.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.CMDB.IMPORT_SOURCES.DELETE(id)),
  },
  jobs: {
    list: (params?: CmdbImportListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      if (params?.status) searchParams.set('status', params.status);
      const qs = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.IMPORT_JOBS.LIST}${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.CMDB.IMPORT_JOBS.GET(id)),
    create: (data: CreateCmdbImportJobDto) => api.post(API_PATHS.CMDB.IMPORT_JOBS.CREATE, data),
    rows: (id: string, params?: { page?: number; pageSize?: number; status?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.status) searchParams.set('status', params.status);
      const qs = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.IMPORT_JOBS.ROWS(id)}${qs ? `?${qs}` : ''}`);
    },
    results: (id: string, params?: { page?: number; pageSize?: number; action?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.action) searchParams.set('action', params.action);
      const qs = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.IMPORT_JOBS.RESULTS(id)}${qs ? `?${qs}` : ''}`);
    },
    apply: (id: string) => api.post(API_PATHS.CMDB.IMPORT_JOBS.APPLY(id), {}),
    report: (id: string) => api.get(API_PATHS.CMDB.IMPORT_JOBS.REPORT(id)),
  },
  rules: {
    list: (params?: CmdbImportListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      const qs = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.RECONCILE_RULES.LIST}${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.CMDB.RECONCILE_RULES.GET(id)),
    create: (data: CreateCmdbReconcileRuleDto) => api.post(API_PATHS.CMDB.RECONCILE_RULES.CREATE, data),
    update: (id: string, data: UpdateCmdbReconcileRuleDto) => api.patch(API_PATHS.CMDB.RECONCILE_RULES.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.CMDB.RECONCILE_RULES.DELETE(id)),
  },
};

export const cmdbApi = {
  classes: {
    list: (params?: CmdbListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.CLASSES.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.CMDB.CLASSES.GET(id)),
    create: (data: CreateCmdbCiClassDto) => api.post(API_PATHS.CMDB.CLASSES.CREATE, data),
    update: (id: string, data: UpdateCmdbCiClassDto) => api.patch(API_PATHS.CMDB.CLASSES.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.CMDB.CLASSES.DELETE(id)),
  },
  cis: {
    list: (params?: CmdbListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      if (params?.classId) searchParams.set('classId', params.classId);
      if (params?.lifecycle) searchParams.set('lifecycle', params.lifecycle);
      if (params?.environment) searchParams.set('environment', params.environment);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.CIS.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.CMDB.CIS.GET(id)),
    create: (data: CreateCmdbCiDto) => api.post(API_PATHS.CMDB.CIS.CREATE, data),
    update: (id: string, data: UpdateCmdbCiDto) => api.patch(API_PATHS.CMDB.CIS.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.CMDB.CIS.DELETE(id)),
  },
  relationships: {
    list: (params?: CmdbListParams & { ciId?: string; sourceCiId?: string; targetCiId?: string; type?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      if (params?.ciId) searchParams.set('ciId', params.ciId);
      if (params?.sourceCiId) searchParams.set('sourceCiId', params.sourceCiId);
      if (params?.targetCiId) searchParams.set('targetCiId', params.targetCiId);
      if (params?.type) searchParams.set('type', params.type);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.RELATIONSHIPS.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.CMDB.RELATIONSHIPS.GET(id)),
    create: (data: CreateCmdbCiRelDto) => api.post(API_PATHS.CMDB.RELATIONSHIPS.CREATE, data),
    delete: (id: string) => api.delete(API_PATHS.CMDB.RELATIONSHIPS.DELETE(id)),
  },
  services: {
    list: (params?: CmdbListParams & { type?: string; status?: string; tier?: string; criticality?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      if (params?.type) searchParams.set('type', params.type);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.tier) searchParams.set('tier', params.tier);
      if (params?.criticality) searchParams.set('criticality', params.criticality);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.SERVICES.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.CMDB.SERVICES.GET(id)),
    create: (data: CreateCmdbServiceDto) => api.post(API_PATHS.CMDB.SERVICES.CREATE, data),
    update: (id: string, data: UpdateCmdbServiceDto) => api.patch(API_PATHS.CMDB.SERVICES.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.CMDB.SERVICES.DELETE(id)),
  },
  serviceCi: {
    cisForService: (serviceId: string, params?: { page?: number; pageSize?: number; relationshipType?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.relationshipType) searchParams.set('relationshipType', params.relationshipType);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.SERVICE_CI.CIS_FOR_SERVICE(serviceId)}${queryString ? `?${queryString}` : ''}`);
    },
    servicesForCi: (ciId: string, params?: { page?: number; pageSize?: number; relationshipType?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.relationshipType) searchParams.set('relationshipType', params.relationshipType);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.SERVICE_CI.SERVICES_FOR_CI(ciId)}${queryString ? `?${queryString}` : ''}`);
    },
    link: (serviceId: string, ciId: string, data: CreateCmdbServiceCiDto) =>
      api.post(API_PATHS.CMDB.SERVICE_CI.LINK(serviceId, ciId), data),
    unlink: (serviceId: string, ciId: string, relationshipType?: string) => {
      const queryString = relationshipType ? `?relationshipType=${encodeURIComponent(relationshipType)}` : '';
      return api.delete(`${API_PATHS.CMDB.SERVICE_CI.UNLINK(serviceId, ciId)}${queryString}`);
    },
  },
  serviceOfferings: {
    list: (params?: CmdbListParams & { serviceId?: string; status?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.q) searchParams.set('q', params.q);
      if (params?.serviceId) searchParams.set('serviceId', params.serviceId);
      if (params?.status) searchParams.set('status', params.status);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.SERVICE_OFFERINGS.LIST}${queryString ? `?${queryString}` : ''}`);
    },
    get: (id: string) => api.get(API_PATHS.CMDB.SERVICE_OFFERINGS.GET(id)),
    create: (data: CreateCmdbServiceOfferingDto) => api.post(API_PATHS.CMDB.SERVICE_OFFERINGS.CREATE, data),
    update: (id: string, data: UpdateCmdbServiceOfferingDto) => api.patch(API_PATHS.CMDB.SERVICE_OFFERINGS.UPDATE(id), data),
    delete: (id: string) => api.delete(API_PATHS.CMDB.SERVICE_OFFERINGS.DELETE(id)),
  },
  topology: {
    forCi: (ciId: string, params?: TopologyQueryParams) => {
      const searchParams = new URLSearchParams();
      if (params?.depth) searchParams.set('depth', String(params.depth));
      if (params?.relationTypes) searchParams.set('relationTypes', params.relationTypes);
      if (params?.includeOrphans) searchParams.set('includeOrphans', String(params.includeOrphans));
      if (params?.direction) searchParams.set('direction', params.direction);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.TOPOLOGY.CI(ciId)}${queryString ? `?${queryString}` : ''}`);
    },
    forService: (serviceId: string, params?: TopologyQueryParams) => {
      const searchParams = new URLSearchParams();
      if (params?.depth) searchParams.set('depth', String(params.depth));
      if (params?.relationTypes) searchParams.set('relationTypes', params.relationTypes);
      if (params?.includeOrphans) searchParams.set('includeOrphans', String(params.includeOrphans));
      if (params?.direction) searchParams.set('direction', params.direction);
      const queryString = searchParams.toString();
      return api.get(`${API_PATHS.CMDB.TOPOLOGY.SERVICE(serviceId)}${queryString ? `?${queryString}` : ''}`);
    },
  },
};

// Legacy incidentApi for backward compatibility(deprecated, use itsmApi.incidents instead)
export const incidentApi = {
  list: (tenantId: string, params?: URLSearchParams) => 
    api.get(`${API_PATHS.ITSM.INCIDENTS.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
  
  get: (tenantId: string, id: string) => 
    api.get(API_PATHS.ITSM.INCIDENTS.GET(id), withTenantId(tenantId)),
  
  create: (tenantId: string, data: Record<string, unknown>) => 
    api.post(API_PATHS.ITSM.INCIDENTS.CREATE, data, withTenantId(tenantId)),
  
  update: (tenantId: string, id: string, data: Record<string, unknown>) => 
    api.patch(API_PATHS.ITSM.INCIDENTS.UPDATE(id), data, withTenantId(tenantId)),
  
  delete: (tenantId: string, id: string) => 
    api.delete(API_PATHS.ITSM.INCIDENTS.DELETE(id), withTenantId(tenantId)),
  
  resolve: (tenantId: string, id: string, resolutionNotes?: string) => 
    api.post(API_PATHS.ITSM.INCIDENTS.RESOLVE(id), { resolutionNotes }, withTenantId(tenantId)),
  
  close: (tenantId: string, id: string) => 
    api.post(API_PATHS.ITSM.INCIDENTS.CLOSE(id), {}, withTenantId(tenantId)),
};

// ============================================================================
// Dashboard API (Uses dedicated NestJS Dashboard endpoints)
// ============================================================================

/**
 * Risk trend data point for time-series chart
 */
export interface RiskTrendDataPoint {
  date: string;
  total_risks: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Compliance by regulation data point
 */
export interface ComplianceByRegulationItem {
  regulation: string;
  completed: number;
  pending: number;
  overdue: number;
}

export const dashboardApi = {
  /**
   * Get dashboard overview from the dedicated NestJS Dashboard endpoint
   * This endpoint aggregates data from GRC and ITSM services on the backend
   */
  getOverview: async (tenantId: string): Promise<DashboardOverview> => {
    try {
      const response = await api.get(API_PATHS.DASHBOARD.OVERVIEW, withTenantId(tenantId));
      return unwrapResponse<DashboardOverview>(response);
    } catch (error) {
      console.error('Failed to fetch dashboard overview:', error);
      // Return empty data on error for graceful degradation
      return {
        risks: { total: 0, open: 0, high: 0, overdue: 0, top5OpenRisks: [] },
        compliance: { total: 0, pending: 0, completed: 0, overdue: 0 },
        policies: { total: 0, active: 0, draft: 0 },
        incidents: { total: 0, open: 0, closed: 0, resolved: 0 },
        users: { total: 0, admins: 0, managers: 0 },
      };
    }
  },

  /**
   * Get risk trends data from the dedicated NestJS Dashboard endpoint
   * Returns risk counts grouped by severity for visualization
   */
  getRiskTrends: async (tenantId: string): Promise<RiskTrendDataPoint[]> => {
    try {
      const response = await api.get(API_PATHS.DASHBOARD.RISK_TRENDS, withTenantId(tenantId));
      return unwrapResponse<RiskTrendDataPoint[]>(response) || [];
    } catch (error) {
      console.error('Failed to fetch risk trends:', error);
      return [];
    }
  },

  /**
   * Get compliance breakdown by regulation from the dedicated NestJS Dashboard endpoint
   * Returns compliance status grouped by framework for visualization
   */
  getComplianceByRegulation: async (tenantId: string): Promise<ComplianceByRegulationItem[]> => {
    try {
      const response = await api.get(API_PATHS.DASHBOARD.COMPLIANCE_BY_REGULATION, withTenantId(tenantId));
      return unwrapResponse<ComplianceByRegulationItem[]>(response) || [];
    } catch (error) {
      console.error('Failed to fetch compliance by regulation:', error);
      return [];
    }
  },
};

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  login: (username: string, password: string) => 
    api.post(API_PATHS.AUTH.LOGIN, { username, password }),
  
  me: () => 
    api.get(API_PATHS.AUTH.ME),
  
  refresh: (refreshToken: string) => 
    api.post(API_PATHS.AUTH.REFRESH, { refreshToken }),
  
  register: (userData: Record<string, unknown>) => 
    api.post(API_PATHS.AUTH.REGISTER, userData),
};

// ============================================================================
// User API (Legacy - uses Express backend)
// ============================================================================

export const userApi = {
  list: () => api.get(API_PATHS.USERS.LIST),
  get: (id: number) => api.get(API_PATHS.USERS.GET(id)),
  create: (data: Record<string, unknown>) => api.post(API_PATHS.USERS.CREATE, data),
  update: (id: number, data: Record<string, unknown>) => api.put(API_PATHS.USERS.UPDATE(id), data),
  delete: (id: number) => api.delete(API_PATHS.USERS.DELETE(id)),
  me: () => api.get(API_PATHS.USERS.ME),
  count: () => api.get(API_PATHS.USERS.COUNT),
};

// ============================================================================
// Standards Library API (Phase 7)
// ============================================================================

export const standardsApi = {
  list: (params?: URLSearchParams) => 
    api.get(`${API_PATHS.STANDARDS.LIST}${params ? `?${params}` : ''}`),
  
  getFilters: () => 
    api.get(API_PATHS.STANDARDS.FILTERS),
  
  get: (id: string) => 
    api.get(API_PATHS.STANDARDS.GET(id)),
  
  mapPolicy: (requirementId: string, policyId: string, justification?: string) => 
    api.post(API_PATHS.STANDARDS.MAP_POLICY, { requirementId, targetId: policyId, justification }),
  
  mapRisk: (requirementId: string, riskId: string) => 
    api.post(API_PATHS.STANDARDS.MAP_RISK, { requirementId, targetId: riskId }),
  
  mapFinding: (requirementId: string, findingId: string, evidenceStrength?: string) => 
    api.post(API_PATHS.STANDARDS.MAP_FINDING, { requirementId, targetId: findingId, evidenceStrength }),
  
  mapAudit: (requirementId: string, auditId: string) => 
    api.post(API_PATHS.STANDARDS.MAP_AUDIT, { requirementId, targetId: auditId }),
  
  getPolicies: (id: string) => 
    api.get(API_PATHS.STANDARDS.POLICIES(id)),
  
  getRisks: (id: string) => 
    api.get(API_PATHS.STANDARDS.RISKS(id)),
  
  getFindings: (id: string) => 
    api.get(API_PATHS.STANDARDS.FINDINGS(id)),
  
  getAudits: (id: string) => 
    api.get(API_PATHS.STANDARDS.AUDITS(id)),
};

// ============================================================================
// Platform Metadata Engine API (Phase 7)
// ============================================================================

export const platformMetadataApi = {
  getTypes: () => 
    api.get(API_PATHS.PLATFORM_METADATA.TYPES),
  
  getType: (id: string) => 
    api.get(API_PATHS.PLATFORM_METADATA.TYPE(id)),
  
  createType: (data: { name: string; description?: string }) => 
    api.post(API_PATHS.PLATFORM_METADATA.TYPES, data),
  
  updateType: (id: string, data: { name?: string; description?: string }) => 
    api.put(API_PATHS.PLATFORM_METADATA.TYPE(id), data),
  
  deleteType: (id: string) => 
    api.delete(API_PATHS.PLATFORM_METADATA.TYPE(id)),
  
  getValues: () => 
    api.get(API_PATHS.PLATFORM_METADATA.VALUES),
  
  getTypeValues: (typeId: string) => 
    api.get(API_PATHS.PLATFORM_METADATA.TYPE_VALUES(typeId)),
  
  createValue: (typeId: string, data: { value: string; color?: string; description?: string }) => 
    api.post(API_PATHS.PLATFORM_METADATA.TYPE_VALUES(typeId), data),
  
  updateValue: (id: string, data: { value?: string; color?: string; description?: string }) => 
    api.put(API_PATHS.PLATFORM_METADATA.VALUE(id), data),
  
  deleteValue: (id: string) => 
    api.delete(API_PATHS.PLATFORM_METADATA.VALUE(id)),
  
  assignMetadata: (objectType: string, objectId: string, metadataValueId: string) => 
    api.post(API_PATHS.PLATFORM_METADATA.ASSIGN, { objectType, objectId, metadataValueId }),
  
  getAssignedMetadata: (objectType: string, objectId: string) => 
    api.get(API_PATHS.PLATFORM_METADATA.ASSIGNED(objectType, objectId)),
  
  removeAssignment: (id: string) => 
    api.delete(API_PATHS.PLATFORM_METADATA.REMOVE_ASSIGNED(id)),
  
  getStats: () => 
    api.get(API_PATHS.PLATFORM_METADATA.STATS),
};

// ============================================================================
// GRC Metrics API (Phase 7)
// ============================================================================

export const grcMetricsApi = {
  getRequirementsCoverage: () => 
    api.get(API_PATHS.GRC_METRICS.REQUIREMENTS_COVERAGE),
  
  getFindingsByStandard: () => 
    api.get(API_PATHS.GRC_METRICS.FINDINGS_BY_STANDARD),
  
  getRequirementsTags: () => 
    api.get(API_PATHS.GRC_METRICS.REQUIREMENTS_TAGS),
  
  getComplianceSummary: () => 
    api.get(API_PATHS.GRC_METRICS.COMPLIANCE_SUMMARY),
};

// ============================================================================
// GRC Dashboard API (Phase 8)
// ============================================================================

export interface AuditOverviewData {
  auditPipeline: {
    draft: number;
    planned: number;
    fieldwork: number;
    reporting: number;
    final: number;
    closed: number;
  };
  findingsByDepartment: Array<{
    department: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  capaPerformance: {
    total: number;
    open: number;
    overdue: number;
    avgClosureDays: number;
    validatedRate: number;
  };
  topRiskAreas: Array<{
    riskId: string;
    riskTitle: string;
    relatedFindings: number;
    maxSeverity: string;
  }>;
  auditCalendar: Array<{
    month: string;
    planned: number;
    fieldwork: number;
    reporting: number;
    closed: number;
  }>;
}

export interface ComplianceOverviewData {
  standardsCoverage: Array<{
    family: string;
    totalRequirements: number;
    audited: number;
    withFindings: number;
    complianceScore: number;
  }>;
  clauseHeatmap: Array<{
    family: string;
    code: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  requirementStatus: {
    compliant: number;
    partiallyCompliant: number;
    nonCompliant: number;
    notAssessed: number;
  };
  domainBreakdown: Array<{
    domain: string;
    requirements: number;
    findings: number;
    capas: number;
  }>;
}

export interface GrcHealthData {
  departmentScores: Array<{
    department: string;
    score: number;
    auditScore: number;
    riskScore: number;
    policyScore: number;
    capaScore: number;
  }>;
  repeatedFindings: Array<{
    theme: string;
    count: number;
  }>;
  policyCompliance: Array<{
    policyId: string;
    policyTitle: string;
    acknowledgedRate: number;
  }>;
  riskClusters: Array<{
    cluster: string;
    openFindings: number;
    highRisks: number;
  }>;
}

export interface DashboardFilters {
  departments: string[];
  families: string[];
  versions: string[];
}

export const grcDashboardApi = {
  getAuditOverview: async (params?: { from?: string; to?: string; department?: string }): Promise<AuditOverviewData> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.from) queryParams.append('from', params.from);
      if (params?.to) queryParams.append('to', params.to);
      if (params?.department) queryParams.append('department', params.department);
      
      const url = `${API_PATHS.GRC_DASHBOARD.AUDIT_OVERVIEW}${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await api.get(url);
      return unwrapResponse<AuditOverviewData>(response);
    } catch (error) {
      console.error('Failed to fetch audit overview:', error);
      return {
        auditPipeline: { draft: 0, planned: 0, fieldwork: 0, reporting: 0, final: 0, closed: 0 },
        findingsByDepartment: [],
        capaPerformance: { total: 0, open: 0, overdue: 0, avgClosureDays: 0, validatedRate: 0 },
        topRiskAreas: [],
        auditCalendar: [],
      };
    }
  },

  getComplianceOverview: async (params?: { family?: string; version?: string }): Promise<ComplianceOverviewData> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.family) queryParams.append('family', params.family);
      if (params?.version) queryParams.append('version', params.version);
      
      const url = `${API_PATHS.GRC_DASHBOARD.COMPLIANCE_OVERVIEW}${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await api.get(url);
      return unwrapResponse<ComplianceOverviewData>(response);
    } catch (error) {
      console.error('Failed to fetch compliance overview:', error);
      return {
        standardsCoverage: [],
        clauseHeatmap: [],
        requirementStatus: { compliant: 0, partiallyCompliant: 0, nonCompliant: 0, notAssessed: 0 },
        domainBreakdown: [],
      };
    }
  },

  getGrcHealth: async (params?: { from?: string; to?: string }): Promise<GrcHealthData> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.from) queryParams.append('from', params.from);
      if (params?.to) queryParams.append('to', params.to);
      
      const url = `${API_PATHS.GRC_DASHBOARD.GRC_HEALTH}${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await api.get(url);
      return unwrapResponse<GrcHealthData>(response);
    } catch (error) {
      console.error('Failed to fetch GRC health:', error);
      return {
        departmentScores: [],
        repeatedFindings: [],
        policyCompliance: [],
        riskClusters: [],
      };
    }
  },

  getFilters: async (): Promise<DashboardFilters> => {
    try {
      const response = await api.get(API_PATHS.GRC_DASHBOARD.FILTERS);
      return unwrapResponse<DashboardFilters>(response);
    } catch (error) {
      console.error('Failed to fetch dashboard filters:', error);
      return {
        departments: [],
        families: [],
        versions: [],
      };
    }
  },
};

// ============================================================================
// Process API (Sprint 5)
// ============================================================================

export const processApi = {
  list: (tenantId: string, params?: URLSearchParams) =>
    api.get(
      `${API_PATHS.GRC_PROCESSES.LIST}${params ? `?${params}` : ''}`,
      withTenantId(tenantId),
    ),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_PROCESSES.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(API_PATHS.GRC_PROCESSES.CREATE, data, withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(API_PATHS.GRC_PROCESSES.UPDATE(id), data, withTenantId(tenantId)),

  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.GRC_PROCESSES.DELETE(id), withTenantId(tenantId)),

  getComplianceScore: (
    tenantId: string,
    id: string,
    params?: { from?: string; to?: string },
  ) => {
    const queryParams = new URLSearchParams();
    if (params?.from) queryParams.append('from', params.from);
    if (params?.to) queryParams.append('to', params.to);
    const url = `${API_PATHS.GRC_PROCESSES.COMPLIANCE_SCORE(id)}${queryParams.toString() ? `?${queryParams}` : ''}`;
    return api.get(url, withTenantId(tenantId));
  },

  getComplianceOverview: (
    tenantId: string,
    params?: { from?: string; to?: string },
  ) => {
    const queryParams = new URLSearchParams();
    if (params?.from) queryParams.append('from', params.from);
    if (params?.to) queryParams.append('to', params.to);
    const url = `${API_PATHS.GRC_PROCESSES.COMPLIANCE_OVERVIEW}${queryParams.toString() ? `?${queryParams}` : ''}`;
    return api.get(url, withTenantId(tenantId));
  },
};

// ============================================================================
// ProcessControl API (Sprint 5)
// ============================================================================

export const processControlApi = {
  list: (tenantId: string, params?: URLSearchParams) =>
    api.get(
      `${API_PATHS.GRC_PROCESS_CONTROLS.LIST}${params ? `?${params}` : ''}`,
      withTenantId(tenantId),
    ),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_PROCESS_CONTROLS.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(
      API_PATHS.GRC_PROCESS_CONTROLS.CREATE,
      data,
      withTenantId(tenantId),
    ),

  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(
      API_PATHS.GRC_PROCESS_CONTROLS.UPDATE(id),
      data,
      withTenantId(tenantId),
    ),

  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.GRC_PROCESS_CONTROLS.DELETE(id), withTenantId(tenantId)),

  linkRisks: (tenantId: string, id: string, riskIds: string[]) =>
    api.put(
      API_PATHS.GRC_PROCESS_CONTROLS.LINK_RISKS(id),
      { riskIds },
      withTenantId(tenantId),
    ),
};

// ============================================================================
// ControlResult API (Sprint 5)
// ============================================================================

export const controlResultApi = {
  list: (tenantId: string, params?: URLSearchParams) =>
    api.get(
      `${API_PATHS.GRC_CONTROL_RESULTS.LIST}${params ? `?${params}` : ''}`,
      withTenantId(tenantId),
    ),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_CONTROL_RESULTS.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(API_PATHS.GRC_CONTROL_RESULTS.CREATE, data, withTenantId(tenantId)),
};

// ============================================================================
// ProcessViolation API (Sprint 5)
// ============================================================================

export const processViolationApi = {
  list: (tenantId: string, params?: URLSearchParams) =>
    api.get(
      `${API_PATHS.GRC_PROCESS_VIOLATIONS.LIST}${params ? `?${params}` : ''}`,
      withTenantId(tenantId),
    ),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_PROCESS_VIOLATIONS.GET(id), withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(
      API_PATHS.GRC_PROCESS_VIOLATIONS.UPDATE(id),
      data,
      withTenantId(tenantId),
    ),

  linkRisk: (tenantId: string, id: string, riskId: string) =>
    api.patch(
      API_PATHS.GRC_PROCESS_VIOLATIONS.LINK_RISK(id),
      { riskId },
      withTenantId(tenantId),
    ),

  unlinkRisk: (tenantId: string, id: string) =>
    api.patch(
      API_PATHS.GRC_PROCESS_VIOLATIONS.UNLINK_RISK(id),
      {},
      withTenantId(tenantId),
    ),
};

// ============================================================================
// GRC Control API (Unified Control Library)
// ============================================================================

export const controlApi = {
  list: (tenantId: string, params?: Record<string, unknown>) =>
    api.get(API_PATHS.GRC_CONTROLS.LIST, {
      ...withTenantId(tenantId),
      params,
    }),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_CONTROLS.GET(id), withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(API_PATHS.GRC_CONTROLS.UPDATE(id), data, withTenantId(tenantId)),

  getProcesses: (tenantId: string, controlId: string) =>
    api.get(API_PATHS.GRC_CONTROLS.PROCESSES(controlId), withTenantId(tenantId)),

  linkProcess: (tenantId: string, controlId: string, processId: string) =>
    api.post(
      API_PATHS.GRC_CONTROLS.LINK_PROCESS(controlId, processId),
      {},
      withTenantId(tenantId),
    ),

  unlinkProcess: (tenantId: string, controlId: string, processId: string) =>
    api.delete(
      API_PATHS.GRC_CONTROLS.UNLINK_PROCESS(controlId, processId),
      withTenantId(tenantId),
    ),

  getEvidences: (tenantId: string, controlId: string) =>
    api.get(API_PATHS.GRC_CONTROLS.EVIDENCES(controlId), withTenantId(tenantId)),
};

// ============================================================================
// GRC Evidence API (Golden Flow Sprint 1B)
// ============================================================================

export interface EvidenceData {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: string;
  sourceType: string;
  status: string;
  location?: string;
  externalUrl?: string;
  collectedAt?: string;
  collectedByUserId?: string;
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface CreateEvidenceDto {
  name: string;
  description?: string;
  type: string;
  sourceType?: string;
  status?: string;
  location?: string;
  externalUrl?: string;
  collectedAt?: string;
  dueDate?: string;
  tags?: string[];
}

export interface UpdateEvidenceDto {
  name?: string;
  description?: string;
  type?: string;
  sourceType?: string;
  status?: string;
  location?: string;
  externalUrl?: string;
  collectedAt?: string;
  dueDate?: string;
  tags?: string[];
}

export const evidenceApi = {
  list: (tenantId: string, params?: Record<string, unknown>) =>
    api.get(API_PATHS.GRC_EVIDENCE.LIST, {
      ...withTenantId(tenantId),
      params,
    }),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_EVIDENCE.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: CreateEvidenceDto) =>
    api.post(API_PATHS.GRC_EVIDENCE.CREATE, data, withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: UpdateEvidenceDto) =>
    api.patch(API_PATHS.GRC_EVIDENCE.UPDATE(id), data, withTenantId(tenantId)),

  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.GRC_EVIDENCE.DELETE(id), withTenantId(tenantId)),

  getControls: (tenantId: string, evidenceId: string) =>
    api.get(API_PATHS.GRC_EVIDENCE.CONTROLS(evidenceId), withTenantId(tenantId)),

  linkControl: (tenantId: string, evidenceId: string, controlId: string) =>
    api.post(
      API_PATHS.GRC_EVIDENCE.LINK_CONTROL(evidenceId, controlId),
      {},
      withTenantId(tenantId),
    ),

  unlinkControl: (tenantId: string, evidenceId: string, controlId: string) =>
    api.delete(
      API_PATHS.GRC_EVIDENCE.UNLINK_CONTROL(evidenceId, controlId),
      withTenantId(tenantId),
    ),

  getTestResults: (tenantId: string, evidenceId: string) =>
    api.get(API_PATHS.GRC_EVIDENCE.TEST_RESULTS(evidenceId), withTenantId(tenantId)),

  linkTestResult: (tenantId: string, evidenceId: string, testResultId: string) =>
    api.post(
      API_PATHS.GRC_EVIDENCE.LINK_TEST_RESULT(evidenceId, testResultId),
      {},
      withTenantId(tenantId),
    ),

  unlinkTestResult: (tenantId: string, evidenceId: string, testResultId: string) =>
    api.delete(
      API_PATHS.GRC_EVIDENCE.UNLINK_TEST_RESULT(evidenceId, testResultId),
      withTenantId(tenantId),
    ),

  getIssues: (tenantId: string, evidenceId: string) =>
    api.get(API_PATHS.GRC_EVIDENCE.ISSUES(evidenceId), withTenantId(tenantId)),

  linkIssue: (tenantId: string, evidenceId: string, issueId: string) =>
    api.post(
      API_PATHS.GRC_EVIDENCE.LINK_ISSUE(evidenceId, issueId),
      {},
      withTenantId(tenantId),
    ),

  unlinkIssue: (tenantId: string, evidenceId: string, issueId: string) =>
    api.delete(
      API_PATHS.GRC_EVIDENCE.UNLINK_ISSUE(evidenceId, issueId),
      withTenantId(tenantId),
    ),
};

// ============================================================================
// GRC Test Results API (Golden Flow Sprint 1B)
// ============================================================================

// Test/Result Sprint - Test method enum values
export type TestMethod = 'INTERVIEW' | 'OBSERVATION' | 'INSPECTION' | 'REPERFORMANCE' | 'OTHER';

// Test/Result Sprint - Test result status enum values
export type TestResultStatus = 'DRAFT' | 'FINAL';

// Test/Result Sprint - Test result outcome enum values
export type TestResultOutcome = 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_TESTED';

export interface TestResultData {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  controlTestId?: string;
  controlId?: string;
  result: TestResultOutcome;
  effectivenessRating?: string;
  testedAt?: string;
  testedByUserId?: string;
  notes?: string;
  // Test/Result Sprint - New fields
  testDate?: string;
  method?: TestMethod;
  status?: TestResultStatus;
  summary?: string;
  ownerUserId?: string;
  evidenceCount?: number;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  controlTest?: {
    id: string;
    name: string;
    controlId: string;
    control?: {
      id: string;
      name: string;
      code?: string;
    };
  };
  control?: {
    id: string;
    name: string;
    code?: string;
  };
}

export interface CreateTestResultDto {
  name?: string;
  description?: string;
  controlTestId?: string;
  controlId?: string;
  result: TestResultOutcome;
  effectivenessRating?: string;
  testedAt?: string;
  notes?: string;
  // Test/Result Sprint - New fields
  testDate?: string;
  method?: TestMethod;
  status?: TestResultStatus;
  summary?: string;
  ownerUserId?: string;
}

export interface UpdateTestResultDto {
  name?: string;
  description?: string;
  result?: TestResultOutcome;
  effectivenessRating?: string;
  testedAt?: string;
  notes?: string;
  // Test/Result Sprint - New fields
  testDate?: string;
  method?: TestMethod;
  status?: TestResultStatus;
  summary?: string;
  ownerUserId?: string;
}

// Test/Result Sprint - List query params with List Contract v1 support
export interface TestResultListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  controlId?: string;
  result?: TestResultOutcome;
  method?: TestMethod;
  status?: TestResultStatus;
  testDateAfter?: string;
  testDateBefore?: string;
}

// Test/Result Sprint - Evidence linked to test result
export interface TestResultEvidenceLink {
  id: string;
  tenantId: string;
  testResultId: string;
  evidenceId: string;
  evidence?: EvidenceData;
  createdAt: string;
}

export const testResultApi = {
  list: (tenantId: string, params?: TestResultListParams) =>
    api.get(API_PATHS.GRC_TEST_RESULTS.LIST, {
      ...withTenantId(tenantId),
      params,
    }),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_TEST_RESULTS.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: CreateTestResultDto) =>
    api.post(API_PATHS.GRC_TEST_RESULTS.CREATE, data, withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: UpdateTestResultDto) =>
    api.patch(API_PATHS.GRC_TEST_RESULTS.UPDATE(id), data, withTenantId(tenantId)),

  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.GRC_TEST_RESULTS.DELETE(id), withTenantId(tenantId)),

  // Test/Result Sprint - Control-centric endpoint
  listByControl: (tenantId: string, controlId: string, params?: TestResultListParams) =>
    api.get(API_PATHS.GRC_TEST_RESULTS.BY_CONTROL(controlId), {
      ...withTenantId(tenantId),
      params,
    }),

  // Test/Result Sprint - Evidence linking endpoints
  getEvidences: (tenantId: string, testResultId: string) =>
    api.get(API_PATHS.GRC_TEST_RESULTS.EVIDENCES(testResultId), withTenantId(tenantId)),

  linkEvidence: (tenantId: string, testResultId: string, evidenceId: string) =>
    api.post(
      API_PATHS.GRC_TEST_RESULTS.LINK_EVIDENCE(testResultId, evidenceId),
      {},
      withTenantId(tenantId),
    ),

  unlinkEvidence: (tenantId: string, testResultId: string, evidenceId: string) =>
    api.delete(
      API_PATHS.GRC_TEST_RESULTS.UNLINK_EVIDENCE(testResultId, evidenceId),
      withTenantId(tenantId),
    ),

  // Issue/Finding Sprint - Create Issue from Test Result (Golden Flow)
  createIssue: (
    tenantId: string,
    testResultId: string,
    data: { title?: string; description?: string; severity?: string; ownerUserId?: string; dueDate?: string },
  ) =>
    api.post(
      API_PATHS.GRC_TEST_RESULTS.CREATE_ISSUE(testResultId),
      data,
      withTenantId(tenantId),
    ),
};

// ============================================================================
// GRC Control Tests (Test Definitions) API (Control Tests v1)
// ============================================================================

export type ControlTestType = 'DESIGN' | 'OPERATING_EFFECTIVENESS' | 'BOTH';
export type ControlTestStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ControlTestData {
  id: string;
  tenantId: string;
  controlId: string;
  name: string;
  description?: string;
  testType?: ControlTestType;
  status: ControlTestStatus;
  scheduledDate?: string;
  startedAt?: string;
  completedAt?: string;
  testerUserId?: string;
  reviewerUserId?: string;
  testProcedure?: string;
  sampleSize?: number;
  populationSize?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  control?: {
    id: string;
    name: string;
    code?: string;
  };
  tester?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  reviewer?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface CreateControlTestDto {
  controlId: string;
  name: string;
  description?: string;
  testType?: ControlTestType;
  scheduledDate?: string;
  testerUserId?: string;
  reviewerUserId?: string;
  testProcedure?: string;
  sampleSize?: number;
  populationSize?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateControlTestDto {
  name?: string;
  description?: string;
  testType?: ControlTestType;
  scheduledDate?: string;
  testerUserId?: string;
  reviewerUserId?: string;
  testProcedure?: string;
  sampleSize?: number;
  populationSize?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateControlTestStatusDto {
  status: ControlTestStatus;
  reason?: string;
}

export interface ControlTestListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  controlId?: string;
  status?: ControlTestStatus;
  testType?: ControlTestType;
  testerUserId?: string;
  scheduledDateFrom?: string;
  scheduledDateTo?: string;
}

export const controlTestApi = {
  list: (tenantId: string, params?: ControlTestListParams) =>
    api.get(API_PATHS.GRC_CONTROL_TESTS.LIST, {
      ...withTenantId(tenantId),
      params,
    }),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_CONTROL_TESTS.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: CreateControlTestDto) =>
    api.post(API_PATHS.GRC_CONTROL_TESTS.CREATE, data, withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: UpdateControlTestDto) =>
    api.put(API_PATHS.GRC_CONTROL_TESTS.UPDATE(id), data, withTenantId(tenantId)),

  updateStatus: (tenantId: string, id: string, data: UpdateControlTestStatusDto) =>
    api.patch(API_PATHS.GRC_CONTROL_TESTS.UPDATE_STATUS(id), data, withTenantId(tenantId)),

  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.GRC_CONTROL_TESTS.DELETE(id), withTenantId(tenantId)),

  listByControl: (tenantId: string, controlId: string, params?: ControlTestListParams) =>
    api.get(API_PATHS.GRC_CONTROL_TESTS.BY_CONTROL(controlId), {
      ...withTenantId(tenantId),
      params,
    }),

  listResults: (tenantId: string, testId: string, params?: TestResultListParams) =>
    api.get(API_PATHS.GRC_CONTROL_TESTS.RESULTS(testId), {
      ...withTenantId(tenantId),
      params,
    }),
};

// ============================================================================
// GRC Issues API (Golden Flow Sprint 1B)
// ============================================================================

export interface IssueData {
  id: string;
  tenantId: string;
  code?: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  severity: string;
  controlId?: string;
  testResultId?: string;
  ownerUserId?: string;
  discoveredDate?: string;
  dueDate?: string;
  resolvedDate?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  control?: {
    id: string;
    name: string;
    code?: string;
  };
}

export interface CreateIssueDto {
  title: string;
  description?: string;
  type: string;
  status?: string;
  severity: string;
  controlId?: string;
  testResultId?: string;
  ownerUserId?: string;
  discoveredDate?: string;
  dueDate?: string;
}

export interface UpdateIssueDto {
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  severity?: string;
  controlId?: string;
  testResultId?: string;
  ownerUserId?: string;
  discoveredDate?: string;
  dueDate?: string;
  resolvedDate?: string;
}

export const issueApi = {
  list: (tenantId: string, params?: Record<string, unknown>) =>
    api.get(API_PATHS.GRC_ISSUES.LIST, {
      ...withTenantId(tenantId),
      params,
    }),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_ISSUES.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: CreateIssueDto) =>
    api.post(API_PATHS.GRC_ISSUES.CREATE, data, withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: UpdateIssueDto) =>
    api.patch(API_PATHS.GRC_ISSUES.UPDATE(id), data, withTenantId(tenantId)),

  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.GRC_ISSUES.DELETE(id), withTenantId(tenantId)),

  getControls: (tenantId: string, issueId: string) =>
    api.get(API_PATHS.GRC_ISSUES.CONTROLS(issueId), withTenantId(tenantId)),

  linkControl: (tenantId: string, issueId: string, controlId: string) =>
    api.post(
      API_PATHS.GRC_ISSUES.LINK_CONTROL(issueId, controlId),
      {},
      withTenantId(tenantId),
    ),

  unlinkControl: (tenantId: string, issueId: string, controlId: string) =>
    api.delete(
      API_PATHS.GRC_ISSUES.UNLINK_CONTROL(issueId, controlId),
      withTenantId(tenantId),
    ),

  getTestResults: (tenantId: string, issueId: string) =>
    api.get(API_PATHS.GRC_ISSUES.TEST_RESULTS(issueId), withTenantId(tenantId)),

  linkTestResult: (tenantId: string, issueId: string, testResultId: string) =>
    api.post(
      API_PATHS.GRC_ISSUES.LINK_TEST_RESULT(issueId, testResultId),
      {},
      withTenantId(tenantId),
    ),

  unlinkTestResult: (tenantId: string, issueId: string, testResultId: string) =>
    api.delete(
      API_PATHS.GRC_ISSUES.UNLINK_TEST_RESULT(issueId, testResultId),
      withTenantId(tenantId),
    ),

  getEvidence: (tenantId: string, issueId: string) =>
    api.get(API_PATHS.GRC_ISSUES.EVIDENCE(issueId), withTenantId(tenantId)),

  linkEvidence: (tenantId: string, issueId: string, evidenceId: string) =>
    api.post(
      API_PATHS.GRC_ISSUES.LINK_EVIDENCE(issueId, evidenceId),
      {},
      withTenantId(tenantId),
    ),

  unlinkEvidence: (tenantId: string, issueId: string, evidenceId: string) =>
    api.delete(
      API_PATHS.GRC_ISSUES.UNLINK_EVIDENCE(issueId, evidenceId),
      withTenantId(tenantId),
    ),

  updateStatus: (tenantId: string, issueId: string, data: { status: string; reason?: string }) =>
    api.patch(
      API_PATHS.GRC_ISSUES.UPDATE_STATUS(issueId),
      data,
      withTenantId(tenantId),
    ),
};

// ============================================================================
// GRC CAPA API (Golden Flow Sprint 1C)
// ============================================================================

export type CapaStatus = 'planned' | 'in_progress' | 'implemented' | 'verified' | 'rejected' | 'closed';
export type CapaType = 'corrective' | 'preventive' | 'both';
export type CapaPriority = 'low' | 'medium' | 'high' | 'critical';

export interface CapaData {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  type: CapaType;
  status: CapaStatus;
  priority: CapaPriority;
  issueId: string;
  ownerUserId: string | null;
  dueDate: string | null;
  completedDate: string | null;
  rootCauseAnalysis: string | null;
  actionPlan: string | null;
  implementationNotes: string | null;
  verificationMethod: string | null;
  verificationNotes: string | null;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  closureNotes: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  issue?: IssueData;
  owner?: { id: string; firstName: string; lastName: string; email: string };
  verifiedBy?: { id: string; firstName: string; lastName: string; email: string };
  closedBy?: { id: string; firstName: string; lastName: string; email: string };
}

export interface CreateCapaDto {
  title: string;
  description?: string;
  type?: CapaType;
  status?: CapaStatus;
  priority?: CapaPriority;
  issueId?: string;
  ownerUserId?: string;
  dueDate?: string;
  rootCauseAnalysis?: string;
  actionPlan?: string;
  verificationMethod?: string;
}

export interface UpdateCapaDto {
  title?: string;
  description?: string;
  type?: CapaType;
  priority?: CapaPriority;
  ownerUserId?: string;
  dueDate?: string;
  rootCauseAnalysis?: string;
  actionPlan?: string;
  implementationNotes?: string;
  verificationMethod?: string;
  verificationNotes?: string;
  closureNotes?: string;
}

export interface UpdateCapaStatusDto {
  status: CapaStatus;
  reason?: string;
}

export const capaApi = {
  list: (tenantId: string, params?: Record<string, unknown>) =>
    api.get(API_PATHS.GRC_CAPAS.LIST, {
      ...withTenantId(tenantId),
      params,
    }),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_CAPAS.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: CreateCapaDto) =>
    api.post(API_PATHS.GRC_CAPAS.CREATE, data, withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: UpdateCapaDto) =>
    api.patch(API_PATHS.GRC_CAPAS.UPDATE(id), data, withTenantId(tenantId)),

  updateStatus: (tenantId: string, id: string, data: UpdateCapaStatusDto) =>
    api.patch(API_PATHS.GRC_CAPAS.UPDATE_STATUS(id), data, withTenantId(tenantId)),

  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.GRC_CAPAS.DELETE(id), withTenantId(tenantId)),

  getByIssue: (tenantId: string, issueId: string) =>
    api.get(API_PATHS.GRC_CAPAS.BY_ISSUE(issueId), withTenantId(tenantId)),

  createFromIssue: (tenantId: string, issueId: string, data: CreateCapaDto) =>
    api.post(API_PATHS.GRC_ISSUES.CAPAS(issueId), data, withTenantId(tenantId)),

  getFilters: (tenantId: string) =>
    api.get(API_PATHS.GRC_CAPAS.FILTERS, withTenantId(tenantId)),

  getTasks: (tenantId: string, capaId: string) =>
    api.get(API_PATHS.GRC_CAPAS.TASKS(capaId), withTenantId(tenantId)),

  createTask: (tenantId: string, capaId: string, data: CreateCapaTaskDto) =>
    api.post(API_PATHS.GRC_CAPAS.TASKS(capaId), data, withTenantId(tenantId)),
};

// ============================================================================
// GRC CAPA Task API (Golden Flow Sprint 1C)
// ============================================================================

export type CapaTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface CapaTaskData {
  id: string;
  tenantId: string;
  capaId: string;
  title: string;
  description: string | null;
  status: CapaTaskStatus;
  assigneeUserId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  sequenceOrder: number;
  createdAt: string;
  updatedAt: string;
  capa?: CapaData;
  assignee?: { id: string; firstName: string; lastName: string; email: string };
  completedBy?: { id: string; firstName: string; lastName: string; email: string };
}

export interface CreateCapaTaskDto {
  capaId: string;
  title: string;
  description?: string;
  status?: CapaTaskStatus;
  assigneeUserId?: string;
  dueDate?: string;
  sequenceOrder?: number;
}

export interface UpdateCapaTaskDto {
  title?: string;
  description?: string;
  assigneeUserId?: string;
  dueDate?: string;
  sequenceOrder?: number;
}

export interface UpdateCapaTaskStatusDto {
  status: CapaTaskStatus;
  reason?: string;
}

export interface CompleteCapaTaskDto {
  completionNotes?: string;
}

export interface CapaTaskCompletionStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  cancelled: number;
  completionPercentage: number;
}

export const capaTaskApi = {
  list: (tenantId: string, params?: Record<string, unknown>) =>
    api.get(API_PATHS.GRC_CAPA_TASKS.LIST, {
      ...withTenantId(tenantId),
      params,
    }),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_CAPA_TASKS.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: CreateCapaTaskDto) =>
    api.post(API_PATHS.GRC_CAPA_TASKS.CREATE, data, withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: UpdateCapaTaskDto) =>
    api.put(API_PATHS.GRC_CAPA_TASKS.UPDATE(id), data, withTenantId(tenantId)),

  updateStatus: (tenantId: string, id: string, data: UpdateCapaTaskStatusDto) =>
    api.patch(API_PATHS.GRC_CAPA_TASKS.UPDATE_STATUS(id), data, withTenantId(tenantId)),

  complete: (tenantId: string, id: string, data?: CompleteCapaTaskDto) =>
    api.patch(API_PATHS.GRC_CAPA_TASKS.COMPLETE(id), data || {}, withTenantId(tenantId)),

  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.GRC_CAPA_TASKS.DELETE(id), withTenantId(tenantId)),

  getByCapa: (tenantId: string, capaId: string) =>
    api.get(API_PATHS.GRC_CAPA_TASKS.BY_CAPA(capaId), withTenantId(tenantId)),

  getStats: (tenantId: string, capaId: string) =>
    api.get(API_PATHS.GRC_CAPA_TASKS.STATS(capaId), withTenantId(tenantId)),

  getFilters: (tenantId: string) =>
    api.get(API_PATHS.GRC_CAPA_TASKS.FILTERS, withTenantId(tenantId)),
};

// ============================================================================
// GRC Coverage API (Unified Control Library)
// ============================================================================

export interface CoverageSummary {
  requirementCoverage: number;
  processCoverage: number;
  unlinkedControlsCount: number;
  totalRequirements: number;
  coveredRequirements: number;
  totalProcesses: number;
  coveredProcesses: number;
  totalControls: number;
}

export interface RequirementCoverageItem {
  id: string;
  title: string;
  referenceCode: string;
  status: string;
  controlCount: number;
  isCovered: boolean;
}

export interface RequirementCoverageResponse {
  total: number;
  covered: number;
  uncovered: number;
  coveragePercent: number;
  requirements: RequirementCoverageItem[];
}

export interface ProcessCoverageItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  controlCount: number;
  isCovered: boolean;
}

export interface ProcessCoverageResponse {
  total: number;
  covered: number;
  uncovered: number;
  coveragePercent: number;
  processes: ProcessCoverageItem[];
}

export const coverageApi = {
  getSummary: (tenantId: string) =>
    api.get<CoverageSummary>(API_PATHS.GRC_COVERAGE.SUMMARY, withTenantId(tenantId)),

  getRequirementCoverage: (tenantId: string) =>
    api.get<RequirementCoverageResponse>(API_PATHS.GRC_COVERAGE.REQUIREMENTS, withTenantId(tenantId)),

  getProcessCoverage: (tenantId: string) =>
    api.get<ProcessCoverageResponse>(API_PATHS.GRC_COVERAGE.PROCESSES, withTenantId(tenantId)),
};

// ============================================================================
// GRC Status History Types and API (Control Detail History tab)
// ============================================================================

export interface StatusHistoryItem {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  previousStatus: string | null;
  newStatus: string;
  changedByUserId: string | null;
  changedBy: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  changeReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface StatusHistoryFilterParams {
  entityType?: string;
  entityId?: string;
  changedByUserId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface StatusTimelineResponse {
  timeline: StatusHistoryItem[];
  currentStatus: string | null;
  totalTransitions: number;
  firstTransitionAt: string | null;
  lastTransitionAt: string | null;
}

export const statusHistoryApi = {
  list: (tenantId: string, params?: StatusHistoryFilterParams) =>
    api.get(API_PATHS.GRC_STATUS_HISTORY.LIST, {
      ...withTenantId(tenantId),
      params,
    }),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_STATUS_HISTORY.GET(id), withTenantId(tenantId)),

  getByEntity: (tenantId: string, entityType: string, entityId: string) =>
    api.get(API_PATHS.GRC_STATUS_HISTORY.BY_ENTITY(entityType, entityId), withTenantId(tenantId)),

  getTimeline: (tenantId: string, entityType: string, entityId: string) =>
    api.get<StatusTimelineResponse>(API_PATHS.GRC_STATUS_HISTORY.TIMELINE(entityType, entityId), withTenantId(tenantId)),
};

// ============================================================================
// Onboarding Core Types
// ============================================================================

export enum SuiteType {
  GRC_SUITE = 'GRC_SUITE',
  ITSM_SUITE = 'ITSM_SUITE',
}

export enum ModuleType {
  RISK = 'risk',
  POLICY = 'policy',
  CONTROL = 'control',
  AUDIT = 'audit',
  INCIDENT = 'incident',
  REQUEST = 'request',
  CHANGE = 'change',
  PROBLEM = 'problem',
  CMDB = 'cmdb',
}

export enum FrameworkType {
  ISO27001 = 'ISO27001',
  SOC2 = 'SOC2',
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  NIST = 'NIST',
  PCI_DSS = 'PCI_DSS',
}

export enum MaturityLevel {
  FOUNDATIONAL = 'foundational',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum PolicyCode {
  FRAMEWORK_REQUIRED = 'FRAMEWORK_REQUIRED',
  ADVANCED_RISK_SCORING_DISABLED = 'ADVANCED_RISK_SCORING_DISABLED',
  ISO27001_EVIDENCE_RECOMMENDED = 'ISO27001_EVIDENCE_RECOMMENDED',
  AUDIT_SCOPE_FILTERED = 'AUDIT_SCOPE_FILTERED',
  CLAUSE_LEVEL_ASSESSMENT_WARNING = 'CLAUSE_LEVEL_ASSESSMENT_WARNING',
  ITSM_RELATED_RISK_DISABLED = 'ITSM_RELATED_RISK_DISABLED',
  MAJOR_INCIDENT_AUTOMATION_DISABLED = 'MAJOR_INCIDENT_AUTOMATION_DISABLED',
}

export enum WarningSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface PolicyWarning {
  code: PolicyCode;
  severity: WarningSeverity;
  message: string;
  targets: string[];
}

export interface PolicyResult {
  disabledFeatures: string[];
  warnings: PolicyWarning[];
  metadata: Record<string, unknown>;
}

export interface OnboardingContext {
  status: 'active' | 'pending' | 'suspended';
  schemaVersion: number;
  policySetVersion: string | null;
  activeSuites: SuiteType[];
  enabledModules: Record<SuiteType, ModuleType[]>;
  activeFrameworks: FrameworkType[];
  maturity: MaturityLevel;
  metadata: {
    initializedAt: Date | null;
    lastUpdatedAt: Date | null;
  };
}

export interface OnboardingContextWithPolicy {
  context: OnboardingContext;
  policy: PolicyResult;
}

export const DEFAULT_ONBOARDING_CONTEXT: OnboardingContext = {
  status: 'active',
  schemaVersion: 1,
  policySetVersion: null,
  activeSuites: [],
  enabledModules: {
    [SuiteType.GRC_SUITE]: [],
    [SuiteType.ITSM_SUITE]: [],
  },
  activeFrameworks: [],
  maturity: MaturityLevel.FOUNDATIONAL,
  metadata: {
    initializedAt: null,
    lastUpdatedAt: null,
  },
};

export const DEFAULT_POLICY_RESULT: PolicyResult = {
  disabledFeatures: [],
  warnings: [],
  metadata: {},
};

// ============================================================================
// Onboarding Core API
// ============================================================================

export const onboardingApi = {
  getContext: (tenantId: string) =>
    api.get(API_PATHS.ONBOARDING.CONTEXT, withTenantId(tenantId)),
};

// ============================================================================
// Framework Activation API (Tenant-level compliance frameworks)
// ============================================================================

export interface GrcFrameworkData {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantFrameworksResponse {
  activeKeys: string[];
}

export const grcFrameworksApi = {
  list: () => api.get<{ frameworks: GrcFrameworkData[] }>(API_PATHS.GRC_FRAMEWORKS.LIST),
};

export const tenantFrameworksApi = {
  get: (tenantId: string) =>
    api.get<TenantFrameworksResponse>(API_PATHS.TENANT_FRAMEWORKS.GET, withTenantId(tenantId)),

  update: (tenantId: string, activeKeys: string[]) =>
    api.put<TenantFrameworksResponse>(
      API_PATHS.TENANT_FRAMEWORKS.UPDATE,
      { activeKeys },
      withTenantId(tenantId)
    ),
};

// ============================================================================
// Standards Library API (Audit Phase 2)
// ============================================================================

export interface StandardData {
  id: string;
  code: string;
  name: string;
  shortName?: string | null;
  version: string;
  description?: string | null;
  publisher?: string | null;
  effectiveDate?: string | null;
  domain?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClauseData {
  id: string;
  standardId: string;
  parentClauseId?: string | null;
  code: string;
  title: string;
  description?: string | null;
  descriptionLong?: string | null;
  level: number;
  sortOrder: number;
  path?: string | null;
  isAuditable: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClauseTreeNode {
  id: string;
  code: string;
  title: string;
  description: string | null;
  level: number;
  sortOrder: number;
  path: string | null;
  isAuditable: boolean;
  children: ClauseTreeNode[];
}

export interface StandardWithClauses extends StandardData {
  clauseTree: ClauseTreeNode[];
}

export interface AuditScopeStandard {
  id: string;
  auditId: string;
  standardId: string;
  scopeType: 'full' | 'partial';
  isLocked: boolean;
  lockedAt?: string | null;
  lockedBy?: string | null;
  notes?: string | null;
  standard?: StandardData;
}

export interface AuditScopeClause {
  id: string;
  auditId: string;
  clauseId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'not_applicable';
  isLocked: boolean;
  notes?: string | null;
  clause?: ClauseData;
}

export interface AuditScope {
  standards: AuditScopeStandard[];
  clauses: AuditScopeClause[];
  isLocked: boolean;
}

export const standardsLibraryApi = {
  list: (params?: Record<string, unknown>) => api.get(API_PATHS.STANDARDS_LIBRARY.LIST, { params }),

  get: (id: string) => api.get(API_PATHS.STANDARDS_LIBRARY.GET(id)),

  getWithClauses: (id: string) =>
    api.get(API_PATHS.STANDARDS_LIBRARY.GET_WITH_CLAUSES(id)),

  create: (data: {
    code: string;
    name: string;
    shortName?: string;
    version: string;
    description?: string;
    publisher?: string;
    effectiveDate?: string;
    domain?: string;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }) => api.post(API_PATHS.STANDARDS_LIBRARY.CREATE, data),

  update: (
    id: string,
    data: {
      code?: string;
      name?: string;
      shortName?: string;
      version?: string;
      description?: string;
      publisher?: string;
      effectiveDate?: string;
      domain?: string;
      isActive?: boolean;
      metadata?: Record<string, unknown>;
    }
  ) => api.patch(API_PATHS.STANDARDS_LIBRARY.UPDATE(id), data),

  delete: (id: string) => api.delete(API_PATHS.STANDARDS_LIBRARY.DELETE(id)),

  getSummary: () => api.get(API_PATHS.STANDARDS_LIBRARY.SUMMARY),

  getClauses: (standardId: string) =>
    api.get(API_PATHS.STANDARDS_LIBRARY.CLAUSES(standardId)),

  getClausesTree: (standardId: string) =>
    api.get(API_PATHS.STANDARDS_LIBRARY.CLAUSES_TREE(standardId)),

  createClause: (
    standardId: string,
    data: {
      code: string;
      title: string;
      description?: string;
      descriptionLong?: string;
      parentClauseId?: string;
      level?: number;
      sortOrder?: number;
      path?: string;
      isAuditable?: boolean;
      metadata?: Record<string, unknown>;
    }
  ) => api.post(API_PATHS.STANDARDS_LIBRARY.CREATE_CLAUSE(standardId), data),

  getClause: (clauseId: string) =>
    api.get(API_PATHS.STANDARDS_LIBRARY.GET_CLAUSE(clauseId)),

  updateClause: (
    clauseId: string,
    data: {
      code?: string;
      title?: string;
      description?: string;
      descriptionLong?: string;
      parentClauseId?: string;
      level?: number;
      sortOrder?: number;
      path?: string;
      isAuditable?: boolean;
      metadata?: Record<string, unknown>;
    }
  ) => api.patch(API_PATHS.STANDARDS_LIBRARY.UPDATE_CLAUSE(clauseId), data),
};

// ============================================================================
// Audit Scope API (Audit Phase 2)
// ============================================================================

export const auditScopeApi = {
  getScope: (auditId: string) => api.get(API_PATHS.AUDIT_SCOPE.GET(auditId)),

  setScope: (
    auditId: string,
    data: {
      standardIds: string[];
      clauseIds?: string[];
    }
  ) => api.post(API_PATHS.AUDIT_SCOPE.SET(auditId), data),

  lockScope: (auditId: string) =>
    api.post(API_PATHS.AUDIT_SCOPE.LOCK(auditId)),

  getClauseFindings: (auditId: string, clauseId: string) =>
    api.get(API_PATHS.AUDIT_SCOPE.CLAUSE_FINDINGS(auditId, clauseId)),

  linkFindingToClause: (
    auditId: string,
    clauseId: string,
    data: {
      issueId: string;
      notes?: string;
    }
  ) => api.post(API_PATHS.AUDIT_SCOPE.LINK_FINDING(auditId, clauseId), data),

  unlinkFindingFromClause: (auditId: string, clauseId: string, issueId: string) =>
    api.delete(API_PATHS.AUDIT_SCOPE.UNLINK_FINDING(auditId, clauseId, issueId)),

  createFindingForClause: (
    auditId: string,
    clauseId: string,
    data?: {
      title?: string;
      description?: string;
      severity?: string;
      notes?: string;
    }
  ) => api.post(API_PATHS.AUDIT_SCOPE.LINK_FINDING(auditId, clauseId), data || {}),
};

// ============================================================================
// Data Model Dictionary Types (Admin Studio FAZ 2)
// ============================================================================

export type DictionaryFieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'uuid'
  | 'enum'
  | 'json'
  | 'reference'
  | 'unknown';

export type DictionaryRelationshipType =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many';

export interface DictionaryField {
  name: string;
  columnName: string;
  type: DictionaryFieldType;
  label: string;
  description: string | null;
  isRequired: boolean;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isGenerated: boolean;
  isAuditField: boolean;
  isTenantScoped: boolean;
  defaultValue: unknown | null;
  enumValues: string[] | null;
  referenceTarget: string | null;
  maxLength: number | null;
}

export interface DictionaryRelationship {
  name: string;
  type: DictionaryRelationshipType;
  sourceTable: string;
  sourceField: string;
  targetTable: string;
  targetField: string;
  isNullable: boolean;
  isCascade: boolean;
  inverseRelationship: string | null;
}

export interface DictionaryTable {
  name: string;
  tableName: string;
  label: string;
  description: string | null;
  isTenantScoped: boolean;
  hasSoftDelete: boolean;
  hasAuditFields: boolean;
  fields: DictionaryField[];
  relationships: DictionaryRelationship[];
  primaryKeyField: string;
}

export interface DotWalkSegment {
  field: string;
  targetTable: string;
  relationshipType: DictionaryRelationshipType;
}

export interface DotWalkPath {
  path: string;
  segments: DotWalkSegment[];
  reachableTables: string[];
}

export interface DataModelSummary {
  totalTables: number;
  totalRelationships: number;
  tenantScopedTables: number;
  tablesWithSoftDelete: number;
  relationshipsByType: Record<DictionaryRelationshipType, number>;
}

export interface DataModelGraphNode {
  id: string;
  label: string;
  tableName: string;
  fieldCount: number;
  isTenantScoped: boolean;
  hasSoftDelete: boolean;
}

export interface DataModelGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: DictionaryRelationshipType;
  sourceField: string;
}

export interface DataModelGraph {
  nodes: DataModelGraphNode[];
  edges: DataModelGraphEdge[];
}

// ============================================================================
// Data Model Dictionary API (Admin Studio FAZ 2)
// ============================================================================

export const dataModelApi = {
  listTables: (options?: {
    tenantScopedOnly?: boolean;
    withRelationships?: boolean;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.tenantScopedOnly) params.append('tenantScopedOnly', 'true');
    if (options?.withRelationships) params.append('withRelationships', 'true');
    if (options?.search) params.append('search', options.search);
    const queryString = params.toString();
    return api.get(`${API_PATHS.DATA_MODEL.TABLES}${queryString ? `?${queryString}` : ''}`);
  },

  getTable: (name: string) => api.get(API_PATHS.DATA_MODEL.TABLE(name)),

  getTableRelationships: (name: string) =>
    api.get(API_PATHS.DATA_MODEL.TABLE_RELATIONSHIPS(name)),

  getDotWalkingPaths: (name: string, maxDepth?: number) => {
    const params = maxDepth ? `?maxDepth=${maxDepth}` : '';
    return api.get(`${API_PATHS.DATA_MODEL.TABLE_DOT_WALKING(name)}${params}`);
  },

  listRelationships: () => api.get(API_PATHS.DATA_MODEL.RELATIONSHIPS),

  getSummary: () => api.get(API_PATHS.DATA_MODEL.SUMMARY),

  getGraph: () => api.get(API_PATHS.DATA_MODEL.GRAPH),

  refreshCache: () => api.get(API_PATHS.DATA_MODEL.REFRESH),
};

// ============================================================================
// Platform Universal Views Types
// ============================================================================

export type SchemaDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'uuid'
  | 'relation';

export interface FieldSchema {
  name: string;
  label: string;
  dataType: SchemaDataType;
  enumValues?: string[];
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  defaultVisible: boolean;
  width?: number;
  relationTable?: string;
  relationLabelField?: string;
}

export interface TableSchema {
  tableName: string;
  displayName: string;
  fields: FieldSchema[];
}

export interface ColumnFilter {
  op: string;
  value: unknown;
  valueTo?: unknown;
}

export interface ViewPreference {
  visibleColumns: string[];
  columnOrder: string[];
  columnWidths?: Record<string, number>;
  sort?: {
    field: string;
    direction: 'ASC' | 'DESC';
  };
  filters?: Record<string, ColumnFilter>;
  pageSize?: number;
}

export interface ViewPreferenceResponse {
  tableName: string;
  userId: string;
  tenantId: string;
  preference: ViewPreference;
  createdAt: string;
  updatedAt: string;
}

export interface SaveViewPreferenceDto {
  visibleColumns?: string[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  sort?: {
    field: string;
    direction: 'ASC' | 'DESC';
  };
  filters?: Record<string, ColumnFilter>;
  pageSize?: number;
}

// ============================================================================
// Platform Universal Views API
// ============================================================================

export const platformViewsApi = {
  listTables: (tenantId: string) =>
    api.get(API_PATHS.PLATFORM.TABLES, withTenantId(tenantId)),

  getTableSchema: (tenantId: string, tableName: string) =>
    api.get(API_PATHS.PLATFORM.TABLE_SCHEMA(tableName), withTenantId(tenantId)),

  getViewPreference: (tenantId: string, tableName: string) =>
    api.get(API_PATHS.PLATFORM.VIEW(tableName), withTenantId(tenantId)),

  saveViewPreference: (
    tenantId: string,
    tableName: string,
    preference: SaveViewPreferenceDto,
  ) =>
    api.put(API_PATHS.PLATFORM.VIEW(tableName), preference, withTenantId(tenantId)),

  getAllViewPreferences: (tenantId: string) =>
    api.get(API_PATHS.PLATFORM.VIEWS, withTenantId(tenantId)),
};

// ============================================================================
// GRC Insights API (Sprint 1E)
// ============================================================================

export interface GrcInsightsOverview {
  openIssuesBySeverity: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  overdueCAPAsCount: number;
  recentFailTestResults: Array<{
    id: string;
    name: string;
    testedAt: string | null;
    controlTestName: string | null;
  }>;
  evidenceStats: {
    linked: number;
    unlinked: number;
    total: number;
  };
  summary: {
    totalOpenIssues: number;
    totalOverdueCAPAs: number;
    totalFailedTests: number;
  };
}

export const grcInsightsApi = {
  getOverview: async (tenantId: string): Promise<GrcInsightsOverview> => {
    const response = await api.get(API_PATHS.GRC_INSIGHTS.OVERVIEW, withTenantId(tenantId));
    return unwrapResponse<GrcInsightsOverview>(response);
  },
};

// ============================================================================
// GRC Meta - List Options (List Toolbar Standard)
// ============================================================================

export interface SortableField {
  name: string;
  label: string;
  type: string;
}

export interface FilterableField {
  name: string;
  label: string;
  type: string;
  enumValues?: string[];
  enumLabels?: Record<string, string>;
}

export interface ListOptionsResponse {
  entity: string;
  sortableFields: SortableField[];
  filterableFields: FilterableField[];
  searchableFields: string[];
}

export interface RegisteredEntitiesResponse {
  entities: string[];
}

export const grcMetaApi = {
  getRegisteredEntities: async (tenantId: string): Promise<RegisteredEntitiesResponse> => {
    const response = await api.get(API_PATHS.GRC_META.LIST_OPTIONS, withTenantId(tenantId));
    return unwrapResponse<RegisteredEntitiesResponse>(response);
  },

  getListOptions: async (tenantId: string, entity: string): Promise<ListOptionsResponse> => {
    const response = await api.get(API_PATHS.GRC_META.LIST_OPTIONS_BY_ENTITY(entity), withTenantId(tenantId));
    return unwrapResponse<ListOptionsResponse>(response);
  },
};

// ============================================================================
// Platform Core - Universal Attachments
// ============================================================================

export interface AttachmentData {
  id: string;
  tenantId: string;
  refTable: string;
  refId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  storageProvider: 'local' | 's3';
  status: 'uploaded' | 'scanned' | 'blocked' | 'deleted';
  createdBy: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export const attachmentApi = {
  list: async (tenantId: string, refTable: string, refId: string): Promise<AttachmentData[]> => {
    const response = await api.get(
      `${API_PATHS.ATTACHMENTS.LIST}?refTable=${encodeURIComponent(refTable)}&refId=${encodeURIComponent(refId)}`,
      withTenantId(tenantId)
    );
    return unwrapResponse<AttachmentData[]>(response);
  },

  upload: async (tenantId: string, refTable: string, refId: string, file: File): Promise<AttachmentData> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(
      `${API_PATHS.ATTACHMENTS.UPLOAD}?refTable=${encodeURIComponent(refTable)}&refId=${encodeURIComponent(refId)}`,
      formData,
      {
        ...withTenantId(tenantId),
        headers: {
          ...withTenantId(tenantId).headers,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return unwrapResponse<AttachmentData>(response);
  },

  get: async (tenantId: string, id: string): Promise<AttachmentData> => {
    const response = await api.get(API_PATHS.ATTACHMENTS.GET(id), withTenantId(tenantId));
    return unwrapResponse<AttachmentData>(response);
  },

  download: async (tenantId: string, id: string): Promise<Blob> => {
    const response = await api.get(API_PATHS.ATTACHMENTS.DOWNLOAD(id), {
      ...withTenantId(tenantId),
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  delete: async (tenantId: string, id: string): Promise<void> => {
    await api.delete(API_PATHS.ATTACHMENTS.DELETE(id), withTenantId(tenantId));
  },
};

// ============================================================================
// Platform Core - List Views
// ============================================================================

export interface ListViewColumnData {
  id: string;
  columnName: string;
  orderIndex: number;
  visible: boolean;
  width: number | null;
  pinned: 'left' | 'right' | null;
}

export interface ListViewData {
  id: string;
  tenantId: string;
  tableName: string;
  name: string;
  scope: 'user' | 'role' | 'tenant' | 'system';
  ownerUserId: string | null;
  roleId: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  columns: ListViewColumnData[];
}

export interface ListViewsResponse {
  views: ListViewData[];
  defaultView: ListViewData | null;
}

export interface CreateListViewDto {
  tableName: string;
  name: string;
  scope?: 'user' | 'role' | 'tenant' | 'system';
  roleId?: string;
  isDefault?: boolean;
  columns?: Array<{
    columnName: string;
    orderIndex: number;
    visible?: boolean;
    width?: number;
    pinned?: 'left' | 'right';
  }>;
}

export interface UpdateListViewDto {
  name?: string;
  isDefault?: boolean;
}

export interface UpdateColumnsDto {
  columns: Array<{
    columnName: string;
    orderIndex: number;
    visible?: boolean;
    width?: number;
    pinned?: 'left' | 'right';
  }>;
}

export const listViewApi = {
  list: async (tenantId: string, tableName: string, roleId?: string): Promise<ListViewsResponse> => {
    let url = `${API_PATHS.LIST_VIEWS.LIST}?tableName=${encodeURIComponent(tableName)}`;
    if (roleId) {
      url += `&roleId=${encodeURIComponent(roleId)}`;
    }
    const response = await api.get(url, withTenantId(tenantId));
    return unwrapResponse<ListViewsResponse>(response);
  },

  get: async (tenantId: string, id: string): Promise<ListViewData> => {
    const response = await api.get(API_PATHS.LIST_VIEWS.GET(id), withTenantId(tenantId));
    return unwrapResponse<ListViewData>(response);
  },

  create: async (tenantId: string, data: CreateListViewDto): Promise<ListViewData> => {
    const response = await api.post(API_PATHS.LIST_VIEWS.CREATE, data, withTenantId(tenantId));
    return unwrapResponse<ListViewData>(response);
  },

  update: async (tenantId: string, id: string, data: UpdateListViewDto): Promise<ListViewData> => {
    const response = await api.put(API_PATHS.LIST_VIEWS.UPDATE(id), data, withTenantId(tenantId));
    return unwrapResponse<ListViewData>(response);
  },

  updateColumns: async (tenantId: string, id: string, data: UpdateColumnsDto): Promise<ListViewData> => {
    const response = await api.put(API_PATHS.LIST_VIEWS.UPDATE_COLUMNS(id), data, withTenantId(tenantId));
    return unwrapResponse<ListViewData>(response);
  },

  delete: async (tenantId: string, id: string): Promise<void> => {
    await api.delete(API_PATHS.LIST_VIEWS.DELETE(id), withTenantId(tenantId));
  },
};

// ============================================================================
// Platform Core - Export
// ============================================================================

export interface ExportRequestDto {
  tableName: string;
  viewId?: string;
  columns?: string[];
  filters?: Record<string, unknown>;
  search?: string;
  sort?: { field: string; order: 'ASC' | 'DESC' };
  format: 'csv' | 'xlsx';
}

export const exportApi = {
  export: async (tenantId: string, data: ExportRequestDto): Promise<Blob> => {
    const response = await api.post(API_PATHS.EXPORT.CREATE, data, {
      ...withTenantId(tenantId),
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};

// ============================================================================
// Platform Builder - Admin APIs
// ============================================================================

export type PlatformBuilderFieldType = 'string' | 'text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'choice' | 'reference';

export interface ChoiceOption {
  label: string;
  value: string;
}

export interface SysDbObjectData {
  id: string;
  tenantId: string;
  name: string;
  label: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  isDeleted: boolean;
  fieldCount?: number;
  recordCount?: number;
}

export interface SysDictionaryData {
  id: string;
  tenantId: string;
  tableName: string;
  fieldName: string;
  label: string;
  type: PlatformBuilderFieldType;
  isRequired: boolean;
  isUnique: boolean;
  readOnly?: boolean;
  referenceTable?: string;
  choiceOptions?: ChoiceOption[];
  choiceTable?: string;
  defaultValue?: string;
  maxLength?: number;
  fieldOrder: number;
  indexed?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  isDeleted: boolean;
}

export interface CreateTableDto {
  name: string;
  label: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateTableDto {
  label?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateFieldDto {
  fieldName: string;
  label: string;
  type?: PlatformBuilderFieldType;
  isRequired?: boolean;
  isUnique?: boolean;
  readOnly?: boolean;
  referenceTable?: string;
  choiceOptions?: ChoiceOption[];
  choiceTable?: string;
  defaultValue?: string;
  maxLength?: number;
  fieldOrder?: number;
  indexed?: boolean;
  isActive?: boolean;
}

export interface UpdateFieldDto {
  label?: string;
  type?: PlatformBuilderFieldType;
  isRequired?: boolean;
  isUnique?: boolean;
  readOnly?: boolean;
  referenceTable?: string;
  choiceOptions?: ChoiceOption[];
  choiceTable?: string;
  defaultValue?: string;
  maxLength?: number;
  fieldOrder?: number;
  indexed?: boolean;
  isActive?: boolean;
}

export interface TablesListResponse {
  items: SysDbObjectData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FieldsListResponse {
  items: SysDictionaryData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const platformBuilderApi = {
  // Table management
  listTables: async (tenantId: string, params?: { page?: number; pageSize?: number; search?: string }): Promise<TablesListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);
    const url = queryParams.toString() ? `${API_PATHS.PLATFORM_BUILDER.TABLES.LIST}?${queryParams}` : API_PATHS.PLATFORM_BUILDER.TABLES.LIST;
    const response = await api.get(url, withTenantId(tenantId));
    return unwrapResponse<TablesListResponse>(response);
  },

  getTable: async (tenantId: string, id: string): Promise<SysDbObjectData> => {
    const response = await api.get(API_PATHS.PLATFORM_BUILDER.TABLES.GET(id), withTenantId(tenantId));
    return unwrapResponse<SysDbObjectData>(response);
  },

  createTable: async (tenantId: string, data: CreateTableDto): Promise<SysDbObjectData> => {
    const response = await api.post(API_PATHS.PLATFORM_BUILDER.TABLES.CREATE, data, withTenantId(tenantId));
    return unwrapResponse<SysDbObjectData>(response);
  },

  updateTable: async (tenantId: string, id: string, data: UpdateTableDto): Promise<SysDbObjectData> => {
    const response = await api.patch(API_PATHS.PLATFORM_BUILDER.TABLES.UPDATE(id), data, withTenantId(tenantId));
    return unwrapResponse<SysDbObjectData>(response);
  },

  deleteTable: async (tenantId: string, id: string): Promise<void> => {
    await api.delete(API_PATHS.PLATFORM_BUILDER.TABLES.DELETE(id), withTenantId(tenantId));
  },

  // Field management
  listFields: async (tenantId: string, tableId: string, params?: { page?: number; pageSize?: number }): Promise<FieldsListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    const url = queryParams.toString() ? `${API_PATHS.PLATFORM_BUILDER.FIELDS.LIST(tableId)}?${queryParams}` : API_PATHS.PLATFORM_BUILDER.FIELDS.LIST(tableId);
    const response = await api.get(url, withTenantId(tenantId));
    return unwrapResponse<FieldsListResponse>(response);
  },

  getField: async (tenantId: string, fieldId: string): Promise<SysDictionaryData> => {
    const response = await api.get(API_PATHS.PLATFORM_BUILDER.FIELDS.GET(fieldId), withTenantId(tenantId));
    return unwrapResponse<SysDictionaryData>(response);
  },

  createField: async (tenantId: string, tableId: string, data: CreateFieldDto): Promise<SysDictionaryData> => {
    const response = await api.post(API_PATHS.PLATFORM_BUILDER.FIELDS.CREATE(tableId), data, withTenantId(tenantId));
    return unwrapResponse<SysDictionaryData>(response);
  },

  updateField: async (tenantId: string, fieldId: string, data: UpdateFieldDto): Promise<SysDictionaryData> => {
    const response = await api.patch(API_PATHS.PLATFORM_BUILDER.FIELDS.UPDATE(fieldId), data, withTenantId(tenantId));
    return unwrapResponse<SysDictionaryData>(response);
  },

  deleteField: async (tenantId: string, fieldId: string): Promise<void> => {
    await api.delete(API_PATHS.PLATFORM_BUILDER.FIELDS.DELETE(fieldId), withTenantId(tenantId));
  },

  // Relationship management
  listRelationships: async (tenantId: string, params?: { page?: number; pageSize?: number; search?: string; fromTable?: string; toTable?: string }): Promise<RelationshipsListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.fromTable) queryParams.append('fromTable', params.fromTable);
    if (params?.toTable) queryParams.append('toTable', params.toTable);
    const url = queryParams.toString() ? `${API_PATHS.PLATFORM_BUILDER.RELATIONSHIPS.LIST}?${queryParams}` : API_PATHS.PLATFORM_BUILDER.RELATIONSHIPS.LIST;
    const response = await api.get(url, withTenantId(tenantId));
    return unwrapResponse<RelationshipsListResponse>(response);
  },

  createRelationship: async (tenantId: string, data: CreateRelationshipDto): Promise<SysRelationshipData> => {
    const response = await api.post(API_PATHS.PLATFORM_BUILDER.RELATIONSHIPS.CREATE, data, withTenantId(tenantId));
    return unwrapResponse<SysRelationshipData>(response);
  },

  deleteRelationship: async (tenantId: string, id: string): Promise<void> => {
    await api.delete(API_PATHS.PLATFORM_BUILDER.RELATIONSHIPS.DELETE(id), withTenantId(tenantId));
  },
};

export type SysRelationshipType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';

export interface SysRelationshipData {
  id: string;
  tenantId: string;
  name: string;
  fromTable: string;
  toTable: string;
  type: SysRelationshipType;
  fkColumn?: string;
  m2mTable?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRelationshipDto {
  name: string;
  fromTable: string;
  toTable: string;
  type?: SysRelationshipType;
  fkColumn?: string;
  m2mTable?: string;
  isActive?: boolean;
}

export interface RelationshipsListResponse {
  items: SysRelationshipData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// Dynamic Data - Runtime APIs
// ============================================================================

export interface DynamicRecordData {
  id: string;
  tenantId: string;
  tableName: string;
  recordId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  isDeleted: boolean;
}

export interface DynamicRecordsListResponse {
  records: {
    items: DynamicRecordData[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  fields: SysDictionaryData[];
}

export interface DynamicRecordDetailResponse {
  record: DynamicRecordData;
  fields: SysDictionaryData[];
}

export interface CreateDynamicRecordDto {
  data: Record<string, unknown>;
}

export interface UpdateDynamicRecordDto {
  data: Record<string, unknown>;
}

export interface DynamicDataListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filter?: Record<string, unknown>;
}

export const dynamicDataApi = {
  list: async (tenantId: string, tableName: string, params?: DynamicDataListParams): Promise<DynamicRecordsListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params?.filter) queryParams.append('filter', JSON.stringify(params.filter));
    const url = queryParams.toString() ? `${API_PATHS.DYNAMIC_DATA.LIST(tableName)}?${queryParams}` : API_PATHS.DYNAMIC_DATA.LIST(tableName);
    const response = await api.get(url, withTenantId(tenantId));
    return unwrapResponse<DynamicRecordsListResponse>(response);
  },

  getSchema: async (tenantId: string, tableName: string): Promise<{ fields: SysDictionaryData[] }> => {
    const response = await api.get(API_PATHS.DYNAMIC_DATA.SCHEMA(tableName), withTenantId(tenantId));
    return unwrapResponse<{ fields: SysDictionaryData[] }>(response);
  },

  get: async (tenantId: string, tableName: string, recordId: string): Promise<DynamicRecordDetailResponse> => {
    const response = await api.get(API_PATHS.DYNAMIC_DATA.GET(tableName, recordId), withTenantId(tenantId));
    return unwrapResponse<DynamicRecordDetailResponse>(response);
  },

  create: async (tenantId: string, tableName: string, data: CreateDynamicRecordDto): Promise<DynamicRecordData> => {
    const response = await api.post(API_PATHS.DYNAMIC_DATA.CREATE(tableName), data, withTenantId(tenantId));
    return unwrapResponse<DynamicRecordData>(response);
  },

  update: async (tenantId: string, tableName: string, recordId: string, data: UpdateDynamicRecordDto): Promise<DynamicRecordData> => {
    const response = await api.patch(API_PATHS.DYNAMIC_DATA.UPDATE(tableName, recordId), data, withTenantId(tenantId));
    return unwrapResponse<DynamicRecordData>(response);
  },

  delete: async (tenantId: string, tableName: string, recordId: string): Promise<void> => {
    await api.delete(API_PATHS.DYNAMIC_DATA.DELETE(tableName, recordId), withTenantId(tenantId));
  },
};

// ============================================================================
// SOA (Statement of Applicability) Types and API
// ============================================================================

export type SoaProfileStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type SoaApplicability = 'APPLICABLE' | 'NOT_APPLICABLE' | 'UNDECIDED';
export type SoaImplementationStatus = 'IMPLEMENTED' | 'PARTIALLY_IMPLEMENTED' | 'PLANNED' | 'NOT_IMPLEMENTED';

export interface SoaProfileData {
  id: string;
  tenantId: string;
  standardId: string;
  standard?: StandardData;
  name: string;
  description: string | null;
  scopeText: string | null;
  status: SoaProfileStatus;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isDeleted: boolean;
}

export interface SoaItemData {
  id: string;
  tenantId: string;
  profileId: string;
  clauseId: string;
  clause?: ClauseData;
  applicability: SoaApplicability;
  justification: string | null;
  implementationStatus: SoaImplementationStatus;
  targetDate: string | null;
  ownerUserId: string | null;
  notes: string | null;
  controlsCount?: number;
  evidenceCount?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isDeleted: boolean;
}

export interface CreateSoaProfileDto {
  standardId: string;
  name: string;
  description?: string;
  scopeText?: string;
}

export interface UpdateSoaProfileDto {
  name?: string;
  description?: string;
  scopeText?: string;
}

export interface UpdateSoaItemDto {
  applicability?: SoaApplicability;
  justification?: string;
  implementationStatus?: SoaImplementationStatus;
  targetDate?: string;
  ownerUserId?: string;
  notes?: string;
}

export interface SoaProfileListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  standardId?: string;
  status?: SoaProfileStatus;
  sort?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface SoaItemListParams {
  profileId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  clauseId?: string;
  applicability?: SoaApplicability;
  implementationStatus?: SoaImplementationStatus;
  hasEvidence?: boolean;
  hasControls?: boolean;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface InitializeItemsResult {
  created: number;
  existing: number;
}

export interface SoaItemControlLink {
  id: string;
  tenantId: string;
  soaItemId: string;
  controlId: string;
  createdAt: string;
}

export interface SoaItemEvidenceLink {
  id: string;
  tenantId: string;
  soaItemId: string;
  evidenceId: string;
  createdAt: string;
}

export interface SoaProfileStatistics {
  totalItems: number;
  applicabilityCounts: Record<string, number>;
  implementationCounts: Record<string, number>;
  evidenceCoverage: {
    itemsWithEvidence: number;
    itemsWithoutEvidence: number;
  };
  controlCoverage: {
    itemsWithControls: number;
    itemsWithoutControls: number;
  };
  gaps: {
    missingControls: number;
    missingEvidence: number;
    applicableNotImplemented: number;
  };
}

export const soaApi = {
  // Profile operations - returns raw AxiosResponse for useUniversalList compatibility
  listProfiles: (tenantId: string, params?: SoaProfileListParams | Record<string, unknown>) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));
    if (params?.search) queryParams.append('search', String(params.search));
    if (params?.standardId) queryParams.append('standardId', String(params.standardId));
    if (params?.status) queryParams.append('status', String(params.status));
    if (params?.sort) queryParams.append('sort', String(params.sort));
    if (params?.sortBy) queryParams.append('sortBy', String(params.sortBy));
    if (params?.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));
    const url = queryParams.toString() ? `${API_PATHS.GRC_SOA.PROFILES.LIST}?${queryParams}` : API_PATHS.GRC_SOA.PROFILES.LIST;
    return api.get(url, withTenantId(tenantId));
  },

  getProfile: async (tenantId: string, id: string): Promise<SoaProfileData> => {
    const response = await api.get(API_PATHS.GRC_SOA.PROFILES.GET(id), withTenantId(tenantId));
    return unwrapResponse<SoaProfileData>(response);
  },

  createProfile: async (tenantId: string, data: CreateSoaProfileDto): Promise<SoaProfileData> => {
    const response = await api.post(API_PATHS.GRC_SOA.PROFILES.CREATE, data, withTenantId(tenantId));
    return unwrapResponse<SoaProfileData>(response);
  },

  updateProfile: async (tenantId: string, id: string, data: UpdateSoaProfileDto): Promise<SoaProfileData> => {
    const response = await api.patch(API_PATHS.GRC_SOA.PROFILES.UPDATE(id), data, withTenantId(tenantId));
    return unwrapResponse<SoaProfileData>(response);
  },

  deleteProfile: async (tenantId: string, id: string): Promise<void> => {
    await api.delete(API_PATHS.GRC_SOA.PROFILES.DELETE(id), withTenantId(tenantId));
  },

  publishProfile: async (tenantId: string, id: string): Promise<SoaProfileData> => {
    const response = await api.post(API_PATHS.GRC_SOA.PROFILES.PUBLISH(id), {}, withTenantId(tenantId));
    return unwrapResponse<SoaProfileData>(response);
  },

  initializeItems: async (tenantId: string, profileId: string): Promise<InitializeItemsResult> => {
    const response = await api.post(API_PATHS.GRC_SOA.PROFILES.INITIALIZE_ITEMS(profileId), {}, withTenantId(tenantId));
    return unwrapResponse<InitializeItemsResult>(response);
  },

  exportCsv: async (tenantId: string, profileId: string): Promise<Blob> => {
    const response = await api.get(`${API_PATHS.GRC_SOA.PROFILES.EXPORT(profileId)}?format=csv`, {
      ...withTenantId(tenantId),
      responseType: 'blob',
    });
    return response.data;
  },

  getProfileStatistics: async (tenantId: string, profileId: string): Promise<SoaProfileStatistics> => {
    const response = await api.get(API_PATHS.GRC_SOA.PROFILES.STATISTICS(profileId), withTenantId(tenantId));
    return unwrapResponse<SoaProfileStatistics>(response);
  },

  // Item operations
  listItems: async (tenantId: string, params: SoaItemListParams): Promise<{ items: SoaItemData[]; total: number; page: number; pageSize: number }> => {
    const queryParams = new URLSearchParams();
    queryParams.append('profileId', params.profileId);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.clauseId) queryParams.append('clauseId', params.clauseId);
    if (params.applicability) queryParams.append('applicability', params.applicability);
    if (params.implementationStatus) queryParams.append('implementationStatus', params.implementationStatus);
    if (params.hasEvidence !== undefined) queryParams.append('hasEvidence', params.hasEvidence.toString());
    if (params.hasControls !== undefined) queryParams.append('hasControls', params.hasControls.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    const url = `${API_PATHS.GRC_SOA.ITEMS.LIST}?${queryParams}`;
    const response = await api.get(url, withTenantId(tenantId));
    return unwrapPaginatedResponse<SoaItemData>(response);
  },

  getItem: async (tenantId: string, id: string): Promise<SoaItemData> => {
    const response = await api.get(API_PATHS.GRC_SOA.ITEMS.GET(id), withTenantId(tenantId));
    return unwrapResponse<SoaItemData>(response);
  },

  updateItem: async (tenantId: string, id: string, data: UpdateSoaItemDto): Promise<SoaItemData> => {
    const response = await api.patch(API_PATHS.GRC_SOA.ITEMS.UPDATE(id), data, withTenantId(tenantId));
    return unwrapResponse<SoaItemData>(response);
  },

  // Control linking
  linkControl: async (tenantId: string, itemId: string, controlId: string): Promise<SoaItemControlLink> => {
    const response = await api.post(API_PATHS.GRC_SOA.ITEMS.LINK_CONTROL(itemId, controlId), {}, withTenantId(tenantId));
    return unwrapResponse<SoaItemControlLink>(response);
  },

  unlinkControl: async (tenantId: string, itemId: string, controlId: string): Promise<void> => {
    await api.delete(API_PATHS.GRC_SOA.ITEMS.UNLINK_CONTROL(itemId, controlId), withTenantId(tenantId));
  },

  // Evidence linking
  linkEvidence: async (tenantId: string, itemId: string, evidenceId: string): Promise<SoaItemEvidenceLink> => {
    const response = await api.post(API_PATHS.GRC_SOA.ITEMS.LINK_EVIDENCE(itemId, evidenceId), {}, withTenantId(tenantId));
    return unwrapResponse<SoaItemEvidenceLink>(response);
  },

  unlinkEvidence: async (tenantId: string, itemId: string, evidenceId: string): Promise<void> => {
    await api.delete(API_PATHS.GRC_SOA.ITEMS.UNLINK_EVIDENCE(itemId, evidenceId), withTenantId(tenantId));
  },

  // Issue linking (SOA Closure Loop)
  listLinkedIssues: async (tenantId: string, itemId: string, page = 1, pageSize = 5): Promise<{ items: IssueData[]; total: number; page: number; pageSize: number }> => {
    const url = `${API_PATHS.GRC_SOA.ITEMS.LIST_ISSUES(itemId)}?page=${page}&pageSize=${pageSize}`;
    const response = await api.get(url, withTenantId(tenantId));
    return unwrapPaginatedResponse<IssueData>(response);
  },

  createIssueFromItem: async (tenantId: string, itemId: string, data: { title?: string; description?: string; severity?: string; ownerUserId?: string; dueDate?: string }): Promise<IssueData> => {
    const response = await api.post(API_PATHS.GRC_SOA.ITEMS.CREATE_ISSUE(itemId), data, withTenantId(tenantId));
    return unwrapResponse<IssueData>(response);
  },

  // CAPA linking (SOA Closure Loop)
  listLinkedCapas: async (tenantId: string, itemId: string, page = 1, pageSize = 5): Promise<{ items: CapaData[]; total: number; page: number; pageSize: number }> => {
    const url = `${API_PATHS.GRC_SOA.ITEMS.LIST_CAPAS(itemId)}?page=${page}&pageSize=${pageSize}`;
    const response = await api.get(url, withTenantId(tenantId));
    return unwrapPaginatedResponse<CapaData>(response);
  },

  createCapaFromItem: async (tenantId: string, itemId: string, data: { title: string; description?: string; type?: string; priority?: string; ownerUserId?: string; dueDate?: string; issueId?: string }): Promise<CapaData> => {
    const response = await api.post(API_PATHS.GRC_SOA.ITEMS.CREATE_CAPA(itemId), data, withTenantId(tenantId));
    return unwrapResponse<CapaData>(response);
  },
};

// ============================================================================
// BCM (Business Continuity Management) API
// ============================================================================

export type BcmServiceStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type BcmCriticalityTier = 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';
export type BcmBiaStatus = 'DRAFT' | 'REVIEWED' | 'APPROVED';
export type BcmPlanType = 'BCP' | 'DRP' | 'IT_CONTINUITY';
export type BcmPlanStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'RETIRED';
export type BcmPlanStepStatus = 'PLANNED' | 'READY' | 'DEPRECATED';
export type BcmExerciseType = 'TABLETOP' | 'FAILOVER' | 'RESTORE' | 'COMMS';
export type BcmExerciseStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type BcmExerciseOutcome = 'PASS' | 'PARTIAL' | 'FAIL';

export interface BcmServiceData {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: BcmServiceStatus;
  criticalityTier: BcmCriticalityTier | null;
  businessOwnerUserId: string | null;
  itOwnerUserId: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CreateBcmServiceDto {
  name: string;
  description?: string;
  status?: BcmServiceStatus;
  criticalityTier?: BcmCriticalityTier;
  businessOwnerUserId?: string;
  itOwnerUserId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateBcmServiceDto {
  name?: string;
  description?: string;
  status?: BcmServiceStatus;
  criticalityTier?: BcmCriticalityTier;
  businessOwnerUserId?: string;
  itOwnerUserId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface BcmBiaData {
  id: string;
  tenantId: string;
  serviceId: string;
  rtoMinutes: number;
  rpoMinutes: number;
  mtpdMinutes: number | null;
  impactOperational: number;
  impactFinancial: number;
  impactRegulatory: number;
  impactReputational: number;
  overallImpactScore: number;
  criticalityTier: BcmCriticalityTier;
  assumptions: string | null;
  dependencies: string | null;
  notes: string | null;
  status: BcmBiaStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  service?: BcmServiceData;
}

export interface CreateBcmBiaDto {
  serviceId: string;
  rtoMinutes: number;
  rpoMinutes: number;
  mtpdMinutes?: number;
  impactOperational: number;
  impactFinancial: number;
  impactRegulatory: number;
  impactReputational: number;
  assumptions?: string;
  dependencies?: string;
  notes?: string;
  status?: BcmBiaStatus;
}

export interface UpdateBcmBiaDto {
  rtoMinutes?: number;
  rpoMinutes?: number;
  mtpdMinutes?: number;
  impactOperational?: number;
  impactFinancial?: number;
  impactRegulatory?: number;
  impactReputational?: number;
  assumptions?: string;
  dependencies?: string;
  notes?: string;
  status?: BcmBiaStatus;
}

export interface BcmPlanData {
  id: string;
  tenantId: string;
  serviceId: string;
  name: string;
  planType: BcmPlanType;
  status: BcmPlanStatus;
  ownerUserId: string | null;
  approverUserId: string | null;
  approvedAt: string | null;
  summary: string | null;
  triggers: string | null;
  recoverySteps: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  service?: BcmServiceData;
  steps?: BcmPlanStepData[];
}

export interface CreateBcmPlanDto {
  serviceId: string;
  name: string;
  planType: BcmPlanType;
  status?: BcmPlanStatus;
  ownerUserId?: string;
  approverUserId?: string;
  summary?: string;
  triggers?: string;
  recoverySteps?: string;
}

export interface UpdateBcmPlanDto {
  name?: string;
  planType?: BcmPlanType;
  status?: BcmPlanStatus;
  ownerUserId?: string;
  approverUserId?: string;
  approvedAt?: string;
  summary?: string;
  triggers?: string;
  recoverySteps?: string;
}

export interface BcmPlanStepData {
  id: string;
  tenantId: string;
  planId: string;
  order: number;
  title: string;
  description: string | null;
  roleResponsible: string | null;
  estimatedMinutes: number | null;
  status: BcmPlanStepStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  plan?: BcmPlanData;
}

export interface CreateBcmPlanStepDto {
  planId: string;
  order: number;
  title: string;
  description?: string;
  roleResponsible?: string;
  estimatedMinutes?: number;
  status?: BcmPlanStepStatus;
}

export interface UpdateBcmPlanStepDto {
  order?: number;
  title?: string;
  description?: string;
  roleResponsible?: string;
  estimatedMinutes?: number;
  status?: BcmPlanStepStatus;
}

export interface BcmExerciseData {
  id: string;
  tenantId: string;
  serviceId: string;
  planId: string | null;
  name: string;
  exerciseType: BcmExerciseType;
  status: BcmExerciseStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  outcome: BcmExerciseOutcome | null;
  summary: string | null;
  lessonsLearned: string | null;
  linkedIssueId: string | null;
  linkedCapaId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  service?: BcmServiceData;
  plan?: BcmPlanData;
}

export interface CreateBcmExerciseDto {
  serviceId: string;
  planId?: string;
  name: string;
  exerciseType: BcmExerciseType;
  status?: BcmExerciseStatus;
  scheduledAt?: string;
  summary?: string;
  linkedIssueId?: string;
  linkedCapaId?: string;
}

export interface UpdateBcmExerciseDto {
  planId?: string;
  name?: string;
  exerciseType?: BcmExerciseType;
  status?: BcmExerciseStatus;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  outcome?: BcmExerciseOutcome;
  summary?: string;
  lessonsLearned?: string;
  linkedIssueId?: string;
  linkedCapaId?: string;
}

export interface BcmListParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  search?: string;
  filter?: string;
}

export const bcmApi = {
  // Filter metadata
  getFilters: async (tenantId: string) => {
    const response = await api.get(API_PATHS.GRC_BCM.FILTERS, withTenantId(tenantId));
    return unwrapResponse<Record<string, unknown>>(response);
  },

  // Services
  listServices: (tenantId: string, params?: BcmListParams & { status?: BcmServiceStatus; criticalityTier?: BcmCriticalityTier }) =>
    api.get(API_PATHS.GRC_BCM.SERVICES.LIST, { ...withTenantId(tenantId), params }),

  getService: async (tenantId: string, id: string): Promise<BcmServiceData> => {
    const response = await api.get(API_PATHS.GRC_BCM.SERVICES.GET(id), withTenantId(tenantId));
    return unwrapResponse<BcmServiceData>(response);
  },

  createService: async (tenantId: string, data: CreateBcmServiceDto): Promise<BcmServiceData> => {
    const response = await api.post(API_PATHS.GRC_BCM.SERVICES.CREATE, data, withTenantId(tenantId));
    return unwrapResponse<BcmServiceData>(response);
  },

  updateService: async (tenantId: string, id: string, data: UpdateBcmServiceDto): Promise<BcmServiceData> => {
    const response = await api.patch(API_PATHS.GRC_BCM.SERVICES.UPDATE(id), data, withTenantId(tenantId));
    return unwrapResponse<BcmServiceData>(response);
  },

  deleteService: async (tenantId: string, id: string): Promise<void> => {
    await api.delete(API_PATHS.GRC_BCM.SERVICES.DELETE(id), withTenantId(tenantId));
  },

  getServiceBias: async (tenantId: string, serviceId: string) => {
    const response = await api.get(API_PATHS.GRC_BCM.SERVICES.BIAS(serviceId), withTenantId(tenantId));
    return unwrapPaginatedResponse<BcmBiaData>(response);
  },

  getServicePlans: async (tenantId: string, serviceId: string) => {
    const response = await api.get(API_PATHS.GRC_BCM.SERVICES.PLANS(serviceId), withTenantId(tenantId));
    return unwrapPaginatedResponse<BcmPlanData>(response);
  },

  getServiceExercises: async (tenantId: string, serviceId: string) => {
    const response = await api.get(API_PATHS.GRC_BCM.SERVICES.EXERCISES(serviceId), withTenantId(tenantId));
    return unwrapPaginatedResponse<BcmExerciseData>(response);
  },

  // BIAs
  listBias: async (tenantId: string, params?: BcmListParams & { serviceId?: string; status?: BcmBiaStatus; criticalityTier?: BcmCriticalityTier }) => {
    const response = await api.get(API_PATHS.GRC_BCM.BIAS.LIST, { ...withTenantId(tenantId), params });
    return unwrapPaginatedResponse<BcmBiaData>(response);
  },

  getBia: async (tenantId: string, id: string): Promise<BcmBiaData> => {
    const response = await api.get(API_PATHS.GRC_BCM.BIAS.GET(id), withTenantId(tenantId));
    return unwrapResponse<BcmBiaData>(response);
  },

  createBia: async (tenantId: string, data: CreateBcmBiaDto): Promise<BcmBiaData> => {
    const response = await api.post(API_PATHS.GRC_BCM.BIAS.CREATE, data, withTenantId(tenantId));
    return unwrapResponse<BcmBiaData>(response);
  },

  updateBia: async (tenantId: string, id: string, data: UpdateBcmBiaDto): Promise<BcmBiaData> => {
    const response = await api.patch(API_PATHS.GRC_BCM.BIAS.UPDATE(id), data, withTenantId(tenantId));
    return unwrapResponse<BcmBiaData>(response);
  },

  deleteBia: async (tenantId: string, id: string): Promise<void> => {
    await api.delete(API_PATHS.GRC_BCM.BIAS.DELETE(id), withTenantId(tenantId));
  },

  // Plans
  listPlans: async (tenantId: string, params?: BcmListParams & { serviceId?: string; planType?: BcmPlanType; status?: BcmPlanStatus }) => {
    const response = await api.get(API_PATHS.GRC_BCM.PLANS.LIST, { ...withTenantId(tenantId), params });
    return unwrapPaginatedResponse<BcmPlanData>(response);
  },

  getPlan: async (tenantId: string, id: string): Promise<BcmPlanData> => {
    const response = await api.get(API_PATHS.GRC_BCM.PLANS.GET(id), withTenantId(tenantId));
    return unwrapResponse<BcmPlanData>(response);
  },

  createPlan: async (tenantId: string, data: CreateBcmPlanDto): Promise<BcmPlanData> => {
    const response = await api.post(API_PATHS.GRC_BCM.PLANS.CREATE, data, withTenantId(tenantId));
    return unwrapResponse<BcmPlanData>(response);
  },

  updatePlan: async (tenantId: string, id: string, data: UpdateBcmPlanDto): Promise<BcmPlanData> => {
    const response = await api.patch(API_PATHS.GRC_BCM.PLANS.UPDATE(id), data, withTenantId(tenantId));
    return unwrapResponse<BcmPlanData>(response);
  },

  deletePlan: async (tenantId: string, id: string): Promise<void> => {
    await api.delete(API_PATHS.GRC_BCM.PLANS.DELETE(id), withTenantId(tenantId));
  },

  getPlanSteps: async (tenantId: string, planId: string) => {
    const response = await api.get(API_PATHS.GRC_BCM.PLANS.STEPS(planId), withTenantId(tenantId));
    return unwrapPaginatedResponse<BcmPlanStepData>(response);
  },

  // Plan Steps
  listPlanSteps: async (tenantId: string, params?: BcmListParams & { planId?: string; status?: BcmPlanStepStatus }) => {
    const response = await api.get(API_PATHS.GRC_BCM.PLAN_STEPS.LIST, { ...withTenantId(tenantId), params });
    return unwrapPaginatedResponse<BcmPlanStepData>(response);
  },

  getPlanStep: async (tenantId: string, id: string): Promise<BcmPlanStepData> => {
    const response = await api.get(API_PATHS.GRC_BCM.PLAN_STEPS.GET(id), withTenantId(tenantId));
    return unwrapResponse<BcmPlanStepData>(response);
  },

  createPlanStep: async (tenantId: string, data: CreateBcmPlanStepDto): Promise<BcmPlanStepData> => {
    const response = await api.post(API_PATHS.GRC_BCM.PLAN_STEPS.CREATE, data, withTenantId(tenantId));
    return unwrapResponse<BcmPlanStepData>(response);
  },

  updatePlanStep: async (tenantId: string, id: string, data: UpdateBcmPlanStepDto): Promise<BcmPlanStepData> => {
    const response = await api.patch(API_PATHS.GRC_BCM.PLAN_STEPS.UPDATE(id), data, withTenantId(tenantId));
    return unwrapResponse<BcmPlanStepData>(response);
  },

  deletePlanStep: async (tenantId: string, id: string): Promise<void> => {
    await api.delete(API_PATHS.GRC_BCM.PLAN_STEPS.DELETE(id), withTenantId(tenantId));
  },

  // Exercises
  listExercises: (tenantId: string, params?: BcmListParams & { serviceId?: string; planId?: string; exerciseType?: BcmExerciseType; status?: BcmExerciseStatus; outcome?: BcmExerciseOutcome }) =>
    api.get(API_PATHS.GRC_BCM.EXERCISES.LIST, { ...withTenantId(tenantId), params }),

  getExercise: async (tenantId: string, id: string): Promise<BcmExerciseData> => {
    const response = await api.get(API_PATHS.GRC_BCM.EXERCISES.GET(id), withTenantId(tenantId));
    return unwrapResponse<BcmExerciseData>(response);
  },

  createExercise: async (tenantId: string, data: CreateBcmExerciseDto): Promise<BcmExerciseData> => {
    const response = await api.post(API_PATHS.GRC_BCM.EXERCISES.CREATE, data, withTenantId(tenantId));
    return unwrapResponse<BcmExerciseData>(response);
  },

  updateExercise: async (tenantId: string, id: string, data: UpdateBcmExerciseDto): Promise<BcmExerciseData> => {
    const response = await api.patch(API_PATHS.GRC_BCM.EXERCISES.UPDATE(id), data, withTenantId(tenantId));
    return unwrapResponse<BcmExerciseData>(response);
  },

  deleteExercise: async (tenantId: string, id: string): Promise<void> => {
    await api.delete(API_PATHS.GRC_BCM.EXERCISES.DELETE(id), withTenantId(tenantId));
  },
};

// ============================================================================
// GRC Calendar API
// ============================================================================

export type CalendarEventSourceType = 'AUDIT' | 'CAPA' | 'CAPA_TASK' | 'BCM_EXERCISE' | 'POLICY_REVIEW' | 'EVIDENCE_REVIEW';

export interface CalendarEventData {
  id: string;
  sourceType: CalendarEventSourceType;
  sourceId: string;
  title: string;
  startAt: string;
  endAt: string | null;
  status: string;
  severity: string | null;
  priority: string | null;
  ownerUserId: string | null;
  url: string;
  metadata: Record<string, unknown> | null;
}

export interface CalendarEventsParams {
  start: string;
  end: string;
  types?: CalendarEventSourceType[];
  ownerUserId?: string;
  status?: string;
}

export const calendarApi = {
  getEvents: async (tenantId: string, params: CalendarEventsParams): Promise<CalendarEventData[]> => {
    const queryParams: Record<string, unknown> = {
      start: params.start,
      end: params.end,
    };
    if (params.types && params.types.length > 0) {
      queryParams.types = params.types.join(',');
    }
    if (params.ownerUserId) {
      queryParams.ownerUserId = params.ownerUserId;
    }
    if (params.status) {
      queryParams.status = params.status;
    }
    const response = await api.get(API_PATHS.GRC_CALENDAR.EVENTS, { ...withTenantId(tenantId), params: queryParams });
    return unwrapResponse<CalendarEventData[]>(response);
  },
};

// ============================================================================
// Copilot Types & API
// ============================================================================

export interface CopilotSnIncident {
  sys_id: string;
  number: string;
  short_description: string;
  description: string;
  state: string;
  impact: string;
  urgency: string;
  priority: string;
  category: string;
  assignment_group: string;
  assigned_to: string;
  service_offering: string;
  business_service: string;
  opened_at: string;
  resolved_at: string;
  closed_at: string;
  sys_created_on: string;
  sys_updated_on: string;
}

export interface CopilotActionCard {
  id: string;
  type: 'summary' | 'next_best_steps' | 'customer_update_draft' | 'work_notes_draft';
  title: string;
  content: string;
  confidence: number;
  targetField?: 'work_notes' | 'additional_comments';
  canApply: boolean;
}

export interface CopilotSimilarIncident {
  sysId: string;
  number: string | null;
  shortDescription: string | null;
  state: string | null;
  priority: string | null;
  resolutionNotes: string | null;
  score: number;
}

export interface CopilotKbSuggestion {
  sysId: string;
  number: string | null;
  title: string | null;
  snippet: string | null;
  score: number;
}

export interface CopilotSuggestResponse {
  incidentSysId: string;
  incidentNumber: string;
  actionCards: CopilotActionCard[];
  similarIncidents: CopilotSimilarIncident[];
  kbSuggestions: CopilotKbSuggestion[];
  generatedAt: string;
}

export interface CopilotApplyRequest {
  actionType: string;
  targetField: 'work_notes' | 'additional_comments';
  text: string;
}

export interface CopilotApplyResponse {
  success: boolean;
  incidentSysId: string;
  targetField: string;
  appliedAt: string;
}

export interface CopilotIncidentListParams {
  page?: number;
  pageSize?: number;
  query?: string;
  state?: string;
}

export const copilotApi = {
  listIncidents: async (tenantId: string, params?: CopilotIncidentListParams) => {
    const response = await api.get(API_PATHS.COPILOT.INCIDENTS.LIST, {
      ...withTenantId(tenantId),
      params,
    });
    const data = unwrapResponse<CopilotSnIncident[]>(response);
    return {
      items: ensureArray<CopilotSnIncident>(data),
      total: (response.data as Record<string, unknown>)?.total as number ?? 0,
      page: (response.data as Record<string, unknown>)?.page as number ?? 1,
      pageSize: (response.data as Record<string, unknown>)?.pageSize as number ?? 20,
    };
  },

  getIncident: async (tenantId: string, sysId: string): Promise<CopilotSnIncident> => {
    const response = await api.get(API_PATHS.COPILOT.INCIDENTS.GET(sysId), withTenantId(tenantId));
    return unwrapResponse<CopilotSnIncident>(response);
  },

  suggest: async (tenantId: string, sysId: string, params?: { similarLimit?: number; kbLimit?: number }): Promise<CopilotSuggestResponse> => {
    const response = await api.post(API_PATHS.COPILOT.INCIDENTS.SUGGEST(sysId), params ?? {}, withTenantId(tenantId));
    return unwrapResponse<CopilotSuggestResponse>(response);
  },

  apply: async (tenantId: string, sysId: string, data: CopilotApplyRequest): Promise<CopilotApplyResponse> => {
    const response = await api.post(API_PATHS.COPILOT.INCIDENTS.APPLY(sysId), data, withTenantId(tenantId));
    return unwrapResponse<CopilotApplyResponse>(response);
  },

  recordLearningEvent: async (tenantId: string, data: {
    incidentSysId: string;
    eventType: 'SUGGESTION_SHOWN' | 'SUGGESTION_APPLIED' | 'SUGGESTION_REJECTED';
    actionType: string;
    confidence?: number;
    evidenceIds?: string[];
  }) => {
    const response = await api.post(API_PATHS.COPILOT.LEARNING.EVENTS, data, withTenantId(tenantId));
    return unwrapResponse(response);
  },

  indexIncidents: async (tenantId: string, daysBack?: number) => {
    const response = await api.post(API_PATHS.COPILOT.INDEXING.INCIDENTS, { daysBack }, withTenantId(tenantId));
    return unwrapResponse(response);
  },

  indexKb: async (tenantId: string) => {
    const response = await api.post(API_PATHS.COPILOT.INDEXING.KB, {}, withTenantId(tenantId));
    return unwrapResponse(response);
  },

  getIndexStats: async (tenantId: string) => {
    const response = await api.get(API_PATHS.COPILOT.INDEXING.STATS, withTenantId(tenantId));
    return unwrapResponse<{ incidents: number; kbArticles: number }>(response);
  },
};
