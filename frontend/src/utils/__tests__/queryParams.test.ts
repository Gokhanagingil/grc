import {
  buildListQueryParams,
  parseFilterFromQuery,
  buildListQueryParamsWithDefaults,
  parseSortFromQuery,
  formatSortToQuery,
} from '../queryParams';

describe('queryParams helpers', () => {
  it('buildListQueryParams encodes filter JSON exactly once', () => {
    const filter = {
      and: [
        { field: 'status', operator: 'eq', value: 'open' },
        { field: 'severity', operator: 'gte', value: 3 },
      ],
    };

    const params = buildListQueryParams({
      page: 1,
      pageSize: 25,
      filter,
    });

    const query = params.toString();
    expect(query).toContain('filter=');
    expect(query).toContain('%7B');
    expect(query).not.toContain('%257B');
  });

  it('parseFilterFromQuery returns the original filter object', () => {
    const filter = { field: 'status', operator: 'eq', value: 'open' };
    const params = buildListQueryParams({ filter });

    const parsed = parseFilterFromQuery(params.get('filter'));
    expect(parsed).toEqual(filter);
  });

  it('parseFilterFromQuery handles encoded input safely', () => {
    const filter = { field: 'status', operator: 'eq', value: 'open' };
    const encoded = encodeURIComponent(JSON.stringify(filter));

    const parsed = parseFilterFromQuery(encoded);
    expect(parsed).toEqual(filter);
  });

  it('parseFilterFromQuery returns null for invalid JSON', () => {
    expect(parseFilterFromQuery('not-json')).toBeNull();
  });

  it('parseFilterFromQuery normalizes legacy format to canonical', () => {
    const legacyFilter = {
      op: 'and',
      children: [
        { field: 'status', operator: 'eq', value: 'open' },
        { field: 'priority', operator: 'eq', value: 'high' },
      ],
    };

    const encoded = JSON.stringify(legacyFilter);
    const parsed = parseFilterFromQuery(encoded);
    
    expect(parsed).toEqual({
      and: [
        { field: 'status', operator: 'eq', value: 'open' },
        { field: 'priority', operator: 'eq', value: 'high' },
      ],
    });
  });

  describe('buildListQueryParamsWithDefaults', () => {
    it('excludes default values from URL params', () => {
      const params = buildListQueryParamsWithDefaults(
        {
          page: 1,
          pageSize: 10,
          sort: 'createdAt:DESC',
        },
        {
          page: 1,
          pageSize: 10,
          sort: 'createdAt:DESC',
        }
      );

      expect(params.has('page')).toBe(false);
      expect(params.has('pageSize')).toBe(false);
      expect(params.has('sort')).toBe(false);
    });

    it('includes non-default values in URL params', () => {
      const params = buildListQueryParamsWithDefaults(
        {
          page: 2,
          pageSize: 25,
          sort: 'updatedAt:ASC',
        },
        {
          page: 1,
          pageSize: 10,
          sort: 'createdAt:DESC',
        }
      );

      expect(params.get('page')).toBe('2');
      expect(params.get('pageSize')).toBe('25');
      expect(params.get('sort')).toBe('updatedAt:ASC');
    });

    it('excludes empty filter from URL params', () => {
      const params = buildListQueryParamsWithDefaults(
        {
          filter: null,
        },
        {
          filter: null,
        }
      );

      expect(params.has('filter')).toBe(false);
    });

    it('includes non-empty filter in URL params', () => {
      const filter = {
        and: [{ field: 'status', operator: 'eq', value: 'open' }],
      };

      const params = buildListQueryParamsWithDefaults(
        { filter },
        { filter: null }
      );

      expect(params.has('filter')).toBe(true);
      const filterStr = params.get('filter');
      expect(filterStr).toBeTruthy();
      if (filterStr) {
        const parsed = JSON.parse(filterStr);
        expect(parsed).toEqual(filter);
      }
    });

    it('excludes empty search from URL params', () => {
      const params = buildListQueryParamsWithDefaults(
        { search: null },
        {}
      );

      expect(params.has('search')).toBe(false);
    });

    it('includes non-empty search in URL params', () => {
      const params = buildListQueryParamsWithDefaults(
        { search: 'test query' },
        {}
      );

      expect(params.get('search')).toBe('test query');
    });
  });

  describe('parseSortFromQuery', () => {
    it('parses valid sort format', () => {
      const result = parseSortFromQuery('createdAt:DESC');
      expect(result).toEqual({ field: 'createdAt', direction: 'DESC' });
    });

    it('parses ASC direction', () => {
      const result = parseSortFromQuery('name:ASC');
      expect(result).toEqual({ field: 'name', direction: 'ASC' });
    });

    it('returns null for invalid format', () => {
      expect(parseSortFromQuery('invalid')).toBeNull();
      expect(parseSortFromQuery('field')).toBeNull();
      expect(parseSortFromQuery('field:invalid')).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(parseSortFromQuery(null)).toBeNull();
      expect(parseSortFromQuery(undefined)).toBeNull();
    });
  });

  describe('formatSortToQuery', () => {
    it('formats sort correctly', () => {
      expect(formatSortToQuery('createdAt', 'DESC')).toBe('createdAt:DESC');
      expect(formatSortToQuery('name', 'ASC')).toBe('name:ASC');
    });
  });
});
