import { safeToDate, safeToIso } from './date.util';

describe('date.util', () => {
  describe('safeToDate', () => {
    it('should return Date object when given a valid Date', () => {
      const date = new Date('2026-01-15T10:00:00.000Z');
      const result = safeToDate(date);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(date.getTime());
    });

    it('should return Date object when given a valid ISO string', () => {
      const isoString = '2026-01-15T10:00:00.000Z';
      const result = safeToDate(isoString);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(isoString);
    });

    it('should return Date object when given a valid timestamp number', () => {
      const timestamp = 1768489200000;
      const result = safeToDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(timestamp);
    });

    it('should return Date object when given a date-only string', () => {
      const dateString = '2026-01-15';
      const result = safeToDate(dateString);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2026);
      expect(result?.getMonth()).toBe(0);
      expect(result?.getDate()).toBe(15);
    });

    it('should return null when given null', () => {
      const result = safeToDate(null);
      expect(result).toBeNull();
    });

    it('should return null when given undefined', () => {
      const result = safeToDate(undefined);
      expect(result).toBeNull();
    });

    it('should return null when given an invalid string', () => {
      const result = safeToDate('not-a-date');
      expect(result).toBeNull();
    });

    it('should return null when given an empty string', () => {
      const result = safeToDate('');
      expect(result).toBeNull();
    });

    it('should return null when given an invalid Date object', () => {
      const invalidDate = new Date('invalid');
      const result = safeToDate(invalidDate);
      expect(result).toBeNull();
    });

    it('should return null when given NaN', () => {
      const result = safeToDate(NaN);
      expect(result).toBeNull();
    });
  });

  describe('safeToIso', () => {
    it('should return ISO string when given a valid Date', () => {
      const date = new Date('2026-01-15T10:00:00.000Z');
      const result = safeToIso(date);
      expect(result).toBe('2026-01-15T10:00:00.000Z');
    });

    it('should return ISO string when given a valid ISO string', () => {
      const isoString = '2026-01-15T10:00:00.000Z';
      const result = safeToIso(isoString);
      expect(result).toBe(isoString);
    });

    it('should return ISO string when given a valid timestamp number', () => {
      const timestamp = 1768489200000;
      const result = safeToIso(timestamp);
      expect(result).toBe(new Date(timestamp).toISOString());
    });

    it('should return ISO string when given a date-only string', () => {
      const dateString = '2026-01-15';
      const result = safeToIso(dateString);
      expect(result).not.toBeNull();
      expect(result).toContain('2026-01-15');
    });

    it('should return null when given null', () => {
      const result = safeToIso(null);
      expect(result).toBeNull();
    });

    it('should return null when given undefined', () => {
      const result = safeToIso(undefined);
      expect(result).toBeNull();
    });

    it('should return null when given an invalid string', () => {
      const result = safeToIso('not-a-date');
      expect(result).toBeNull();
    });

    it('should return null when given an empty string', () => {
      const result = safeToIso('');
      expect(result).toBeNull();
    });

    it('should return null when given an invalid Date object', () => {
      const invalidDate = new Date('invalid');
      const result = safeToIso(invalidDate);
      expect(result).toBeNull();
    });
  });
});
