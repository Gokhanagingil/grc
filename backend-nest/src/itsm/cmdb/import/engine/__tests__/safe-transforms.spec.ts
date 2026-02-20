import {
  applyTransform,
  applyTransformChain,
  applyFieldMapping,
  ALLOWED_TRANSFORMS,
  TransformDef,
  FieldMappingEntry,
} from '../safe-transforms';

describe('safe-transforms', () => {
  describe('ALLOWED_TRANSFORMS', () => {
    it('contains exactly the expected transforms', () => {
      expect(ALLOWED_TRANSFORMS).toEqual(
        new Set([
          'trim',
          'lower',
          'upper',
          'parseInt',
          'parseFloat',
          'date',
          'boolean',
          'toString',
          'default',
        ]),
      );
    });
  });

  describe('applyTransform', () => {
    it('trims whitespace', () => {
      expect(applyTransform('  hello  ', { name: 'trim' })).toBe('hello');
    });

    it('trim passes non-string through', () => {
      expect(applyTransform(42, { name: 'trim' })).toBe(42);
    });

    it('lowercases string', () => {
      expect(applyTransform('HELLO', { name: 'lower' })).toBe('hello');
    });

    it('uppercases string', () => {
      expect(applyTransform('hello', { name: 'upper' })).toBe('HELLO');
    });

    it('parses int from string', () => {
      expect(applyTransform('42', { name: 'parseInt' })).toBe(42);
    });

    it('returns null for unparseable int', () => {
      expect(applyTransform('abc', { name: 'parseInt' })).toBeNull();
    });

    it('returns null for empty parseInt', () => {
      expect(applyTransform('', { name: 'parseInt' })).toBeNull();
    });

    it('parses float from string', () => {
      expect(applyTransform('3.14', { name: 'parseFloat' })).toBeCloseTo(
        3.14,
      );
    });

    it('parses date to ISO string', () => {
      const result = applyTransform('2025-01-15', { name: 'date' });
      expect(typeof result).toBe('string');
      expect((result as string).startsWith('2025-01-15')).toBe(true);
    });

    it('returns null for invalid date', () => {
      expect(applyTransform('not-a-date', { name: 'date' })).toBeNull();
    });

    it('converts truthy strings to boolean true', () => {
      expect(applyTransform('true', { name: 'boolean' })).toBe(true);
      expect(applyTransform('1', { name: 'boolean' })).toBe(true);
      expect(applyTransform('yes', { name: 'boolean' })).toBe(true);
    });

    it('converts falsy strings to boolean false', () => {
      expect(applyTransform('false', { name: 'boolean' })).toBe(false);
      expect(applyTransform('0', { name: 'boolean' })).toBe(false);
      expect(applyTransform('no', { name: 'boolean' })).toBe(false);
    });

    it('converts value to string', () => {
      expect(applyTransform(42, { name: 'toString' })).toBe('42');
    });

    it('returns null for null toString', () => {
      expect(applyTransform(null, { name: 'toString' })).toBeNull();
    });

    it('applies default when value is null', () => {
      expect(
        applyTransform(null, { name: 'default', args: { value: 'N/A' } }),
      ).toBe('N/A');
    });

    it('keeps value when not null for default', () => {
      expect(
        applyTransform('existing', {
          name: 'default',
          args: { value: 'N/A' },
        }),
      ).toBe('existing');
    });

    it('rejects unsafe transforms', () => {
      expect(() =>
        applyTransform('test', { name: 'eval' as TransformDef['name'] }),
      ).toThrow('Unsafe transform rejected');
    });
  });

  describe('applyTransformChain', () => {
    it('applies multiple transforms in order', () => {
      const result = applyTransformChain('  HELLO  ', [
        { name: 'trim' },
        { name: 'lower' },
      ]);
      expect(result).toBe('hello');
    });

    it('handles empty chain', () => {
      expect(applyTransformChain('test', [])).toBe('test');
    });
  });

  describe('applyFieldMapping', () => {
    it('maps fields from source to target', () => {
      const row = { name: ' Server-01 ', ip: '192.168.1.1', count: '5' };
      const fieldMap: FieldMappingEntry[] = [
        {
          sourceField: 'name',
          targetField: 'ciName',
          transforms: [{ name: 'trim' }],
        },
        { sourceField: 'ip', targetField: 'ipAddress' },
        {
          sourceField: 'count',
          targetField: 'instanceCount',
          transforms: [{ name: 'parseInt' }],
        },
      ];

      const result = applyFieldMapping(row, fieldMap);
      expect(result).toEqual({
        ciName: 'Server-01',
        ipAddress: '192.168.1.1',
        instanceCount: 5,
      });
    });

    it('handles missing source fields', () => {
      const row = { name: 'test' };
      const fieldMap: FieldMappingEntry[] = [
        { sourceField: 'name', targetField: 'ciName' },
        { sourceField: 'missing', targetField: 'other' },
      ];

      const result = applyFieldMapping(row, fieldMap);
      expect(result).toEqual({
        ciName: 'test',
        other: undefined,
      });
    });
  });
});
