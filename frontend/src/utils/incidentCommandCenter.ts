/**
 * Incident Command Center — Derivation Utilities
 *
 * Pure, deterministic functions for deriving:
 * - Operational summary metrics
 * - Health indicator badges
 * - Next Best Action recommendations
 *
 * No API calls — all derivation is done from data already fetched by the parent page.
 * This keeps the Command Center lightning-fast and testable.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface IncidentSummaryInput {
  id?: string;
  number?: string;
  shortDescription?: string;
  description?: string;
  state?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  category?: string;
  serviceId?: string;
  assignmentGroup?: string;
  assignedTo?: string;
  assignee?: { id: string; firstName: string; lastName: string } | null;
  service?: { id: string; name: string } | null;
  riskReviewRequired?: boolean;
  openedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SlaInstanceInput {
  id: string;
  state?: string;
  breached?: boolean;
  paused?: boolean;
  remainingMs?: number;
  definition?: { name?: string; targetType?: string } | null;
}

export interface LinkedItemInput {
  id: string;
  code?: string;
  name?: string;
  status?: string;
}

// ── Health Indicators ───────────────────────────────────────────────────

export type HealthLevel = 'good' | 'warning' | 'critical' | 'unknown';

export interface HealthIndicator {
  key: string;
  label: string;
  level: HealthLevel;
  detail: string;
}

/**
 * Compute Data Completeness health indicator.
 * Checks key fields: shortDescription, state, impact, urgency, category, serviceId, assignmentGroup.
 */
export function computeDataCompleteness(incident: IncidentSummaryInput): HealthIndicator {
  const fields = [
    { name: 'Short Description', filled: !!incident.shortDescription?.trim() },
    { name: 'State', filled: !!incident.state },
    { name: 'Impact', filled: !!incident.impact },
    { name: 'Urgency', filled: !!incident.urgency },
    { name: 'Category', filled: !!incident.category },
    { name: 'Service', filled: !!incident.serviceId },
    { name: 'Assignment Group', filled: !!incident.assignmentGroup || !!incident.assignee },
  ];

  const filledCount = fields.filter((f) => f.filled).length;
  const total = fields.length;
  const pct = Math.round((filledCount / total) * 100);
  const missing = fields.filter((f) => !f.filled).map((f) => f.name);

  let level: HealthLevel = 'good';
  if (pct < 50) level = 'critical';
  else if (pct < 80) level = 'warning';

  return {
    key: 'data_completeness',
    label: 'Data Completeness',
    level,
    detail: pct === 100
      ? 'All key fields populated'
      : `${pct}% complete — missing: ${missing.join(', ')}`,
  };
}

/**
 * Compute Risk Coverage health indicator.
 */
export function computeRiskCoverage(
  linkedRisks: LinkedItemInput[],
  linkedControls: LinkedItemInput[],
): HealthIndicator {
  const hasRisks = linkedRisks.length > 0;
  const hasControls = linkedControls.length > 0;

  let level: HealthLevel = 'good';
  let detail = `${linkedRisks.length} risk(s), ${linkedControls.length} control(s) linked`;

  if (!hasRisks && !hasControls) {
    level = 'critical';
    detail = 'No risks or controls linked';
  } else if (!hasRisks || !hasControls) {
    level = 'warning';
    detail = !hasRisks
      ? `No risks linked (${linkedControls.length} control(s))`
      : `No controls linked (${linkedRisks.length} risk(s))`;
  }

  return {
    key: 'risk_coverage',
    label: 'Risk Coverage',
    level,
    detail,
  };
}

/**
 * Compute SLA Coverage health indicator.
 */
export function computeSlaCoverage(slaInstances: SlaInstanceInput[]): HealthIndicator {
  if (slaInstances.length === 0) {
    return {
      key: 'sla_coverage',
      label: 'SLA Coverage',
      level: 'warning',
      detail: 'No SLA records attached',
    };
  }

  const breachedCount = slaInstances.filter((s) => s.breached).length;
  if (breachedCount > 0) {
    return {
      key: 'sla_coverage',
      label: 'SLA Coverage',
      level: 'critical',
      detail: `${breachedCount} of ${slaInstances.length} SLA(s) breached`,
    };
  }

  return {
    key: 'sla_coverage',
    label: 'SLA Coverage',
    level: 'good',
    detail: `${slaInstances.length} SLA(s) active, none breached`,
  };
}

/**
 * Compute CI Context health indicator.
 */
export function computeCiContext(affectedCiCount: number): HealthIndicator {
  if (affectedCiCount === 0) {
    return {
      key: 'ci_context',
      label: 'CI Context',
      level: 'unknown',
      detail: 'No affected CIs linked',
    };
  }

  return {
    key: 'ci_context',
    label: 'CI Context',
    level: 'good',
    detail: `${affectedCiCount} affected CI(s) linked`,
  };
}

/**
 * Compute all health indicators for the incident.
 */
export function computeAllHealthIndicators(
  incident: IncidentSummaryInput,
  linkedRisks: LinkedItemInput[],
  linkedControls: LinkedItemInput[],
  slaInstances: SlaInstanceInput[],
  affectedCiCount: number,
): HealthIndicator[] {
  return [
    computeDataCompleteness(incident),
    computeRiskCoverage(linkedRisks, linkedControls),
    computeSlaCoverage(slaInstances),
    computeCiContext(affectedCiCount),
  ];
}

// ── Next Best Actions ───────────────────────────────────────────────────

export type ActionSeverity = 'high' | 'medium' | 'low' | 'info';

export interface NextBestAction {
  id: string;
  severity: ActionSeverity;
  title: string;
  description: string;
  category: string;
}

