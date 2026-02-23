/**
 * API Response Shape Guard — Unit Tests
 *
 * Phase 0 — Quality Gate: "No silent UI failures"
 *
 * Verifies that guardListResponse / guardRecordResponse:
 *   - Accept valid LIST-CONTRACT and RECORD-CONTRACT shapes
 *   - Detect mismatches and set shapeMismatch = true (not crash)
 *   - Emit mismatch events for banner display
 *   - Extract correlation IDs from headers / body
 *
 * @regression
 */

import {
  guardListResponse,
  guardRecordResponse,
  extractCorrelationId,
  onShapeMismatch,
  ShapeMismatchEvent,
} from '../apiResponseGuard';

/* ------------------------------------------------------------------ */
/* guardListResponse                                                   */
/* ------------------------------------------------------------------ */

describe('guardListResponse', () => {
  describe('valid LIST-CONTRACT shapes', () => {
    it('should accept { items: [...], total } (standard LIST-CONTRACT)', () => {
      const data = { items: [{ id: '1' }, { id: '2' }], total: 2, page: 1, pageSize: 20, totalPages: 1 };
      const result = guardListResponse<{ id: string }>(data, 'TestScreen');

      expect(result.shapeMismatch).toBe(false);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.mismatchDetail).toBe('');
    });

    it('should accept flat array', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = guardListResponse<{ id: string }>(data, 'TestScreen');

      expect(result.shapeMismatch).toBe(false);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should unwrap NestJS envelope { success: true, data: { items: [...] } }', () => {
      const data = {
        success: true,
        data: { items: [{ id: '1' }], total: 1, page: 1, pageSize: 20, totalPages: 1 },
      };
      const result = guardListResponse<{ id: string }>(data, 'TestScreen');

      expect(result.shapeMismatch).toBe(false);
      expect(result.items).toHaveLength(1);
    });

    it('should unwrap NestJS envelope with flat array', () => {
      const data = { success: true, data: [{ id: '1' }] };
      const result = guardListResponse<{ id: string }>(data, 'TestScreen');

      expect(result.shapeMismatch).toBe(false);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('unexpected shapes (mismatch detection)', () => {
    it('should detect null and return empty items with shapeMismatch=true', () => {
      const result = guardListResponse<{ id: string }>(null, 'ChangeList');

      expect(result.shapeMismatch).toBe(true);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.mismatchDetail).toContain('ChangeList');
    });

    it('should detect undefined and return empty items with shapeMismatch=true', () => {
      const result = guardListResponse<{ id: string }>(undefined, 'CmdbList');

      expect(result.shapeMismatch).toBe(true);
      expect(result.items).toEqual([]);
    });

    it('should detect string response and return empty items', () => {
      const result = guardListResponse<{ id: string }>('error' as unknown, 'TestScreen');

      expect(result.shapeMismatch).toBe(true);
      expect(result.items).toEqual([]);
    });

    it('should detect number response and return empty items', () => {
      const result = guardListResponse<{ id: string }>(42 as unknown, 'TestScreen');

      expect(result.shapeMismatch).toBe(true);
      expect(result.items).toEqual([]);
    });

    it('should detect object without items key', () => {
      const data = { id: '1', name: 'Not a list' };
      const result = guardListResponse<{ id: string }>(data, 'TestScreen');

      expect(result.shapeMismatch).toBe(true);
      expect(result.items).toEqual([]);
    });
  });

  describe('correlation ID passthrough', () => {
    it('should include correlation ID when provided', () => {
      const result = guardListResponse<{ id: string }>(
        null,
        'TestScreen',
        'corr-123',
      );

      expect(result.correlationId).toBe('corr-123');
    });

    it('should default to null when no correlation ID', () => {
      const result = guardListResponse<{ id: string }>(
        { items: [], total: 0 },
        'TestScreen',
      );

      expect(result.correlationId).toBeNull();
    });
  });
});

/* ------------------------------------------------------------------ */
/* guardRecordResponse                                                 */
/* ------------------------------------------------------------------ */

describe('guardRecordResponse', () => {
  describe('valid RECORD-CONTRACT shapes', () => {
    it('should accept plain object', () => {
      const data = { id: '1', name: 'Test', status: 'active' };
      const result = guardRecordResponse<typeof data>(data, 'ChangeDetail');

      expect(result.shapeMismatch).toBe(false);
      expect(result.data).toEqual(data);
    });

    it('should unwrap NestJS envelope', () => {
      const data = { success: true, data: { id: '1', name: 'Test' } };
      const result = guardRecordResponse<{ id: string; name: string }>(data, 'ChangeDetail');

      expect(result.shapeMismatch).toBe(false);
      expect(result.data).toEqual({ id: '1', name: 'Test' });
    });

    it('should validate required keys when specified', () => {
      const data = { id: '1', name: 'Test', status: 'active' };
      const result = guardRecordResponse<typeof data>(data, 'ChangeDetail', ['id', 'status']);

      expect(result.shapeMismatch).toBe(false);
      expect(result.data).toEqual(data);
    });
  });

  describe('unexpected shapes (mismatch detection)', () => {
    it('should detect null and return null data with shapeMismatch=true', () => {
      const result = guardRecordResponse<{ id: string }>(null, 'ChangeDetail');

      expect(result.shapeMismatch).toBe(true);
      expect(result.data).toBeNull();
      expect(result.mismatchDetail).toContain('ChangeDetail');
    });

    it('should detect array (expected record, got list)', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = guardRecordResponse<{ id: string }>(data, 'ChangeDetail');

      expect(result.shapeMismatch).toBe(true);
      expect(result.data).toBeNull();
      expect(result.mismatchDetail).toContain('array');
    });

    it('should detect missing required keys', () => {
      const data = { id: '1', name: 'Test' };
      const result = guardRecordResponse<{ id: string }>(data, 'ChangeDetail', ['id', 'status', 'type']);

      expect(result.shapeMismatch).toBe(true);
      expect(result.data).toBeNull();
      expect(result.mismatchDetail).toContain('status');
      expect(result.mismatchDetail).toContain('type');
    });

    it('should detect string response', () => {
      const result = guardRecordResponse<{ id: string }>('error' as unknown, 'TestScreen');

      expect(result.shapeMismatch).toBe(true);
      expect(result.data).toBeNull();
    });
  });
});

