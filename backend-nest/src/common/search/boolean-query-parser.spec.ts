import { parseBooleanQuery, QueryNode } from './boolean-query-parser';

describe('BooleanQueryParser', () => {
  describe('parseBooleanQuery', () => {
    it('should return null for empty query', () => {
      expect(parseBooleanQuery('')).toBeNull();
      expect(parseBooleanQuery('   ')).toBeNull();
    });

    it('should parse simple condition', () => {
      const result = parseBooleanQuery('impact > 3');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('condition');
      expect(result?.condition?.field).toBe('impact');
      expect(result?.condition?.operator).toBe('>');
      expect(result?.condition?.value).toBe(3);
    });

    it('should parse quoted string values', () => {
      const result = parseBooleanQuery('category = "Vendor"');
      expect(result).not.toBeNull();
      expect(result?.condition?.value).toBe('Vendor');
    });

    it('should parse single NOT condition', () => {
      const result = parseBooleanQuery('NOT status = Active');
      expect(result).not.toBeNull();
      expect(result?.condition?.negated).toBe(true);
    });

    it('should parse nested parentheses', () => {
      const result = parseBooleanQuery('(impact>3 AND (likelihood>4 OR category=Vendor))');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('group');
    });

    it('should handle escaped characters in quoted strings', () => {
      const result = parseBooleanQuery('name = "test\\"quote"');
      expect(result).not.toBeNull();
      // Quoted string should be parsed correctly
    });

    it('should parse IS EMPTY operator', () => {
      const result = parseBooleanQuery('description IS EMPTY');
      expect(result).not.toBeNull();
      expect(result?.condition?.operator).toBe('IS EMPTY');
    });

    it('should parse IS NOT EMPTY operator', () => {
      const result = parseBooleanQuery('description IS NOT EMPTY');
      expect(result).not.toBeNull();
      expect(result?.condition?.operator).toBe('IS NOT EMPTY');
    });

    it('should parse IN operator with multiple values', () => {
      const result = parseBooleanQuery('category IN (Vendor, Operational, Strategic)');
      expect(result).not.toBeNull();
      expect(result?.condition?.operator).toBe('IN');
      expect(Array.isArray(result?.condition?.value)).toBe(true);
      const values = result?.condition?.value as string[];
      expect(values.length).toBeGreaterThan(0);
    });

    it('should parse multi-word field values with quotes', () => {
      const result = parseBooleanQuery('name = "multi word value"');
      expect(result).not.toBeNull();
      expect(result?.condition?.value).toBe('multi word value');
    });

    it('should handle complex nested query', () => {
      const query = '(impact>3 AND (likelihood>4 OR category=Vendor)) OR NOT status=Active';
      const result = parseBooleanQuery(query);
      expect(result).not.toBeNull();
    });
  });
});

