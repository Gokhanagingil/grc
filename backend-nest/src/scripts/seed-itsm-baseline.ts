/**
 * ITSM Baseline Seed Script
 *
 * Seeds workflow definitions, business rules, SLA definitions, UI policies, and UI actions.
 * CI-safe: includes timing instrumentation, explicit exit, and safety timeout.
 *
 * Environment flags:
 *   JOBS_ENABLED=false  - disable background job scheduling (set automatically)
 *   SEED_TIMEOUT_MS     - safety timeout in ms (default: 120000 = 2 min)
 */
process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';

// ---------------------------------------------------------------------------
// CI Safety: timeout guard to prevent indefinite hangs in CI
// ---------------------------------------------------------------------------
const SEED_TIMEOUT_MS = parseInt(process.env.SEED_TIMEOUT_MS || '120000', 10);
const safetyTimer = setTimeout(() => {
  console.error(
    `[SEED-ITSM-BASELINE] FATAL: Safety timeout reached (${SEED_TIMEOUT_MS}ms). Forcing exit.`,
  );
  process.exit(2);
}, SEED_TIMEOUT_MS);
safetyTimer.unref();
import {
  WorkflowDefinition,
  WorkflowState,
  WorkflowTransition,
} from '../itsm/workflow/workflow-definition.entity';
import {
  BusinessRule,
  BusinessRuleTrigger,
  BusinessRuleCondition,
  BusinessRuleAction,
} from '../itsm/business-rule/business-rule.entity';
import {
  SlaDefinition,
  SlaMetric,
  SlaSchedule,
} from '../itsm/sla/sla-definition.entity';
import {
  UiPolicy,
  UiPolicyCondition,
  UiPolicyFieldEffect,
} from '../itsm/ui-policy/ui-policy.entity';
import { UiAction } from '../itsm/ui-policy/ui-action.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

// ---------------------------------------------------------------------------
// 1. WORKFLOW DEFINITIONS
// ---------------------------------------------------------------------------

interface WorkflowSeed {
  name: string;
  description: string;
  tableName: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  order: number;
}

