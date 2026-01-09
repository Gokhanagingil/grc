import 'reflect-metadata';
import { ListQueryDto, createListResponse } from './list-query.dto';

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