/* ------------------------------------------------------------------ */
/* extractCorrelationId                                                */
/* ------------------------------------------------------------------ */

describe('extractCorrelationId', () => {
  it('should extract x-correlation-id from headers', () => {
    expect(extractCorrelationId({ 'x-correlation-id': 'abc-123' })).toBe('abc-123');
  });

  it('should extract x-request-id from headers', () => {
    expect(extractCorrelationId({ 'x-request-id': 'req-456' })).toBe('req-456');
  });

  it('should extract correlationId from body', () => {
    expect(extractCorrelationId(null, { correlationId: 'body-789' })).toBe('body-789');
  });

  it('should prefer headers over body', () => {
    expect(
      extractCorrelationId(
        { 'x-correlation-id': 'header-1' },
        { correlationId: 'body-2' },
      ),
    ).toBe('header-1');
  });

  it('should return null when nothing found', () => {
    expect(extractCorrelationId(null, null)).toBeNull();
    expect(extractCorrelationId({}, {})).toBeNull();
    expect(extractCorrelationId()).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Mismatch event bus                                                  */
/* ------------------------------------------------------------------ */

describe('onShapeMismatch (event bus)', () => {
  it('should emit mismatch events when guard detects unexpected shape', () => {
    const events: ShapeMismatchEvent[] = [];
    const unsub = onShapeMismatch((e) => events.push(e));

    guardListResponse(null, 'ChangeList', 'corr-test');

    expect(events).toHaveLength(1);
    expect(events[0].screen).toBe('ChangeList');
    expect(events[0].correlationId).toBe('corr-test');
    expect(events[0].expected).toContain('LIST-CONTRACT');

    unsub();
  });

  it('should NOT emit events for valid shapes', () => {
    const events: ShapeMismatchEvent[] = [];
    const unsub = onShapeMismatch((e) => events.push(e));

    guardListResponse({ items: [{ id: '1' }], total: 1 }, 'TestScreen');

    expect(events).toHaveLength(0);

    unsub();
  });

  it('should support unsubscribe', () => {
    const events: ShapeMismatchEvent[] = [];
    const unsub = onShapeMismatch((e) => events.push(e));

    unsub(); // Unsubscribe immediately

    guardListResponse(null, 'TestScreen');

    expect(events).toHaveLength(0);
  });
});