const WORKFLOWS: WorkflowSeed[] = [
  {
    name: 'Incident Lifecycle',
    description:
      'Default ITIL incident workflow: New -> In Progress -> Resolved -> Closed',
    tableName: 'itsm_incidents',
    states: [
      { name: 'NEW', label: 'New', isInitial: true },
      { name: 'IN_PROGRESS', label: 'In Progress' },
      { name: 'RESOLVED', label: 'Resolved' },
      { name: 'CLOSED', label: 'Closed', isFinal: true },
    ],
    transitions: [
      {
        name: 'assign',
        label: 'Assign / Start Work',
        from: 'NEW',
        to: 'IN_PROGRESS',
        requiredRoles: ['admin', 'manager', 'user'],
      },
      {
        name: 'resolve',
        label: 'Resolve',
        from: 'IN_PROGRESS',
        to: 'RESOLVED',
        requiredRoles: ['admin', 'manager', 'user'],
        actions: [{ type: 'set_timestamp', field: 'resolvedAt' }],
      },
      {
        name: 'reopen',
        label: 'Reopen',
        from: 'RESOLVED',
        to: 'IN_PROGRESS',
        requiredRoles: ['admin', 'manager', 'user'],
      },
      {
        name: 'close',
        label: 'Close',
        from: 'RESOLVED',
        to: 'CLOSED',
        requiredRoles: ['admin', 'manager'],
        actions: [{ type: 'set_timestamp', field: 'closedAt' }],
      },
    ],
    order: 10,
  },
  {
    name: 'Change Lifecycle',
    description:
      'Default ITIL change workflow: Draft -> Assess -> Authorize -> Implement -> Review -> Closed',
    tableName: 'itsm_changes',
    states: [
      { name: 'DRAFT', label: 'Draft', isInitial: true },
      { name: 'ASSESS', label: 'Assess' },
      { name: 'AUTHORIZE', label: 'Authorize' },
      { name: 'IMPLEMENT', label: 'Implement' },
      { name: 'REVIEW', label: 'Review' },
      { name: 'CLOSED', label: 'Closed', isFinal: true },
    ],
    transitions: [
      {
        name: 'submit_for_assessment',
        label: 'Submit for Assessment',
        from: 'DRAFT',
        to: 'ASSESS',
        requiredRoles: ['admin', 'manager', 'user'],
      },
      {
        name: 'request_authorization',
        label: 'Request Authorization',
        from: 'ASSESS',
        to: 'AUTHORIZE',
        requiredRoles: ['admin', 'manager'],
      },
      {
        name: 'return_to_draft',
        label: 'Return to Draft',
        from: 'ASSESS',
        to: 'DRAFT',
        requiredRoles: ['admin', 'manager'],
      },
      {
        name: 'authorize',
        label: 'Authorize',
        from: 'AUTHORIZE',
        to: 'IMPLEMENT',
        requiredRoles: ['admin', 'manager'],
        actions: [
          {
            type: 'set_field',
            field: 'approvalStatus',
            value: 'APPROVED',
          },
        ],
      },
      {
        name: 'reject',
        label: 'Reject',
        from: 'AUTHORIZE',
        to: 'DRAFT',
        requiredRoles: ['admin', 'manager'],
        actions: [
          {
            type: 'set_field',
            field: 'approvalStatus',
            value: 'REJECTED',
          },
        ],
      },
      {
        name: 'complete_implementation',
        label: 'Complete Implementation',
        from: 'IMPLEMENT',
        to: 'REVIEW',
        requiredRoles: ['admin', 'manager', 'user'],
        actions: [{ type: 'set_timestamp', field: 'actualEndAt' }],
      },
      {
        name: 'close_change',
        label: 'Close',
        from: 'REVIEW',
        to: 'CLOSED',
        requiredRoles: ['admin', 'manager'],
      },
      {
        name: 'revert_to_implement',
        label: 'Revert to Implement',
        from: 'REVIEW',
        to: 'IMPLEMENT',
        requiredRoles: ['admin', 'manager'],
      },
    ],
    order: 20,
  },
  {
    name: 'Service Lifecycle',
    description:
      'Default service status workflow: Active -> Inactive -> Deprecated',
    tableName: 'itsm_services',
    states: [
      { name: 'ACTIVE', label: 'Active', isInitial: true },
      { name: 'INACTIVE', label: 'Inactive' },
      { name: 'DEPRECATED', label: 'Deprecated', isFinal: true },
    ],
    transitions: [
      {
        name: 'deactivate',
        label: 'Deactivate',
        from: 'ACTIVE',
        to: 'INACTIVE',
        requiredRoles: ['admin', 'manager'],
      },
      {
        name: 'reactivate',
        label: 'Reactivate',
        from: 'INACTIVE',
        to: 'ACTIVE',
        requiredRoles: ['admin', 'manager'],
      },
      {
        name: 'deprecate_from_active',
        label: 'Deprecate',
        from: 'ACTIVE',
        to: 'DEPRECATED',
        requiredRoles: ['admin'],
      },
      {
        name: 'deprecate_from_inactive',
        label: 'Deprecate',
        from: 'INACTIVE',
        to: 'DEPRECATED',
        requiredRoles: ['admin'],
      },
    ],
    order: 30,
  },
];

// ---------------------------------------------------------------------------
// 2. BUSINESS RULES
// ---------------------------------------------------------------------------

interface BusinessRuleSeed {
  name: string;
  description: string;
  tableName: string;
  trigger: BusinessRuleTrigger;
  conditions: BusinessRuleCondition[] | null;
  actions: BusinessRuleAction[];
  order: number;
}

