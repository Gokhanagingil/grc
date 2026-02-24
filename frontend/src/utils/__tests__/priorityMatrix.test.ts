import {
  calculatePriorityFromMatrix,
  getPriorityLabel,
  getPriorityColor,
} from '../priorityMatrix';

describe('calculatePriorityFromMatrix', () => {
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

describe('getPriorityLabel', () => {
  it('should return correct labels for all priority levels', () => {
    expect(getPriorityLabel('p1')).toBe('P1 - Critical');
    expect(getPriorityLabel('p2')).toBe('P2 - High');
    expect(getPriorityLabel('p3')).toBe('P3 - Medium');
    expect(getPriorityLabel('p4')).toBe('P4 - Low');
  });

  it('should handle uppercase input', () => {
    expect(getPriorityLabel('P1')).toBe('P1 - Critical');
    expect(getPriorityLabel('P4')).toBe('P4 - Low');
  });

  it('should return uppercase for unknown values', () => {
    expect(getPriorityLabel('p5')).toBe('P5');
  });

  it('should return P3 for empty/undefined', () => {
    expect(getPriorityLabel('')).toBe('P3');
  });
});

describe('getPriorityColor', () => {
  it('should return correct MUI color for each priority', () => {
    expect(getPriorityColor('p1')).toBe('error');
    expect(getPriorityColor('p2')).toBe('warning');
    expect(getPriorityColor('p3')).toBe('info');
    expect(getPriorityColor('p4')).toBe('success');
  });

  it('should handle uppercase input', () => {
    expect(getPriorityColor('P1')).toBe('error');
  });

  it('should return default for unknown values', () => {
    expect(getPriorityColor('p5')).toBe('default');
    expect(getPriorityColor('')).toBe('default');
  });
});
