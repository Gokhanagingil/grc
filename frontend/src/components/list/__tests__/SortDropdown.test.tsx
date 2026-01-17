import { parseSort, buildSort } from '../../../utils/listQueryUtils';

describe('SortDropdown utilities', () => {
  describe('parseSort', () => {
    it('should parse valid sort string with ASC direction', () => {
      const result = parseSort('name:ASC');
      expect(result).toEqual({ field: 'name', direction: 'ASC' });
    });

    it('should parse valid sort string with DESC direction', () => {
      const result = parseSort('createdAt:DESC');
      expect(result).toEqual({ field: 'createdAt', direction: 'DESC' });
    });

    it('should return null for empty string', () => {
      expect(parseSort('')).toBeNull();
    });

    it('should return null for invalid format (no colon)', () => {
      expect(parseSort('invalid')).toBeNull();
    });

    it('should return null for invalid direction', () => {
      expect(parseSort('name:INVALID')).toBeNull();
    });

    it('should handle field names with underscores', () => {
      const result = parseSort('created_at:DESC');
      expect(result).toEqual({ field: 'created_at', direction: 'DESC' });
    });

    it('should handle camelCase field names', () => {
      const result = parseSort('updatedAt:ASC');
      expect(result).toEqual({ field: 'updatedAt', direction: 'ASC' });
    });
  });

  describe('buildSort', () => {
    it('should build sort string with ASC direction', () => {
      expect(buildSort('name', 'ASC')).toBe('name:ASC');
    });

    it('should build sort string with DESC direction', () => {
      expect(buildSort('createdAt', 'DESC')).toBe('createdAt:DESC');
    });

    it('should handle field names with underscores', () => {
      expect(buildSort('created_at', 'DESC')).toBe('created_at:DESC');
    });
  });

  describe('sort round-trip', () => {
    it('should round-trip through parse -> build', () => {
      const original = 'updatedAt:DESC';
      const parsed = parseSort(original);
      expect(parsed).not.toBeNull();
      const rebuilt = buildSort(parsed!.field, parsed!.direction);
      expect(rebuilt).toBe(original);
    });

    it('should round-trip ASC direction', () => {
      const original = 'name:ASC';
      const parsed = parseSort(original);
      expect(parsed).not.toBeNull();
      const rebuilt = buildSort(parsed!.field, parsed!.direction);
      expect(rebuilt).toBe(original);
    });
  });

  describe('sort direction toggle logic', () => {
    it('should toggle from ASC to DESC', () => {
      const current = parseSort('name:ASC');
      expect(current).not.toBeNull();
      const newDirection = current!.direction === 'ASC' ? 'DESC' : 'ASC';
      const newSort = buildSort(current!.field, newDirection);
      expect(newSort).toBe('name:DESC');
    });

    it('should toggle from DESC to ASC', () => {
      const current = parseSort('name:DESC');
      expect(current).not.toBeNull();
      const newDirection = current!.direction === 'ASC' ? 'DESC' : 'ASC';
      const newSort = buildSort(current!.field, newDirection);
      expect(newSort).toBe('name:ASC');
    });
  });
});

describe('SortDropdown sort options', () => {
  const DEFAULT_SORT_OPTIONS = [
    { name: 'createdAt', label: 'Created At', type: 'date' },
    { name: 'updatedAt', label: 'Updated At', type: 'date' },
  ];

  it('should have default sort options as fallback', () => {
    expect(DEFAULT_SORT_OPTIONS).toHaveLength(2);
    expect(DEFAULT_SORT_OPTIONS[0].name).toBe('createdAt');
    expect(DEFAULT_SORT_OPTIONS[1].name).toBe('updatedAt');
  });

  it('should have correct types for default options', () => {
    DEFAULT_SORT_OPTIONS.forEach((option) => {
      expect(option).toHaveProperty('name');
      expect(option).toHaveProperty('label');
      expect(option).toHaveProperty('type');
      expect(typeof option.name).toBe('string');
      expect(typeof option.label).toBe('string');
      expect(typeof option.type).toBe('string');
    });
  });
});
