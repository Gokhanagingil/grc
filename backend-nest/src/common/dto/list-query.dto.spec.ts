import 'reflect-metadata';
import {
  ListQueryDto,
  createListResponse,
  parseSortQuery,
  ParsedSort,
} from './list-query.dto';

describe('ListQueryDto', () => {
  describe('getEffectivePageSize', () => {
    it('should return limit when provided', () => {
      const dto = new ListQueryDto();
      dto.limit = 50;
      dto.pageSize = 20;
      expect(dto.getEffectivePageSize()).toBe(50);
    });

    it('should return pageSize when limit is not provided', () => {
      const dto = new ListQueryDto();
      dto.pageSize = 30;
      expect(dto.getEffectivePageSize()).toBe(30);
    });

    it('should return default 20 when neither is provided', () => {
      const dto = new ListQueryDto();
      expect(dto.getEffectivePageSize()).toBe(20);
    });
  });

  describe('getEffectivePage', () => {
    it('should return page when provided', () => {
      const dto = new ListQueryDto();
      dto.page = 5;
      expect(dto.getEffectivePage()).toBe(5);
    });

    it('should return default 1 when not provided', () => {
      const dto = new ListQueryDto();
      expect(dto.getEffectivePage()).toBe(1);
    });
  });

  describe('getEffectiveSearch', () => {
    it('should return search when provided', () => {
      const dto = new ListQueryDto();
      dto.search = 'test query';
      expect(dto.getEffectiveSearch()).toBe('test query');
    });

    it('should return q (legacy) when search is not provided', () => {
      const dto = new ListQueryDto();
      dto.q = 'legacy query';
      expect(dto.getEffectiveSearch()).toBe('legacy query');
    });

    it('should prefer search over q when both are provided', () => {
      const dto = new ListQueryDto();
      dto.search = 'new search';
      dto.q = 'legacy search';
      expect(dto.getEffectiveSearch()).toBe('new search');
    });

    it('should return undefined when neither is provided', () => {
      const dto = new ListQueryDto();
      expect(dto.getEffectiveSearch()).toBeUndefined();
    });

    it('should trim whitespace from search term', () => {
      const dto = new ListQueryDto();
      dto.search = '  test query  ';
      expect(dto.getEffectiveSearch()).toBe('test query');
    });

    it('should collapse multiple spaces to single space', () => {
      const dto = new ListQueryDto();
      dto.search = 'test    multiple   spaces';
      expect(dto.getEffectiveSearch()).toBe('test multiple spaces');
    });

    it('should truncate search term exceeding max length', () => {
      const dto = new ListQueryDto();
      dto.search = 'a'.repeat(300);
      const result = dto.getEffectiveSearch();
      expect(result?.length).toBe(ListQueryDto.MAX_SEARCH_LENGTH);
    });

    it('should return undefined for whitespace-only search', () => {
      const dto = new ListQueryDto();
      dto.search = '   ';
      expect(dto.getEffectiveSearch()).toBeUndefined();
    });
  });

  describe('normalizeSearchTerm', () => {
    it('should return undefined for empty string', () => {
      expect(ListQueryDto.normalizeSearchTerm('')).toBeUndefined();
    });

    it('should return undefined for undefined', () => {
      expect(ListQueryDto.normalizeSearchTerm(undefined)).toBeUndefined();
    });

    it('should trim and collapse spaces', () => {
      expect(ListQueryDto.normalizeSearchTerm('  hello   world  ')).toBe(
        'hello world',
      );
    });

    it('should enforce max length', () => {
      const longString = 'x'.repeat(250);
      const result = ListQueryDto.normalizeSearchTerm(longString);
      expect(result?.length).toBe(ListQueryDto.MAX_SEARCH_LENGTH);
    });
  });

  describe('isSearchTermValid', () => {
    it('should return true when no search term', () => {
      const dto = new ListQueryDto();
      expect(dto.isSearchTermValid()).toBe(true);
    });

    it('should return true when search term meets minimum length', () => {
      const dto = new ListQueryDto();
      dto.search = 'ab';
      expect(dto.isSearchTermValid()).toBe(true);
    });

    it('should return false when search term is too short', () => {
      const dto = new ListQueryDto();
      dto.search = 'a';
      expect(dto.isSearchTermValid()).toBe(false);
    });

    it('should allow custom minimum length', () => {
      const dto = new ListQueryDto();
      dto.search = 'abc';
      expect(dto.isSearchTermValid(3)).toBe(true);
      expect(dto.isSearchTermValid(4)).toBe(false);
    });
  });

  describe('getEffectiveSort', () => {
    it('should parse sort param in field:dir format', () => {
      const dto = new ListQueryDto();
      dto.sort = 'createdAt:DESC';
      const result = dto.getEffectiveSort();
      expect(result).toEqual({ field: 'createdAt', direction: 'DESC' });
    });

    it('should normalize direction to uppercase', () => {
      const dto = new ListQueryDto();
      dto.sort = 'name:asc';
      const result = dto.getEffectiveSort();
      expect(result).toEqual({ field: 'name', direction: 'ASC' });
    });

    it('should fall back to sortBy/sortOrder when sort is not provided', () => {
      const dto = new ListQueryDto();
      dto.sortBy = 'updatedAt';
      dto.sortOrder = 'ASC';
      const result = dto.getEffectiveSort();
      expect(result).toEqual({ field: 'updatedAt', direction: 'ASC' });
    });

    it('should return null when no sort params are provided', () => {
      const dto = new ListQueryDto();
      expect(dto.getEffectiveSort()).toBeNull();
    });

    it('should prefer sort over sortBy/sortOrder', () => {
      const dto = new ListQueryDto();
      dto.sort = 'name:ASC';
      dto.sortBy = 'createdAt';
      dto.sortOrder = 'DESC';
      const result = dto.getEffectiveSort();
      expect(result).toEqual({ field: 'name', direction: 'ASC' });
    });
  });

  describe('getOffset', () => {
    it('should calculate offset correctly for page 1', () => {
      const dto = new ListQueryDto();
      dto.page = 1;
      dto.pageSize = 20;
      expect(dto.getOffset()).toBe(0);
    });

    it('should calculate offset correctly for page 2', () => {
      const dto = new ListQueryDto();
      dto.page = 2;
      dto.pageSize = 20;
      expect(dto.getOffset()).toBe(20);
    });

    it('should calculate offset correctly for page 5 with pageSize 10', () => {
      const dto = new ListQueryDto();
      dto.page = 5;
      dto.pageSize = 10;
      expect(dto.getOffset()).toBe(40);
    });
  });
});