const BUSINESS_RULES: BusinessRuleSeed[] = [
  // --- Incident: Impact/Urgency -> Priority matrix ---
  {
    name: 'INC - Priority: HIGH impact + HIGH urgency = P1',
    description: 'Auto-set priority to P1 when impact=HIGH and urgency=HIGH',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: [
      { field: 'impact', operator: 'eq', value: 'HIGH' },
      { field: 'urgency', operator: 'eq', value: 'HIGH' },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P1' }],
    order: 10,
  },
  {
    name: 'INC - Priority: HIGH impact + MEDIUM urgency = P2',
    description: 'Auto-set priority to P2 when impact=HIGH and urgency=MEDIUM',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: [
      { field: 'impact', operator: 'eq', value: 'HIGH' },
      { field: 'urgency', operator: 'eq', value: 'MEDIUM' },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P2' }],
    order: 20,
  },
  {
    name: 'INC - Priority: MEDIUM impact + HIGH urgency = P2',
    description: 'Auto-set priority to P2 when impact=MEDIUM and urgency=HIGH',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: [
      { field: 'impact', operator: 'eq', value: 'MEDIUM' },
      { field: 'urgency', operator: 'eq', value: 'HIGH' },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P2' }],
    order: 30,
  },
  {
    name: 'INC - Priority: MEDIUM impact + MEDIUM urgency = P3',
    description:
      'Auto-set priority to P3 when impact=MEDIUM and urgency=MEDIUM',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: [
      { field: 'impact', operator: 'eq', value: 'MEDIUM' },
      { field: 'urgency', operator: 'eq', value: 'MEDIUM' },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P3' }],
    order: 40,
  },
  {
    name: 'INC - Priority: HIGH impact + LOW urgency = P3',
    description: 'Auto-set priority to P3 when impact=HIGH and urgency=LOW',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: [
      { field: 'impact', operator: 'eq', value: 'HIGH' },
      { field: 'urgency', operator: 'eq', value: 'LOW' },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P3' }],
    order: 50,
  },
  {
    name: 'INC - Priority: LOW impact + HIGH urgency = P3',
    description: 'Auto-set priority to P3 when impact=LOW and urgency=HIGH',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: [
      { field: 'impact', operator: 'eq', value: 'LOW' },
      { field: 'urgency', operator: 'eq', value: 'HIGH' },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P3' }],
    order: 60,
  },
  {
    name: 'INC - Priority: MEDIUM impact + LOW urgency = P4',
    description: 'Auto-set priority to P4 when impact=MEDIUM and urgency=LOW',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: [
      { field: 'impact', operator: 'eq', value: 'MEDIUM' },
      { field: 'urgency', operator: 'eq', value: 'LOW' },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P4' }],
    order: 70,
  },
  {
    name: 'INC - Priority: LOW impact + MEDIUM urgency = P4',
    description: 'Auto-set priority to P4 when impact=LOW and urgency=MEDIUM',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: [
      { field: 'impact', operator: 'eq', value: 'LOW' },
      { field: 'urgency', operator: 'eq', value: 'MEDIUM' },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P4' }],
    order: 80,
  },
  {
    name: 'INC - Priority: LOW impact + LOW urgency = P5',
    description: 'Auto-set priority to P5 when impact=LOW and urgency=LOW',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: [
      { field: 'impact', operator: 'eq', value: 'LOW' },
      { field: 'urgency', operator: 'eq', value: 'LOW' },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P5' }],
    order: 90,
  },

  // --- Incident: Also run priority matrix on INSERT ---
  {
    name: 'INC - Priority on create: HIGH/HIGH = P1',
    description:
      'Auto-set priority to P1 on create when impact=HIGH and urgency=HIGH',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_INSERT,
    conditions: [
      { field: 'impact', operator: 'eq', value: 'HIGH' },
      { field: 'urgency', operator: 'eq', value: 'HIGH' },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P1' }],
    order: 100,
  },
  {
    name: 'INC - Priority on create: HIGH/MEDIUM or MEDIUM/HIGH = P2',
    description:
      'Auto-set priority to P2 on create for HIGH/MEDIUM combinations',
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_INSERT,
    conditions: [
      { field: 'impact', operator: 'in', value: ['HIGH', 'MEDIUM'] },
      { field: 'urgency', operator: 'in', value: ['HIGH', 'MEDIUM'] },
    ],
    actions: [{ type: 'set_field', field: 'priority', value: 'P2' }],
    order: 110,
  },

  // --- Change: Auto-set approval status ---
  {
    name: 'CHG - Auto-request approval on AUTHORIZE state',
    description:
      'When a change enters AUTHORIZE state, set approvalStatus to REQUESTED',
    tableName: 'itsm_changes',
    trigger: BusinessRuleTrigger.AFTER_UPDATE,
    conditions: [{ field: 'state', operator: 'eq', value: 'AUTHORIZE' }],
    actions: [
      {
        type: 'set_field',
        field: 'approvalStatus',
        value: 'REQUESTED',
      },
    ],
    order: 200,
  },
  {
    name: 'CHG - Emergency: Skip authorization',
    description:
      'Emergency changes skip the authorization step and go directly to implement',
    tableName: 'itsm_changes',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: [
      { field: 'type', operator: 'eq', value: 'EMERGENCY' },
      { field: 'state', operator: 'eq', value: 'ASSESS' },
    ],
    actions: [
      {
        type: 'set_field',
        field: 'approvalStatus',
        value: 'APPROVED',
      },
    ],
    order: 210,
  },
  {
    name: 'CHG - Set actualStartAt on IMPLEMENT',
    description: 'Auto-set actualStartAt when change enters IMPLEMENT state',
    tableName: 'itsm_changes',
    trigger: BusinessRuleTrigger.AFTER_UPDATE,
    conditions: [{ field: 'state', operator: 'eq', value: 'IMPLEMENT' }],
    actions: [{ type: 'set_field', field: 'actualStartAt', value: '__NOW__' }],
    order: 220,
  },
];

// ---------------------------------------------------------------------------
// 3. SLA DEFINITIONS
// ---------------------------------------------------------------------------

interface SlaSeed {
  name: string;
  description: string;
  metric: SlaMetric;
  targetSeconds: number;
  schedule: SlaSchedule;
  priorityFilter: string[] | null;
  stopOnStates: string[];
  pauseOnStates: string[] | null;
  order: number;
}

const SLA_DEFINITIONS: SlaSeed[] = [
  // --- Incident Response SLAs ---
  {
    name: 'INC P1 - Response Time',
    description: 'P1 Critical incidents: respond within 15 minutes (24x7)',
    metric: SlaMetric.RESPONSE_TIME,
    targetSeconds: 900, // 15 min
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    priorityFilter: ['P1'],
    stopOnStates: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 10,
  },
  {
    name: 'INC P2 - Response Time',
    description: 'P2 High incidents: respond within 1 hour (24x7)',
    metric: SlaMetric.RESPONSE_TIME,
    targetSeconds: 3600, // 1 hour
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    priorityFilter: ['P2'],
    stopOnStates: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 20,
  },
  {
    name: 'INC P3 - Response Time',
    description: 'P3 Medium incidents: respond within 4 hours (business hours)',
    metric: SlaMetric.RESPONSE_TIME,
    targetSeconds: 14400, // 4 hours
    schedule: SlaSchedule.BUSINESS_HOURS,
    priorityFilter: ['P3'],
    stopOnStates: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 30,
  },
  {
    name: 'INC P4 - Response Time',
    description: 'P4 Low incidents: respond within 8 hours (business hours)',
    metric: SlaMetric.RESPONSE_TIME,
    targetSeconds: 28800, // 8 hours
    schedule: SlaSchedule.BUSINESS_HOURS,
    priorityFilter: ['P4'],
    stopOnStates: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 40,
  },
  {
    name: 'INC P5 - Response Time',
    description:
      'P5 Planning incidents: respond within 24 hours (business hours)',
    metric: SlaMetric.RESPONSE_TIME,
    targetSeconds: 86400, // 24 hours
    schedule: SlaSchedule.BUSINESS_HOURS,
    priorityFilter: ['P5'],
    stopOnStates: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 50,
  },

  // --- Incident Resolution SLAs ---
  {
    name: 'INC P1 - Resolution Time',
    description: 'P1 Critical incidents: resolve within 4 hours (24x7)',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 14400, // 4 hours
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    priorityFilter: ['P1'],
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 60,
  },
  {
    name: 'INC P2 - Resolution Time',
    description: 'P2 High incidents: resolve within 8 hours (24x7)',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 28800, // 8 hours
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    priorityFilter: ['P2'],
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 70,
  },
  {
    name: 'INC P3 - Resolution Time',
    description:
      'P3 Medium incidents: resolve within 24 hours (business hours)',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 86400, // 24 hours
    schedule: SlaSchedule.BUSINESS_HOURS,
    priorityFilter: ['P3'],
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 80,
  },
  {
    name: 'INC P4 - Resolution Time',
    description: 'P4 Low incidents: resolve within 72 hours (business hours)',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 259200, // 72 hours
    schedule: SlaSchedule.BUSINESS_HOURS,
    priorityFilter: ['P4'],
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 90,
  },
  {
    name: 'INC P5 - Resolution Time',
    description:
      'P5 Planning incidents: resolve within 1 week (business hours)',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 604800, // 7 days
    schedule: SlaSchedule.BUSINESS_HOURS,
    priorityFilter: ['P5'],
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 100,
  },

  // --- Change Implementation SLAs ---
  {
    name: 'CHG Emergency - Implementation Time',
    description: 'Emergency changes: implement within 4 hours (24x7)',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 14400, // 4 hours
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    priorityFilter: null,
    stopOnStates: ['REVIEW', 'CLOSED'],
    pauseOnStates: ['AUTHORIZE'],
    order: 200,
  },
  {
    name: 'CHG Normal - Implementation Time',
    description: 'Normal changes: implement within 5 business days',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 432000, // 5 days
    schedule: SlaSchedule.BUSINESS_HOURS,
    priorityFilter: null,
    stopOnStates: ['REVIEW', 'CLOSED'],
    pauseOnStates: ['AUTHORIZE'],
    order: 210,
  },
];

// ---------------------------------------------------------------------------
// 4. UI POLICIES
// ---------------------------------------------------------------------------

interface UiPolicySeed {
  name: string;
  description: string;
  tableName: string;
  conditions: UiPolicyCondition[] | null;
  fieldEffects: UiPolicyFieldEffect[];
  order: number;
}

const UI_POLICIES: UiPolicySeed[] = [
  // --- Incident UI Policies ---
  {
    name: 'INC - Resolution fields on RESOLVED',
    description:
      'Make resolution notes mandatory and show resolved timestamp when state is RESOLVED',
    tableName: 'itsm_incidents',
    conditions: [{ field: 'state', operator: 'eq', value: 'RESOLVED' }],
    fieldEffects: [
      { field: 'resolutionNotes', visible: true, mandatory: true },
      { field: 'resolvedAt', visible: true, readOnly: true },
    ],
    order: 10,
  },
  {
    name: 'INC - Hide resolution fields on NEW',
    description: 'Hide resolution-related fields when incident is in NEW state',
    tableName: 'itsm_incidents',
    conditions: [{ field: 'state', operator: 'eq', value: 'NEW' }],
    fieldEffects: [
      { field: 'resolutionNotes', visible: false },
      { field: 'resolvedAt', visible: false },
      { field: 'closedAt', visible: false },
    ],
    order: 20,
  },
  {
    name: 'INC - Lock fields on CLOSED',
    description: 'Make all key fields read-only when incident is closed',
    tableName: 'itsm_incidents',
    conditions: [{ field: 'state', operator: 'eq', value: 'CLOSED' }],
    fieldEffects: [
      { field: 'shortDescription', readOnly: true },
      { field: 'description', readOnly: true },
      { field: 'impact', readOnly: true },
      { field: 'urgency', readOnly: true },
      { field: 'priority', readOnly: true },
      { field: 'category', readOnly: true },
      { field: 'assigneeId', readOnly: true },
      { field: 'resolutionNotes', readOnly: true },
    ],
    order: 30,
  },
  {
    name: 'INC - Require assignee on IN_PROGRESS',
    description: 'Make assignee mandatory when incident is in progress',
    tableName: 'itsm_incidents',
    conditions: [{ field: 'state', operator: 'eq', value: 'IN_PROGRESS' }],
    fieldEffects: [{ field: 'assigneeId', mandatory: true }],
    order: 40,
  },

  // --- Change UI Policies ---
  {
    name: 'CHG - Require plans on ASSESS',
    description:
      'Make implementation plan and backout plan mandatory during assessment',
    tableName: 'itsm_changes',
    conditions: [{ field: 'state', operator: 'eq', value: 'ASSESS' }],
    fieldEffects: [
      { field: 'implementationPlan', visible: true, mandatory: true },
      { field: 'backoutPlan', visible: true, mandatory: true },
      { field: 'risk', mandatory: true },
      { field: 'justification', mandatory: true },
    ],
    order: 100,
  },
  {
    name: 'CHG - Show approval on AUTHORIZE',
    description:
      'Show approval status as read-only and require justification during authorization',
    tableName: 'itsm_changes',
    conditions: [{ field: 'state', operator: 'eq', value: 'AUTHORIZE' }],
    fieldEffects: [
      { field: 'approvalStatus', visible: true, readOnly: true },
      { field: 'implementationPlan', readOnly: true },
      { field: 'backoutPlan', readOnly: true },
    ],
    order: 110,
  },
  {
    name: 'CHG - Show dates on IMPLEMENT',
    description:
      'Show and require planned dates during implementation, show actual start',
    tableName: 'itsm_changes',
    conditions: [{ field: 'state', operator: 'eq', value: 'IMPLEMENT' }],
    fieldEffects: [
      { field: 'plannedStartAt', visible: true, mandatory: true },
      { field: 'plannedEndAt', visible: true, mandatory: true },
      { field: 'actualStartAt', visible: true, readOnly: true },
      { field: 'type', readOnly: true },
      { field: 'risk', readOnly: true },
    ],
    order: 120,
  },
  {
    name: 'CHG - Lock fields on CLOSED',
    description: 'Make all fields read-only when change is closed',
    tableName: 'itsm_changes',
    conditions: [{ field: 'state', operator: 'eq', value: 'CLOSED' }],
    fieldEffects: [
      { field: 'title', readOnly: true },
      { field: 'description', readOnly: true },
      { field: 'type', readOnly: true },
      { field: 'risk', readOnly: true },
      { field: 'implementationPlan', readOnly: true },
      { field: 'backoutPlan', readOnly: true },
      { field: 'justification', readOnly: true },
      { field: 'assigneeId', readOnly: true },
    ],
    order: 130,
  },
  {
    name: 'CHG - Hide plans on DRAFT',
    description: 'Hide implementation/backout plans in DRAFT (not needed yet)',
    tableName: 'itsm_changes',
    conditions: [{ field: 'state', operator: 'eq', value: 'DRAFT' }],
    fieldEffects: [
      { field: 'implementationPlan', visible: false },
      { field: 'backoutPlan', visible: false },
      { field: 'actualStartAt', visible: false },
      { field: 'actualEndAt', visible: false },
      { field: 'approvalStatus', visible: false },
    ],
    order: 140,
  },
];

// ---------------------------------------------------------------------------
// 5. UI ACTIONS (buttons on record forms)
// ---------------------------------------------------------------------------

interface UiActionSeed {
  name: string;
  label: string;
  description: string;
  tableName: string;
  workflowTransition: string | null;
  requiredRoles: string[] | null;
  showConditions:
    | { field: string; operator: string; value?: string | string[] }[]
    | null;
  style: string;
  order: number;
}

const UI_ACTIONS: UiActionSeed[] = [
  // --- Incident UI Actions ---
  {
    name: 'inc_assign_start',
    label: 'Assign & Start Work',
    description: 'Move incident from New to In Progress',
    tableName: 'itsm_incidents',
    workflowTransition: 'assign',
    requiredRoles: ['admin', 'manager', 'user'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'NEW' }],
    style: 'primary',
    order: 10,
  },
  {
    name: 'inc_resolve',
    label: 'Resolve',
    description: 'Mark incident as resolved',
    tableName: 'itsm_incidents',
    workflowTransition: 'resolve',
    requiredRoles: ['admin', 'manager', 'user'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'IN_PROGRESS' }],
    style: 'success',
    order: 20,
  },
  {
    name: 'inc_reopen',
    label: 'Reopen',
    description: 'Reopen a resolved incident',
    tableName: 'itsm_incidents',
    workflowTransition: 'reopen',
    requiredRoles: ['admin', 'manager', 'user'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'RESOLVED' }],
    style: 'warning',
    order: 30,
  },
  {
    name: 'inc_close',
    label: 'Close',
    description: 'Close a resolved incident',
    tableName: 'itsm_incidents',
    workflowTransition: 'close',
    requiredRoles: ['admin', 'manager'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'RESOLVED' }],
    style: 'secondary',
    order: 40,
  },

  // --- Change UI Actions ---
  {
    name: 'chg_submit_assessment',
    label: 'Submit for Assessment',
    description: 'Submit draft change for assessment',
    tableName: 'itsm_changes',
    workflowTransition: 'submit_for_assessment',
    requiredRoles: ['admin', 'manager', 'user'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'DRAFT' }],
    style: 'primary',
    order: 100,
  },
  {
    name: 'chg_request_auth',
    label: 'Request Authorization',
    description: 'Send change for authorization approval',
    tableName: 'itsm_changes',
    workflowTransition: 'request_authorization',
    requiredRoles: ['admin', 'manager'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'ASSESS' }],
    style: 'primary',
    order: 110,
  },
  {
    name: 'chg_return_draft',
    label: 'Return to Draft',
    description: 'Return change to draft for rework',
    tableName: 'itsm_changes',
    workflowTransition: 'return_to_draft',
    requiredRoles: ['admin', 'manager'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'ASSESS' }],
    style: 'warning',
    order: 120,
  },
  {
    name: 'chg_approve',
    label: 'Approve',
    description: 'Approve change and move to implementation',
    tableName: 'itsm_changes',
    workflowTransition: 'authorize',
    requiredRoles: ['admin', 'manager'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'AUTHORIZE' }],
    style: 'success',
    order: 130,
  },
  {
    name: 'chg_reject',
    label: 'Reject',
    description: 'Reject change and return to draft',
    tableName: 'itsm_changes',
    workflowTransition: 'reject',
    requiredRoles: ['admin', 'manager'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'AUTHORIZE' }],
    style: 'error',
    order: 140,
  },
  {
    name: 'chg_complete_impl',
    label: 'Complete Implementation',
    description: 'Mark implementation as complete and move to review',
    tableName: 'itsm_changes',
    workflowTransition: 'complete_implementation',
    requiredRoles: ['admin', 'manager', 'user'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'IMPLEMENT' }],
    style: 'primary',
    order: 150,
  },
  {
    name: 'chg_close',
    label: 'Close Change',
    description: 'Close the change after review',
    tableName: 'itsm_changes',
    workflowTransition: 'close_change',
    requiredRoles: ['admin', 'manager'],
    showConditions: [{ field: 'state', operator: 'eq', value: 'REVIEW' }],
    style: 'secondary',
    order: 160,
  },

  // --- Service UI Actions ---
  {
    name: 'svc_deactivate',
    label: 'Deactivate',
    description: 'Deactivate an active service',
    tableName: 'itsm_services',
    workflowTransition: 'deactivate',
    requiredRoles: ['admin', 'manager'],
    showConditions: [{ field: 'status', operator: 'eq', value: 'ACTIVE' }],
    style: 'warning',
    order: 200,
  },
  {
    name: 'svc_reactivate',
    label: 'Reactivate',
    description: 'Reactivate an inactive service',
    tableName: 'itsm_services',
    workflowTransition: 'reactivate',
    requiredRoles: ['admin', 'manager'],
    showConditions: [{ field: 'status', operator: 'eq', value: 'INACTIVE' }],
    style: 'success',
    order: 210,
  },
  {
    name: 'svc_deprecate',
    label: 'Deprecate',
    description: 'Deprecate a service (irreversible)',
    tableName: 'itsm_services',
    workflowTransition: 'deprecate_from_active',
    requiredRoles: ['admin'],
    showConditions: [
      { field: 'status', operator: 'in', value: ['ACTIVE', 'INACTIVE'] },
    ],
    style: 'error',
    order: 220,
  },
];

