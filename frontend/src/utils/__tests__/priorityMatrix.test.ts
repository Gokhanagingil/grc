import {
  calculatePriorityFromMatrix,
  buildMatrixLookup,
  getPriorityLabel,
  getPriorityColor,
  PriorityMatrixEntry,
} from '../priorityMatrix';

/* ================================================================== */
/* calculatePriorityFromMatrix — default ITIL matrix                   */
/* ================================================================== */
describe('calculatePriorityFromMatrix (default matrix)', () => {
  it('should return P1 for high impact + high urgency', () => {
    expect(calculatePriorityFromMatrix('high', 'high')).toBe('p1');
  });

  it('should return P2 for high impact + medium urgency', () => {
    expect(calculatePriorityFromMatrix('high', 'medium')).toBe('p2');
  });

  it('should return P3 for high impact + low urgency', () => {
    expect(calculatePriorityFromMatrix('high', 'low')).toBe('p3');
  });

  it('should return P2 for medium impact + high urgency', () => {
    expect(calculatePriorityFromMatrix('medium', 'high')).toBe('p2');
  });

  it('should return P3 for medium impact + medium urgency', () => {
    expect(calculatePriorityFromMatrix('medium', 'medium')).toBe('p3');
  });

  it('should return P4 for medium impact + low urgency', () => {
    expect(calculatePriorityFromMatrix('medium', 'low')).toBe('p4');
  });

  it('should return P3 for low impact + high urgency', () => {
    expect(calculatePriorityFromMatrix('low', 'high')).toBe('p3');
  });

  it('should return P4 for low impact + medium urgency', () => {
    expect(calculatePriorityFromMatrix('low', 'medium')).toBe('p4');
  });

  it('should return P4 for low impact + low urgency', () => {
    expect(calculatePriorityFromMatrix('low', 'low')).toBe('p4');
  });

  it('should handle case-insensitive input', () => {
    expect(calculatePriorityFromMatrix('HIGH', 'LOW')).toBe('p3');
    expect(calculatePriorityFromMatrix('Medium', 'High')).toBe('p2');
  });

  it('should default to p3 for undefined inputs', () => {
    expect(calculatePriorityFromMatrix(undefined, undefined)).toBe('p3');
  });

  it('should default to p3 for unknown impact values', () => {
    expect(calculatePriorityFromMatrix('critical', 'high')).toBe('p3');
  });

  it('should default to p3 for unknown urgency values', () => {
    expect(calculatePriorityFromMatrix('high', 'critical')).toBe('p3');
  });

  it('should default to p3 for empty strings', () => {
    expect(calculatePriorityFromMatrix('', '')).toBe('p3');
  });
});

/* ================================================================== */
/* calculatePriorityFromMatrix — tenant-specific matrix override       */
/* ================================================================== */
describe('calculatePriorityFromMatrix (matrix override)', () => {
  const customMatrix: Record<string, Record<string, string>> = {
    high: { high: 'p1', medium: 'p1', low: 'p2' },
    medium: { high: 'p1', medium: 'p2', low: 'p3' },
    low: { high: 'p2', medium: 'p3', low: 'p5' },
  };

  it('uses custom matrix when provided', () => {
    expect(calculatePriorityFromMatrix('high', 'medium', customMatrix)).toBe('p1');
    expect(calculatePriorityFromMatrix('low', 'low', customMatrix)).toBe('p5');
  });

  it('falls back to default matrix when override is null', () => {
    expect(calculatePriorityFromMatrix('high', 'high', null)).toBe('p1');
    expect(calculatePriorityFromMatrix('low', 'low', null)).toBe('p4');
  });

  it('falls back to default matrix when override is undefined', () => {
    expect(calculatePriorityFromMatrix('high', 'high', undefined)).toBe('p1');
  });

  it('returns p3 for unknown impact in custom matrix', () => {
    expect(calculatePriorityFromMatrix('critical', 'high', customMatrix)).toBe('p3');
  });

  it('returns p3 for unknown urgency in custom matrix', () => {
    expect(calculatePriorityFromMatrix('high', 'critical', customMatrix)).toBe('p3');
  });
});