/**
 * Deterministic rule engine for generating Next Best Action recommendations.
 * Rules are evaluated in priority order. All rules are pure frontend derivation.
 */
export function computeNextBestActions(
  incident: IncidentSummaryInput,
  linkedRisks: LinkedItemInput[],
  linkedControls: LinkedItemInput[],
  slaInstances: SlaInstanceInput[],
  affectedCiCount: number,
): NextBestAction[] {
  const actions: NextBestAction[] = [];
  const priority = (incident.priority || 'p3').toLowerCase();
  const isHighPriority = priority === 'p1' || priority === 'p2';

  // Rule 1: High priority but no affected CIs
  if (isHighPriority && affectedCiCount === 0) {
    actions.push({
      id: 'add_affected_ci',
      severity: 'high',
      title: 'Add Affected Configuration Items',
      description: 'This is a high-priority incident with no affected CIs linked. Identifying impacted infrastructure helps assess blast radius.',
      category: 'Impact Assessment',
    });
  }

  // Rule 2: High priority but no linked risks
  if (isHighPriority && linkedRisks.length === 0) {
    actions.push({
      id: 'link_risk',
      severity: 'high',
      title: 'Link Related Risks',
      description: 'High-priority incidents should be associated with risk records for proper risk management and reporting.',
      category: 'Risk Management',
    });
  }

  // Rule 3: No SLA records
  if (slaInstances.length === 0) {
    actions.push({
      id: 'check_sla',
      severity: 'medium',
      title: 'Verify SLA Policy Matching',
      description: 'No SLA records found. Check if an SLA policy should apply to this incident based on its priority and service.',
      category: 'SLA Management',
    });
  }

  // Rule 4: SLA breached
  const breachedSlas = slaInstances.filter((s) => s.breached);
  if (breachedSlas.length > 0) {
    actions.push({
      id: 'sla_breached',
      severity: 'high',
      title: 'SLA Breach Detected',
      description: `${breachedSlas.length} SLA(s) have been breached. Escalate immediately and document resolution timeline.`,
      category: 'SLA Management',
    });
  }

  // Rule 5: No assignment group
  if (!incident.assignmentGroup && !incident.assignee && !incident.assignedTo) {
    actions.push({
      id: 'assign_group',
      severity: 'medium',
      title: 'Assign to a Group or Individual',
      description: 'This incident has no assignment group or assignee. Route it to the appropriate team for faster resolution.',
      category: 'Workflow',
    });
  }

  // Rule 6: No service binding
  if (!incident.serviceId) {
    actions.push({
      id: 'bind_service',
      severity: 'low',
      title: 'Bind to a CMDB Service',
      description: 'Linking this incident to a CMDB service improves impact analysis and SLA matching.',
      category: 'Service Management',
    });
  }

  // Rule 7: No category
  if (!incident.category) {
    actions.push({
      id: 'set_category',
      severity: 'low',
      title: 'Set Incident Category',
      description: 'Categorizing the incident improves reporting and helps route to the right team.',
      category: 'Classification',
    });
  }

  // Rule 8: No linked controls (when risks exist)
  if (linkedRisks.length > 0 && linkedControls.length === 0) {
    actions.push({
      id: 'link_control',
      severity: 'medium',
      title: 'Link Mitigating Controls',
      description: 'Risks are linked but no controls. Identify and link relevant controls to demonstrate risk mitigation.',
      category: 'Risk Management',
    });
  }

  // Rule 9: Major incident consideration (P1 + no resolution)
  if (priority === 'p1' && !incident.resolvedAt && incident.state !== 'resolved' && incident.state !== 'closed') {
    actions.push({
      id: 'major_incident_review',
      severity: 'info',
      title: 'Consider Major Incident Designation',
      description: 'This P1 incident is unresolved. Evaluate whether it meets Major Incident criteria for escalated response.',
      category: 'Escalation',
    });
  }

  // Rule 10: Description missing
  if (!incident.description?.trim()) {
    actions.push({
      id: 'add_description',
      severity: 'low',
      title: 'Add Detailed Description',
      description: 'A detailed description helps responders understand the incident context and speeds up resolution.',
      category: 'Documentation',
    });
  }

  return actions;
}

// ── Summary Derivation ──────────────────────────────────────────────────

export interface OperationalSummary {
  number: string;
  title: string;
  state: string;
  priority: string;
  impact: string;
  urgency: string;
  slaCount: number;
  slaCriticalCount: number;
  slaBreachedCount: number;
  linkedRiskCount: number;
  linkedControlCount: number;
  affectedCiCount: number;
  lastUpdated: string | null;
  serviceName: string | null;
}

/**
 * Derive operational summary from raw incident data + related entities.
 */
export function deriveOperationalSummary(
  incident: IncidentSummaryInput,
  linkedRisks: LinkedItemInput[],
  linkedControls: LinkedItemInput[],
  slaInstances: SlaInstanceInput[],
  affectedCiCount: number,
): OperationalSummary {
  return {
    number: incident.number || 'NEW',
    title: incident.shortDescription || 'Untitled Incident',
    state: incident.state || 'open',
    priority: incident.priority || 'p3',
    impact: incident.impact || 'medium',
    urgency: incident.urgency || 'medium',
    slaCount: slaInstances.length,
    slaCriticalCount: slaInstances.filter((s) => s.breached || (s.remainingMs != null && s.remainingMs < 3600000)).length,
    slaBreachedCount: slaInstances.filter((s) => s.breached).length,
    linkedRiskCount: linkedRisks.length,
    linkedControlCount: linkedControls.length,
    affectedCiCount,
    lastUpdated: incident.updatedAt || null,
    serviceName: incident.service?.name || null,
  };
}