// ---------------------------------------------------------------------------
// SEED RUNNER
// ---------------------------------------------------------------------------

async function seedItsmBaseline() {
  const scriptStart = Date.now();
  console.log('[SEED-ITSM-BASELINE] === ITSM Baseline Seed ===');
  console.log(`[SEED-ITSM-BASELINE] Start: ${new Date().toISOString()}`);
  console.log('');

  console.log(
    '[SEED-ITSM-BASELINE] Bootstrapping NestJS application context...',
  );
  const bootstrapStart = Date.now();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);
  console.log(
    `[SEED-ITSM-BASELINE] Bootstrap complete (${Date.now() - bootstrapStart}ms)`,
  );

  try {
    // --- Seed Workflows ---
    console.log('--- Seeding Workflow Definitions ---');
    const wfRepo = dataSource.getRepository(WorkflowDefinition);
    let wfCreated = 0;
    let wfSkipped = 0;

    for (const wf of WORKFLOWS) {
      const existing = await wfRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: wf.name },
      });
      if (existing) {
        wfSkipped++;
        continue;
      }
      const entity = wfRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: wf.name,
        description: wf.description,
        tableName: wf.tableName,
        states: wf.states,
        transitions: wf.transitions,
        isActive: true,
        order: wf.order,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await wfRepo.save(entity);
      wfCreated++;
    }
    console.log(`  Workflows: ${wfCreated} created, ${wfSkipped} skipped`);

    // --- Seed Business Rules ---
    console.log('--- Seeding Business Rules ---');
    const brRepo = dataSource.getRepository(BusinessRule);
    let brCreated = 0;
    let brSkipped = 0;

    for (const br of BUSINESS_RULES) {
      const existing = await brRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: br.name },
      });
      if (existing) {
        brSkipped++;
        continue;
      }
      const entity = brRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: br.name,
        description: br.description,
        tableName: br.tableName,
        trigger: br.trigger,
        conditions: br.conditions,
        actions: br.actions,
        isActive: true,
        order: br.order,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await brRepo.save(entity);
      brCreated++;
    }
    console.log(`  Business Rules: ${brCreated} created, ${brSkipped} skipped`);

    // --- Seed SLA Definitions ---
    console.log('--- Seeding SLA Definitions ---');
    const slaRepo = dataSource.getRepository(SlaDefinition);
    let slaCreated = 0;
    let slaSkipped = 0;

    for (const sla of SLA_DEFINITIONS) {
      const existing = await slaRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: sla.name },
      });
      if (existing) {
        slaSkipped++;
        continue;
      }
      const entity = slaRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: sla.name,
        description: sla.description,
        metric: sla.metric,
        targetSeconds: sla.targetSeconds,
        schedule: sla.schedule,
        priorityFilter: sla.priorityFilter,
        stopOnStates: sla.stopOnStates,
        pauseOnStates: sla.pauseOnStates,
        isActive: true,
        order: sla.order,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await slaRepo.save(entity);
      slaCreated++;
    }
    console.log(
      `  SLA Definitions: ${slaCreated} created, ${slaSkipped} skipped`,
    );

    // --- Seed UI Policies ---
    console.log('--- Seeding UI Policies ---');
    const upRepo = dataSource.getRepository(UiPolicy);
    let upCreated = 0;
    let upSkipped = 0;

    for (const up of UI_POLICIES) {
      const existing = await upRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: up.name },
      });
      if (existing) {
        upSkipped++;
        continue;
      }
      const entity = upRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: up.name,
        description: up.description,
        tableName: up.tableName,
        conditions: up.conditions,
        fieldEffects: up.fieldEffects,
        isActive: true,
        order: up.order,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await upRepo.save(entity);
      upCreated++;
    }
    console.log(`  UI Policies: ${upCreated} created, ${upSkipped} skipped`);

    // --- Seed UI Actions ---
    console.log('--- Seeding UI Actions ---');
    const uaRepo = dataSource.getRepository(UiAction);
    let uaCreated = 0;
    let uaSkipped = 0;

    for (const ua of UI_ACTIONS) {
      const existing = await uaRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: ua.name },
      });
      if (existing) {
        uaSkipped++;
        continue;
      }
      const entity = uaRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: ua.name,
        label: ua.label,
        description: ua.description,
        tableName: ua.tableName,
        workflowTransition: ua.workflowTransition,
        requiredRoles: ua.requiredRoles,
        showConditions: ua.showConditions,
        style: ua.style,
        order: ua.order,
        isActive: true,
        isDeleted: false,
        createdBy: DEMO_ADMIN_ID,
      });
      await uaRepo.save(entity);
      uaCreated++;
    }
    console.log(`  UI Actions: ${uaCreated} created, ${uaSkipped} skipped`);

    // --- Summary ---
    const totalCreated =
      wfCreated + brCreated + slaCreated + upCreated + uaCreated;
    const totalSkipped =
      wfSkipped + brSkipped + slaSkipped + upSkipped + uaSkipped;
    const durationMs = Date.now() - scriptStart;
    console.log('');
    console.log(
      `[SEED-ITSM-BASELINE] === Seed complete: ${totalCreated} created, ${totalSkipped} skipped ===`,
    );
    console.log(
      `[SEED-ITSM-BASELINE] Duration: ${durationMs}ms (${(durationMs / 1000).toFixed(1)}s)`,
    );
    console.log(`[SEED-ITSM-BASELINE] End: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('[SEED-ITSM-BASELINE] Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
    clearTimeout(safetyTimer);
  }
}

seedItsmBaseline()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error('[SEED-ITSM-BASELINE] Unhandled error:', error);
    process.exit(1);
  });
