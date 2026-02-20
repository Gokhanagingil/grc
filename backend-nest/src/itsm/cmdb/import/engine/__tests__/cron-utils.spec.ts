import { parseCron, isValidCron, getNextRunDate } from '../cron-utils';

describe('cron-utils', () => {
  describe('parseCron', () => {
    it('parses a simple every-minute expression', () => {
      const result = parseCron('* * * * *');
      expect(result.minute).toHaveLength(60);
      expect(result.hour).toHaveLength(24);
      expect(result.dayOfMonth).toHaveLength(31);
      expect(result.month).toHaveLength(12);
      expect(result.dayOfWeek).toHaveLength(7);
    });

    it('parses specific values', () => {
      const result = parseCron('30 9 * * 1');
      expect(result.minute).toEqual([30]);
      expect(result.hour).toEqual([9]);
      expect(result.dayOfWeek).toEqual([1]);
    });

    it('parses ranges', () => {
      const result = parseCron('0-5 * * * *');
      expect(result.minute).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('parses step values', () => {
      const result = parseCron('*/15 * * * *');
      expect(result.minute).toEqual([0, 15, 30, 45]);
    });

    it('parses comma-separated values', () => {
      const result = parseCron('0,30 * * * *');
      expect(result.minute).toEqual([0, 30]);
    });

    it('parses range with step', () => {
      const result = parseCron('0-30/10 * * * *');
      expect(result.minute).toEqual([0, 10, 20, 30]);
    });

    it('throws for invalid expression (wrong number of fields)', () => {
      expect(() => parseCron('* * *')).toThrow('expected 5 fields');
    });

    it('throws for out-of-range values', () => {
      expect(() => parseCron('60 * * * *')).toThrow();
    });
  });

  describe('isValidCron', () => {
    it('returns true for valid expressions', () => {
      expect(isValidCron('0 */6 * * *')).toBe(true);
      expect(isValidCron('30 9 * * 1-5')).toBe(true);
      expect(isValidCron('*/5 * * * *')).toBe(true);
    });

    it('returns false for invalid expressions', () => {
      expect(isValidCron('')).toBe(false);
      expect(isValidCron('bad cron')).toBe(false);
      expect(isValidCron('* * *')).toBe(false);
    });
  });

  describe('getNextRunDate', () => {
    it('returns a date in the future', () => {
      const now = new Date('2025-01-15T10:00:00Z');
      const next = getNextRunDate('0 * * * *', now);
      expect(next.getTime()).toBeGreaterThan(now.getTime());
      expect(next.getMinutes()).toBe(0);
    });

    it('returns the next matching minute for every-5-minutes cron', () => {
      const now = new Date('2025-01-15T10:07:00Z');
      const next = getNextRunDate('*/5 * * * *', now);
      expect(next.getMinutes()).toBe(10);
    });

    it('computes next run for daily at 9:30', () => {
      const now = new Date('2025-01-15T09:31:00Z');
      const next = getNextRunDate('30 9 * * *', now);
      expect(next.getDate()).toBe(16);
      expect(next.getHours()).toBe(9);
      expect(next.getMinutes()).toBe(30);
    });

    it('handles day-of-week filter', () => {
      const monday = new Date('2025-01-13T00:00:00Z');
      const next = getNextRunDate('0 9 * * 3', monday);
      expect(next.getDay()).toBe(3);
    });
  });
});
