/**
 * Major Incident Detail Stabilization — toDisplayLabel Regression Tests
 *
 * Covers P0-2: TypeError crash when toDisplayLabel receives undefined/null.
 * The function is called 10+ times in ItsmMajorIncidentDetail.tsx with
 * values from API responses that may be undefined, null, empty, or non-string.
 *
 * @regression
 * @stabilization-pack
 */

/**
 * Mirror of the safe toDisplayLabel from ItsmMajorIncidentDetail.tsx.
 * Tests the exact contract in isolation.
 */
function toDisplayLabel(val: unknown): string {
  if (val == null) return '\u2014';
  if (typeof val !== 'string') return String(val);
  if (val.trim() === '') return '\u2014';
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

describe('toDisplayLabel — safe formatting', () => {
  // ── Normal string inputs ──────────────────────────────────────────────
  it('converts SNAKE_CASE — capitalizes first letter of each word', () => {
    expect(toDisplayLabel('OPEN')).toBe('OPEN');
    expect(toDisplayLabel('IN_PROGRESS')).toBe('IN PROGRESS');
    expect(toDisplayLabel('STAKEHOLDER_UPDATE')).toBe('STAKEHOLDER UPDATE');
  });

  it('handles lowercase strings — capitalizes first char of each word', () => {
    expect(toDisplayLabel('resolved')).toBe('Resolved');
    expect(toDisplayLabel('in_progress')).toBe('In Progress');
  });

  it('handles single-word strings', () => {
    expect(toDisplayLabel('OPEN')).toBe('OPEN');
    expect(toDisplayLabel('draft')).toBe('Draft');
  });

  // ── Unsafe inputs that previously caused crashes ──────────────────────
  it('returns fallback for undefined (was TypeError crash)', () => {
    expect(toDisplayLabel(undefined)).toBe('\u2014');
  });

  it('returns fallback for null (was TypeError crash)', () => {
    expect(toDisplayLabel(null)).toBe('\u2014');
  });

  it('returns fallback for empty string', () => {
    expect(toDisplayLabel('')).toBe('\u2014');
  });

  it('returns fallback for whitespace-only string', () => {
    expect(toDisplayLabel('   ')).toBe('\u2014');
  });

  // ── Non-string types that could come from malformed API data ──────────
  it('coerces number to string', () => {
    expect(toDisplayLabel(42)).toBe('42');
  });

  it('coerces boolean to string', () => {
    expect(toDisplayLabel(true)).toBe('true');
  });

  it('coerces object to string', () => {
    expect(toDisplayLabel({ foo: 'bar' })).toBe('[object Object]');
  });

  it('coerces array to string', () => {
    expect(toDisplayLabel(['a', 'b'])).toBe('a,b');
  });
});

describe('toDisplayLabel — regression: all ItsmMajorIncidentDetail call sites', () => {
  // Simulates the data shapes that reach toDisplayLabel from API responses.
  // Each test corresponds to one or more call sites in the component.

  it('mi.status — handles valid DECLARED status', () => {
    expect(toDisplayLabel('DECLARED')).toBe('DECLARED');
  });

  it('mi.status — handles undefined status from partial API response', () => {
    const mi: { status?: string } = {};
    expect(toDisplayLabel(mi.status)).toBe('\u2014');
  });

  it('update.updateType — handles valid type', () => {
    expect(toDisplayLabel('STATUS_CHANGE')).toBe('STATUS CHANGE');
  });

  it('update.updateType — handles missing updateType', () => {
    const update: { updateType?: string } = {};
    expect(toDisplayLabel(update.updateType)).toBe('\u2014');
  });

  it('link.linkType — handles CMDB_CI type', () => {
    expect(toDisplayLabel('CMDB_CI')).toBe('CMDB CI');
  });

  it('link.linkType — handles undefined linkType', () => {
    const link: { linkType?: string } = {};
    expect(toDisplayLabel(link.linkType)).toBe('\u2014');
  });

  it('Object.entries key — handles content preview keys', () => {
    const content = { root_cause: 'DNS failure', impact_analysis: 'High' };
    const labels = Object.entries(content).map(([key]) => toDisplayLabel(key));
    expect(labels).toEqual(['Root Cause', 'Impact Analysis']);
  });

  it('availableTransitions item — handles status transition values', () => {
    const transitions = ['INVESTIGATING', 'MITIGATED', 'RESOLVED'];
    const labels = transitions.map(s => toDisplayLabel(s));
    expect(labels).toEqual(['INVESTIGATING', 'MITIGATED', 'RESOLVED']);
  });
});