describe('createListResponse', () => {
  it('should create LIST-CONTRACT compliant response', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const result = createListResponse(items, 100, 1, 20);

    expect(result).toEqual({
      items: [{ id: '1' }, { id: '2' }],
      total: 100,
      page: 1,
      pageSize: 20,
      totalPages: 5,
    });
  });

  it('should calculate totalPages correctly', () => {
    const items = [{ id: '1' }];
    const result = createListResponse(items, 25, 1, 10);
    expect(result.totalPages).toBe(3);
  });

  it('should handle empty items array', () => {
    const result = createListResponse([], 0, 1, 20);
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });

  it('should handle single page result', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const result = createListResponse(items, 2, 1, 20);
    expect(result.totalPages).toBe(1);
  });
});

describe('parseSortQuery', () => {
  const allowedFields = ['createdAt', 'updatedAt', 'name', 'title', 'status'];
  const defaultSort: ParsedSort = { field: 'createdAt', direction: 'DESC' };

  describe('with sortBy/sortOrder (explicit params)', () => {
    it('should parse valid sortBy and sortOrder', () => {
      const result = parseSortQuery(
        { sortBy: 'name', sortOrder: 'ASC' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual({ field: 'name', direction: 'ASC' });
    });

    it('should default sortOrder to DESC when not provided', () => {
      const result = parseSortQuery(
        { sortBy: 'name' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual({ field: 'name', direction: 'DESC' });
    });

    it('should normalize sortOrder to uppercase', () => {
      const result = parseSortQuery(
        { sortBy: 'name', sortOrder: 'asc' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual({ field: 'name', direction: 'ASC' });
    });

    it('should fall back to default for invalid sortBy field', () => {
      const result = parseSortQuery(
        { sortBy: 'invalidField', sortOrder: 'ASC' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual(defaultSort);
    });

    it('should prioritize sortBy/sortOrder over sort param', () => {
      const result = parseSortQuery(
        { sortBy: 'name', sortOrder: 'ASC', sort: 'title:DESC' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual({ field: 'name', direction: 'ASC' });
    });
  });

  describe('with sort param (combined format)', () => {
    it('should parse valid sort param in field:dir format', () => {
      const result = parseSortQuery(
        { sort: 'name:ASC' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual({ field: 'name', direction: 'ASC' });
    });

    it('should normalize direction to uppercase', () => {
      const result = parseSortQuery(
        { sort: 'name:asc' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual({ field: 'name', direction: 'ASC' });
    });

    it('should fall back to default for invalid field in sort param', () => {
      const result = parseSortQuery(
        { sort: 'invalidField:ASC' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual(defaultSort);
    });

    it('should fall back to default for invalid direction in sort param', () => {
      const result = parseSortQuery(
        { sort: 'name:INVALID' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual(defaultSort);
    });

    it('should fall back to default for malformed sort param', () => {
      const result = parseSortQuery(
        { sort: 'nameASC' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual(defaultSort);
    });

    it('should fall back to default for sort param with too many colons', () => {
      const result = parseSortQuery(
        { sort: 'name:ASC:extra' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual(defaultSort);
    });
  });

  describe('with no sort params', () => {
    it('should return default sort when no params provided', () => {
      const result = parseSortQuery({}, allowedFields, defaultSort);
      expect(result).toEqual(defaultSort);
    });

    it('should return default sort when params are undefined', () => {
      const result = parseSortQuery(
        { sort: undefined, sortBy: undefined, sortOrder: undefined },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual(defaultSort);
    });
  });

  describe('security: field allowlist validation', () => {
    it('should reject SQL injection attempts in sortBy', () => {
      const result = parseSortQuery(
        { sortBy: 'name; DROP TABLE users;--' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual(defaultSort);
    });

    it('should reject SQL injection attempts in sort param', () => {
      const result = parseSortQuery(
        { sort: 'name; DROP TABLE users;--:ASC' },
        allowedFields,
        defaultSort,
      );
      expect(result).toEqual(defaultSort);
    });

    it('should only allow fields in the allowlist', () => {
      const restrictedAllowlist = ['createdAt'];
      const result = parseSortQuery(
        { sortBy: 'name' },
        restrictedAllowlist,
        defaultSort,
      );
      expect(result).toEqual(defaultSort);
    });
  });
});
