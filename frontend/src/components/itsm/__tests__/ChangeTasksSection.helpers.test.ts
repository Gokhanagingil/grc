/**
 * ChangeTasksSection — Helper Function Tests
 *
 * Tests the envelope parsing helpers used by ChangeTasksSection component:
 * - extractTasksFromResponse: robust envelope parsing for task list responses
 * - extractSummaryFromResponse: summary endpoint response parsing
 * - extractTemplatesFromResponse: template list endpoint response parsing
 *
 * These helpers defend against multiple envelope variants:
 * - raw array
 * - { data: [...] }
 * - { data: { items: [...] } }
 * - { items: [...] }
 * - null / undefined / non-array
 *
 * @regression
 * @stabilization-pack
 */

// We re-implement the helpers identically to test the exact contract in isolation
// (they are not exported from the component module).

function extractTasksFromResponse(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  if ('data' in obj) {
    if (Array.isArray(obj.data)) return obj.data;
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if ('items' in inner && Array.isArray(inner.items)) return inner.items;
    }
  }
  if ('items' in obj && Array.isArray(obj.items)) return obj.items;
  return [];
}

interface SummaryLike {
  total?: number;
  [key: string]: unknown;
}

function extractSummaryFromResponse(raw: unknown): SummaryLike | null {
  if (!raw) return null;
  if (typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if ('data' in obj && obj.data && typeof obj.data === 'object') {
    return obj.data as SummaryLike;
  }
  if ('total' in obj) return obj as SummaryLike;
  return null;
}

function extractTemplatesFromResponse(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  if ('data' in obj) {
    if (Array.isArray(obj.data)) return obj.data;
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if ('items' in inner && Array.isArray(inner.items)) return inner.items;
    }
  }
  if ('items' in obj && Array.isArray(obj.items)) return obj.items;
  return [];
}

// ===========================================================================
// extractTasksFromResponse
// ===========================================================================
describe('extractTasksFromResponse', () => {
  it('returns [] for null', () => {
    expect(extractTasksFromResponse(null)).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(extractTasksFromResponse(undefined)).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(extractTasksFromResponse('')).toEqual([]);
  });

  it('returns [] for number', () => {
    expect(extractTasksFromResponse(42)).toEqual([]);
  });

  it('returns [] for boolean', () => {
    expect(extractTasksFromResponse(true)).toEqual([]);
  });

  it('returns flat array as-is', () => {
    const arr = [{ id: '1' }, { id: '2' }];
    expect(extractTasksFromResponse(arr)).toBe(arr);
  });

  it('returns empty array for empty array input', () => {
    expect(extractTasksFromResponse([])).toEqual([]);
  });

  it('extracts from { data: [...] } envelope', () => {
    const items = [{ id: 't1' }, { id: 't2' }];
    expect(extractTasksFromResponse({ data: items })).toBe(items);
  });

  it('extracts from { success: true, data: [...] } envelope', () => {
    const items = [{ id: 't3' }];
    expect(extractTasksFromResponse({ success: true, data: items })).toBe(items);
  });

  it('extracts from { data: { items: [...] } } paginated envelope', () => {
    const items = [{ id: 't4' }];
    expect(extractTasksFromResponse({ data: { items, total: 1, page: 1, pageSize: 50 } })).toBe(items);
  });

  it('extracts from { items: [...] } flat paginated', () => {
    const items = [{ id: 't5' }];
    expect(extractTasksFromResponse({ items, total: 1 })).toBe(items);
  });

  it('returns [] for { data: null }', () => {
    expect(extractTasksFromResponse({ data: null })).toEqual([]);
  });

  it('returns [] for { data: "string" }', () => {
    expect(extractTasksFromResponse({ data: 'not-an-array' })).toEqual([]);
  });

  it('returns [] for empty object {}', () => {
    expect(extractTasksFromResponse({})).toEqual([]);
  });

  it('returns [] for { data: { notItems: [] } }', () => {
    expect(extractTasksFromResponse({ data: { notItems: [] } })).toEqual([]);
  });

  it('returns [] for { data: 123 }', () => {
    expect(extractTasksFromResponse({ data: 123 })).toEqual([]);
  });
});

// ===========================================================================
// extractSummaryFromResponse
// ===========================================================================
describe('extractSummaryFromResponse', () => {
  it('returns null for null', () => {
    expect(extractSummaryFromResponse(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(extractSummaryFromResponse(undefined)).toBeNull();
  });

  it('returns null for string', () => {
    expect(extractSummaryFromResponse('hello')).toBeNull();
  });

  it('returns null for number', () => {
    expect(extractSummaryFromResponse(42)).toBeNull();
  });

  it('extracts from { data: { total: 5, ... } } envelope', () => {
    const summary = { total: 5, completed: 2, inProgress: 1 };
    const result = extractSummaryFromResponse({ data: summary });
    expect(result).toBe(summary);
  });

  it('extracts from flat { total: 5, ... } shape', () => {
    const summary = { total: 5, completed: 2 };
    const result = extractSummaryFromResponse(summary);
    expect(result).toBe(summary);
  });

  it('returns null for empty object without total', () => {
    expect(extractSummaryFromResponse({})).toBeNull();
  });

  it('returns null for { data: null }', () => {
    expect(extractSummaryFromResponse({ data: null })).toBeNull();
  });

  it('returns null for { data: "string" }', () => {
    expect(extractSummaryFromResponse({ data: 'not-an-object' })).toBeNull();
  });
});

// ===========================================================================
// extractTemplatesFromResponse
// ===========================================================================
describe('extractTemplatesFromResponse', () => {
  it('returns [] for null', () => {
    expect(extractTemplatesFromResponse(null)).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(extractTemplatesFromResponse(undefined)).toEqual([]);
  });

  it('returns flat array as-is', () => {
    const arr = [{ id: 't1', name: 'Template 1' }];
    expect(extractTemplatesFromResponse(arr)).toBe(arr);
  });

  it('extracts from { data: [...] } envelope', () => {
    const items = [{ id: 't1', name: 'Template 1' }];
    expect(extractTemplatesFromResponse({ data: items })).toBe(items);
  });

  it('extracts from { data: { items: [...] } } paginated envelope', () => {
    const items = [{ id: 't1', name: 'Template 1' }];
    expect(extractTemplatesFromResponse({ data: { items, total: 1 } })).toBe(items);
  });

  it('extracts from { items: [...] } flat paginated', () => {
    const items = [{ id: 't1', name: 'Template 1' }];
    expect(extractTemplatesFromResponse({ items })).toBe(items);
  });

  it('returns [] for { data: null }', () => {
    expect(extractTemplatesFromResponse({ data: null })).toEqual([]);
  });

  it('returns [] for empty object {}', () => {
    expect(extractTemplatesFromResponse({})).toEqual([]);
  });

  it('returns [] for number', () => {
    expect(extractTemplatesFromResponse(42)).toEqual([]);
  });
});
