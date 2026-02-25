/**
 * Unit tests for Incident Command Center derivation utilities.
 *
 * Tests cover:
 * - Health indicator computation (data completeness, risk coverage, SLA, CI context)
 * - Next Best Actions rule engine
 * - Operational summary derivation
 */
import {
  computeDataCompleteness,
  computeRiskCoverage,
  computeSlaCoverage,
  computeCiContext,
  computeAllHealthIndicators,
  computeNextBestActions,
  deriveOperationalSummary,
  IncidentSummaryInput,
  SlaInstanceInput,
  LinkedItemInput,
} from '../incidentCommandCenter';

// ── Fixtures ────────────────────────────────────────────────────────────

const fullIncident: IncidentSummaryInput = {
  id: 'inc-1',
  number: 'INC0001',
  shortDescription: 'Server down',
  description: 'The main DB server is unresponsive.',
  state: 'open',
  priority: 'p1',
  impact: 'high',
  urgency: 'high',
  category: 'hardware',
  serviceId: 'svc-1',
  assignmentGroup: 'infra-team',
  assignee: { id: 'u1', firstName: 'Alice', lastName: 'Smith' },
  service: { id: 'svc-1', name: 'Core DB' },
  riskReviewRequired: false,
  openedAt: '2026-02-20T10:00:00Z',
  createdAt: '2026-02-20T10:00:00Z',
  updatedAt: '2026-02-20T12:00:00Z',
};

const emptyIncident: IncidentSummaryInput = {
  id: 'inc-2',
  number: 'INC0002',
  shortDescription: 'Something',
  state: 'open',
  priority: 'p3',
};

const risks: LinkedItemInput[] = [
  { id: 'r1', code: 'RSK-001', name: 'Data loss', status: 'active' },
];

const controls: LinkedItemInput[] = [
  { id: 'c1', code: 'CTL-001', name: 'Backup policy', status: 'active' },
];

const slaActive: SlaInstanceInput[] = [
  { id: 'sla-1', state: 'in_progress', breached: false, remainingMs: 7200000 },
];

const slaBreached: SlaInstanceInput[] = [
  { id: 'sla-1', state: 'in_progress', breached: true, remainingMs: 0 },
  { id: 'sla-2', state: 'in_progress', breached: false, remainingMs: 3600000 },
];

// ── Health Indicators ───────────────────────────────────────────────────

describe('computeDataCompleteness', () => {
  it('returns good for fully populated incident', () => {
    const result = computeDataCompleteness(fullIncident);
    expect(result.key).toBe('data_completeness');
    expect(result.level).toBe('good');
    expect(result.detail).toContain('All key fields');
  });

  it('returns critical for sparse incident', () => {
    const result = computeDataCompleteness({ id: 'x' });
    expect(result.level).toBe('critical');
    expect(result.detail).toContain('missing');
  });

  it('returns warning for partially filled incident', () => {
    const result = computeDataCompleteness({
      shortDescription: 'test',
      state: 'open',
      impact: 'high',
      urgency: 'high',
    });
    // 4 of 7 = 57% → warning
    expect(result.level).toBe('warning');
  });
});

describe('computeRiskCoverage', () => {
  it('returns good when both risks and controls are linked', () => {
    const result = computeRiskCoverage(risks, controls);
    expect(result.level).toBe('good');
  });

  it('returns critical when no risks or controls', () => {
    const result = computeRiskCoverage([], []);
    expect(result.level).toBe('critical');
  });

  it('returns warning when only risks linked', () => {
    const result = computeRiskCoverage(risks, []);
    expect(result.level).toBe('warning');
    expect(result.detail).toContain('No controls');
  });

  it('returns warning when only controls linked', () => {
    const result = computeRiskCoverage([], controls);
    expect(result.level).toBe('warning');
    expect(result.detail).toContain('No risks');
  });
});

describe('computeSlaCoverage', () => {
  it('returns warning when no SLAs attached', () => {
    const result = computeSlaCoverage([]);
    expect(result.level).toBe('warning');
  });

  it('returns good when SLAs active and none breached', () => {
    const result = computeSlaCoverage(slaActive);
    expect(result.level).toBe('good');
    expect(result.detail).toContain('none breached');
  });

  it('returns critical when SLAs breached', () => {
    const result = computeSlaCoverage(slaBreached);
    expect(result.level).toBe('critical');
    expect(result.detail).toContain('breached');
  });
});

describe('computeCiContext', () => {
  it('returns unknown when no CIs', () => {
    const result = computeCiContext(0);
    expect(result.level).toBe('unknown');
  });

  it('returns good when CIs linked', () => {
    const result = computeCiContext(5);
    expect(result.level).toBe('good');
    expect(result.detail).toContain('5');
  });
});

describe('computeAllHealthIndicators', () => {
  it('returns all 4 indicators', () => {
    const indicators = computeAllHealthIndicators(fullIncident, risks, controls, slaActive, 3);
    expect(indicators).toHaveLength(4);
    const keys = indicators.map((i) => i.key);
    expect(keys).toContain('data_completeness');
    expect(keys).toContain('risk_coverage');
    expect(keys).toContain('sla_coverage');
    expect(keys).toContain('ci_context');
  });
});