/* ================================================================== */
/* buildMatrixLookup                                                    */
/* ================================================================== */
describe('buildMatrixLookup', () => {
  it('builds lookup map from flat entries', () => {
    const entries: PriorityMatrixEntry[] = [
      { impact: 'high', urgency: 'high', priority: 'p1', label: 'Critical' },
      { impact: 'high', urgency: 'medium', priority: 'p2', label: null },
      { impact: 'high', urgency: 'low', priority: 'p3', label: null },
      { impact: 'medium', urgency: 'high', priority: 'p2', label: null },
      { impact: 'medium', urgency: 'medium', priority: 'p3', label: null },
      { impact: 'medium', urgency: 'low', priority: 'p4', label: null },
      { impact: 'low', urgency: 'high', priority: 'p3', label: null },
      { impact: 'low', urgency: 'medium', priority: 'p4', label: null },
      { impact: 'low', urgency: 'low', priority: 'p5', label: null },
    ];
    const lookup = buildMatrixLookup(entries);
    expect(lookup.high.high).toBe('p1');
    expect(lookup.high.medium).toBe('p2');
    expect(lookup.low.low).toBe('p5');
  });

  it('normalizes keys to lowercase', () => {
    const entries: PriorityMatrixEntry[] = [
      { impact: 'HIGH', urgency: 'LOW', priority: 'P3', label: null },
    ];
    const lookup = buildMatrixLookup(entries);
    expect(lookup.high.low).toBe('p3');
  });

  it('handles empty entries array', () => {
    expect(buildMatrixLookup([])).toEqual({});
  });

  it('defaults missing priority to p3', () => {
    const entries: PriorityMatrixEntry[] = [
      { impact: 'high', urgency: 'high', priority: '', label: null },
    ];
    const lookup = buildMatrixLookup(entries);
    expect(lookup.high.high).toBe('p3');
  });

  it('handles missing impact/urgency gracefully', () => {
    const entries: PriorityMatrixEntry[] = [
      { impact: '', urgency: '', priority: 'p1', label: null },
    ];
    const lookup = buildMatrixLookup(entries);
    expect(lookup['']['']).toBe('p1');
  });
});

/* ================================================================== */
/* getPriorityLabel                                                     */
/* ================================================================== */
describe('getPriorityLabel', () => {
  it('should return correct labels for all priority levels', () => {
    expect(getPriorityLabel('p1')).toBe('P1 - Critical');
    expect(getPriorityLabel('p2')).toBe('P2 - High');
    expect(getPriorityLabel('p3')).toBe('P3 - Medium');
    expect(getPriorityLabel('p4')).toBe('P4 - Low');
    expect(getPriorityLabel('p5')).toBe('P5 - Planning');
  });

  it('should handle uppercase input', () => {
    expect(getPriorityLabel('P1')).toBe('P1 - Critical');
    expect(getPriorityLabel('P4')).toBe('P4 - Low');
    expect(getPriorityLabel('P5')).toBe('P5 - Planning');
  });

  it('should return uppercase for unknown values', () => {
    expect(getPriorityLabel('p6')).toBe('P6');
  });

  it('should return P3 for empty/undefined', () => {
    expect(getPriorityLabel('')).toBe('P3');
  });
});

/* ================================================================== */
/* getPriorityColor                                                     */
/* ================================================================== */
describe('getPriorityColor', () => {
  it('should return correct MUI color for each priority', () => {
    expect(getPriorityColor('p1')).toBe('error');
    expect(getPriorityColor('p2')).toBe('warning');
    expect(getPriorityColor('p3')).toBe('info');
    expect(getPriorityColor('p4')).toBe('success');
    expect(getPriorityColor('p5')).toBe('default');
  });

  it('should handle uppercase input', () => {
    expect(getPriorityColor('P1')).toBe('error');
    expect(getPriorityColor('P5')).toBe('default');
  });

  it('should return default for unknown values', () => {
    expect(getPriorityColor('p6')).toBe('default');
    expect(getPriorityColor('')).toBe('default');
  });
});