// ── Next Best Actions ───────────────────────────────────────────────────

describe('computeNextBestActions', () => {
  it('returns no actions for a fully equipped resolved incident', () => {
    const resolvedFull: IncidentSummaryInput = {
      ...fullIncident,
      description: 'Detailed description',
      state: 'resolved',
      resolvedAt: '2026-02-20T14:00:00Z',
    };
    const actions = computeNextBestActions(
      resolvedFull,
      risks,
      controls,
      slaActive,
      5,
    );
    expect(actions).toHaveLength(0);
  });

  it('recommends adding CIs for high priority with no CIs', () => {
    const actions = computeNextBestActions(fullIncident, risks, controls, slaActive, 0);
    expect(actions.some((a) => a.id === 'add_affected_ci')).toBe(true);
  });

  it('recommends linking risks for high priority with no risks', () => {
    const actions = computeNextBestActions(fullIncident, [], controls, slaActive, 5);
    expect(actions.some((a) => a.id === 'link_risk')).toBe(true);
  });

  it('recommends SLA check when no SLAs', () => {
    const actions = computeNextBestActions(emptyIncident, risks, controls, [], 5);
    expect(actions.some((a) => a.id === 'check_sla')).toBe(true);
  });

  it('warns about SLA breach', () => {
    const actions = computeNextBestActions(emptyIncident, risks, controls, slaBreached, 5);
    expect(actions.some((a) => a.id === 'sla_breached')).toBe(true);
  });

  it('recommends assignment when no assignee', () => {
    const actions = computeNextBestActions(emptyIncident, risks, controls, slaActive, 5);
    expect(actions.some((a) => a.id === 'assign_group')).toBe(true);
  });

  it('recommends service binding when no service', () => {
    const actions = computeNextBestActions(emptyIncident, risks, controls, slaActive, 5);
    expect(actions.some((a) => a.id === 'bind_service')).toBe(true);
  });

  it('recommends setting category when none', () => {
    const actions = computeNextBestActions(emptyIncident, risks, controls, slaActive, 5);
    expect(actions.some((a) => a.id === 'set_category')).toBe(true);
  });

  it('recommends linking controls when risks exist but no controls', () => {
    const actions = computeNextBestActions(emptyIncident, risks, [], slaActive, 5);
    expect(actions.some((a) => a.id === 'link_control')).toBe(true);
  });

  it('suggests major incident review for P1 unresolved', () => {
    const p1Incident = { ...fullIncident, priority: 'p1', state: 'open', resolvedAt: undefined };
    const actions = computeNextBestActions(p1Incident, risks, controls, slaActive, 5);
    expect(actions.some((a) => a.id === 'major_incident_review')).toBe(true);
  });

  it('does not suggest major incident review for resolved P1', () => {
    const resolved = { ...fullIncident, priority: 'p1', state: 'resolved', resolvedAt: '2026-02-20T14:00:00Z' };
    const actions = computeNextBestActions(resolved, risks, controls, slaActive, 5);
    expect(actions.some((a) => a.id === 'major_incident_review')).toBe(false);
  });
});

// ── Operational Summary ─────────────────────────────────────────────────

describe('deriveOperationalSummary', () => {
  it('derives correct counts from input', () => {
    const summary = deriveOperationalSummary(fullIncident, risks, controls, slaActive, 3);
    expect(summary.number).toBe('INC0001');
    expect(summary.title).toBe('Server down');
    expect(summary.priority).toBe('p1');
    expect(summary.impact).toBe('high');
    expect(summary.urgency).toBe('high');
    expect(summary.slaCount).toBe(1);
    expect(summary.slaBreachedCount).toBe(0);
    expect(summary.linkedRiskCount).toBe(1);
    expect(summary.linkedControlCount).toBe(1);
    expect(summary.affectedCiCount).toBe(3);
    expect(summary.serviceName).toBe('Core DB');
  });

  it('handles missing / sparse data gracefully', () => {
    const summary = deriveOperationalSummary({}, [], [], [], 0);
    expect(summary.number).toBe('NEW');
    expect(summary.title).toBe('Untitled Incident');
    expect(summary.priority).toBe('p3');
    expect(summary.slaCount).toBe(0);
    expect(summary.serviceName).toBeNull();
  });

  it('counts breached SLAs correctly', () => {
    const summary = deriveOperationalSummary(emptyIncident, [], [], slaBreached, 0);
    expect(summary.slaBreachedCount).toBe(1);
    expect(summary.slaCount).toBe(2);
  });

  it('computes slaCriticalCount for near-breach SLAs', () => {
    const nearBreach: SlaInstanceInput[] = [
      { id: 'sla-x', breached: false, remainingMs: 1800000 }, // 30 min remaining < 1hr threshold
    ];
    const summary = deriveOperationalSummary(emptyIncident, [], [], nearBreach, 0);
    expect(summary.slaCriticalCount).toBe(1);
  });
});
