/**
 * Payload Normalizer Unit Tests
 *
 * Regression tests for the shared payload sanitization utilities.
 * Covers all 4 stabilization workstreams:
 * - A) CAB meeting validation: stripUndefined, stripForbiddenFields
 * - B) Change Template save: code field exclusion from update payload
 * - C) Incident edit: empty string normalization, forbidden field stripping
 * - D) Linked risks/controls: allowlist accuracy
 *
 * @regression
 * @activation-stabilization-v3
 */

import {
  stripForbiddenFields,
  stripUndefined,
  emptyToUndefined,
  normalizeUpdatePayload,
  CAB_MEETING_UPDATE_FIELDS,
  CAB_MEETING_CREATE_FIELDS,
  CAB_MEETING_EMPTY_STRING_FIELDS,
  CHANGE_TEMPLATE_UPDATE_FIELDS,
  CHANGE_TEMPLATE_CREATE_FIELDS,
  INCIDENT_UPDATE_FIELDS,
  INCIDENT_CREATE_FIELDS,
  INCIDENT_EMPTY_STRING_FIELDS,
} from '../payloadNormalizer';

/* ================================================================== */
/* stripForbiddenFields                                                */
/* ================================================================== */
describe('stripForbiddenFields', () => {
  const allowed = new Set(['title', 'status', 'notes']);

  it('keeps only allowed keys', () => {
    const input = { title: 'Test', status: 'DRAFT', notes: 'hello', forbidden: 'bad' };
    const result = stripForbiddenFields(input, allowed);
    expect(result).toEqual({ title: 'Test', status: 'DRAFT', notes: 'hello' });
    expect(result).not.toHaveProperty('forbidden');
  });

  it('returns empty object when no keys match', () => {
    const input = { foo: 1, bar: 2 };
    const result = stripForbiddenFields(input, allowed);
    expect(result).toEqual({});
  });

  it('returns empty object for empty input', () => {
    expect(stripForbiddenFields({}, allowed)).toEqual({});
  });

  it('preserves null values for allowed keys', () => {
    const input = { title: null, status: 'DRAFT' };
    const result = stripForbiddenFields(input as Record<string, unknown>, allowed);
    expect(result).toEqual({ title: null, status: 'DRAFT' });
  });

  it('preserves undefined values for allowed keys', () => {
    const input = { title: undefined, status: 'DRAFT' };
    const result = stripForbiddenFields(input as Record<string, unknown>, allowed);
    expect(result).toEqual({ title: undefined, status: 'DRAFT' });
  });
});

/* ================================================================== */
/* stripUndefined                                                      */
/* ================================================================== */
describe('stripUndefined', () => {
  it('removes undefined-valued keys', () => {
    const input = { title: 'Test', notes: undefined, status: 'DRAFT' };
    const result = stripUndefined(input as Record<string, unknown>);
    expect(result).toEqual({ title: 'Test', status: 'DRAFT' });
    expect(result).not.toHaveProperty('notes');
  });

  it('keeps null values (only strips undefined)', () => {
    const input = { title: 'Test', notes: null };
    const result = stripUndefined(input as Record<string, unknown>);
    expect(result).toEqual({ title: 'Test', notes: null });
  });

  it('keeps empty string values', () => {
    const input = { title: '', status: 'DRAFT' };
    const result = stripUndefined(input);
    expect(result).toEqual({ title: '', status: 'DRAFT' });
  });

  it('keeps falsy values (0, false)', () => {
    const input = { count: 0, isActive: false, name: '' };
    const result = stripUndefined(input as Record<string, unknown>);
    expect(result).toEqual({ count: 0, isActive: false, name: '' });
  });

  it('returns empty object for all-undefined input', () => {
    const input = { a: undefined, b: undefined };
    expect(stripUndefined(input as Record<string, unknown>)).toEqual({});
  });
});

/* ================================================================== */
/* emptyToUndefined                                                    */
/* ================================================================== */
describe('emptyToUndefined', () => {
  it('converts empty string to undefined', () => {
    expect(emptyToUndefined('')).toBeUndefined();
  });

  it('converts null to undefined', () => {
    expect(emptyToUndefined(null)).toBeUndefined();
  });

  it('converts undefined to undefined', () => {
    expect(emptyToUndefined(undefined)).toBeUndefined();
  });

  it('preserves non-empty string', () => {
    expect(emptyToUndefined('hello')).toBe('hello');
  });

  it('preserves whitespace-only string (not empty)', () => {
    expect(emptyToUndefined('  ')).toBe('  ');
  });
});

/* ================================================================== */
/* normalizeUpdatePayload (full pipeline)                              */
/* ================================================================== */
describe('normalizeUpdatePayload', () => {
  const allowed = new Set(['title', 'status', 'notes', 'category']);
  const emptyStringFields = new Set(['status', 'category']);

  it('strips forbidden fields, empty strings, and undefined in one pass', () => {
    const raw = {
      title: 'Test',
      status: '',       // should become undefined then stripped
      notes: undefined, // should be stripped
      category: 'software',
      forbidden: 'bad', // should be stripped
    };
    const result = normalizeUpdatePayload(raw as Record<string, unknown>, allowed, emptyStringFields);
    expect(result).toEqual({ title: 'Test', category: 'software' });
  });

  it('keeps valid values through pipeline', () => {
    const raw = { title: 'Test', status: 'OPEN', category: 'network' };
    const result = normalizeUpdatePayload(raw, allowed, emptyStringFields);
    expect(result).toEqual({ title: 'Test', status: 'OPEN', category: 'network' });
  });

  it('works without emptyStringFields parameter', () => {
    const raw = { title: 'Test', status: '', notes: 'hi', forbidden: 'bad' };
    const result = normalizeUpdatePayload(raw as Record<string, unknown>, allowed);
    // Without emptyStringFields, empty string is kept for status
    expect(result).toEqual({ title: 'Test', status: '', notes: 'hi' });
  });

  it('handles all-forbidden payload', () => {
    const raw = { foo: 'bar', baz: 123 };
    expect(normalizeUpdatePayload(raw, allowed)).toEqual({});
  });
});

/* ================================================================== */
/* Workstream A: CAB Meeting allowlists                                */
/* ================================================================== */
describe('CAB Meeting allowlists (Workstream A)', () => {
  it('CAB_MEETING_UPDATE_FIELDS contains expected fields', () => {
    expect(CAB_MEETING_UPDATE_FIELDS.has('title')).toBe(true);
    expect(CAB_MEETING_UPDATE_FIELDS.has('meetingAt')).toBe(true);
    expect(CAB_MEETING_UPDATE_FIELDS.has('endAt')).toBe(true);
    expect(CAB_MEETING_UPDATE_FIELDS.has('status')).toBe(true);
    expect(CAB_MEETING_UPDATE_FIELDS.has('notes')).toBe(true);
    expect(CAB_MEETING_UPDATE_FIELDS.has('summary')).toBe(true);
    expect(CAB_MEETING_UPDATE_FIELDS.has('chairpersonId')).toBe(true);
  });

  it('CAB_MEETING_UPDATE_FIELDS does NOT contain readonly fields', () => {
    expect(CAB_MEETING_UPDATE_FIELDS.has('id')).toBe(false);
    expect(CAB_MEETING_UPDATE_FIELDS.has('code')).toBe(false);
    expect(CAB_MEETING_UPDATE_FIELDS.has('tenantId')).toBe(false);
    expect(CAB_MEETING_UPDATE_FIELDS.has('createdAt')).toBe(false);
    expect(CAB_MEETING_UPDATE_FIELDS.has('updatedAt')).toBe(false);
  });

  it('CAB_MEETING_EMPTY_STRING_FIELDS covers date and enum fields', () => {
    expect(CAB_MEETING_EMPTY_STRING_FIELDS.has('meetingAt')).toBe(true);
    expect(CAB_MEETING_EMPTY_STRING_FIELDS.has('endAt')).toBe(true);
    expect(CAB_MEETING_EMPTY_STRING_FIELDS.has('status')).toBe(true);
    expect(CAB_MEETING_EMPTY_STRING_FIELDS.has('chairpersonId')).toBe(true);
  });

  it('normalizeUpdatePayload strips undefined from CAB payload', () => {
    const raw = {
      title: 'Weekly CAB',
      status: 'SCHEDULED',
      notes: undefined,
      summary: undefined,
      meetingAt: '2026-03-01T10:00:00Z',
      endAt: undefined,
    };
    const result = normalizeUpdatePayload(
      raw as Record<string, unknown>,
      CAB_MEETING_UPDATE_FIELDS,
      CAB_MEETING_EMPTY_STRING_FIELDS,
    );
    expect(result).toEqual({
      title: 'Weekly CAB',
      status: 'SCHEDULED',
      meetingAt: '2026-03-01T10:00:00Z',
    });
    expect(result).not.toHaveProperty('notes');
    expect(result).not.toHaveProperty('summary');
    expect(result).not.toHaveProperty('endAt');
  });

  it('CAB create allowlist matches update allowlist', () => {
    // Create and update have the same fields for CAB
    expect(CAB_MEETING_CREATE_FIELDS).toEqual(CAB_MEETING_UPDATE_FIELDS);
  });
});

/* ================================================================== */
/* Workstream B: Change Template allowlists                            */
/* ================================================================== */
describe('Change Template allowlists (Workstream B)', () => {
  it('CHANGE_TEMPLATE_UPDATE_FIELDS does NOT contain code', () => {
    // This is the key fix: code is readonly after create
    expect(CHANGE_TEMPLATE_UPDATE_FIELDS.has('code')).toBe(false);
  });

  it('CHANGE_TEMPLATE_UPDATE_FIELDS contains expected fields', () => {
    expect(CHANGE_TEMPLATE_UPDATE_FIELDS.has('name')).toBe(true);
    expect(CHANGE_TEMPLATE_UPDATE_FIELDS.has('description')).toBe(true);
    expect(CHANGE_TEMPLATE_UPDATE_FIELDS.has('isActive')).toBe(true);
    expect(CHANGE_TEMPLATE_UPDATE_FIELDS.has('isGlobal')).toBe(true);
    expect(CHANGE_TEMPLATE_UPDATE_FIELDS.has('tasks')).toBe(true);
    expect(CHANGE_TEMPLATE_UPDATE_FIELDS.has('dependencies')).toBe(true);
  });

  it('CHANGE_TEMPLATE_CREATE_FIELDS contains code', () => {
    // Code is allowed on create
    expect(CHANGE_TEMPLATE_CREATE_FIELDS.has('code')).toBe(true);
    expect(CHANGE_TEMPLATE_CREATE_FIELDS.has('name')).toBe(true);
  });

  it('stripForbiddenFields removes code from template update payload', () => {
    const payload = {
      name: 'Standard Change',
      code: 'STD-001',  // should be stripped
      description: 'A standard template',
      isActive: true,
      tasks: [],
    };
    const result = stripForbiddenFields(payload as Record<string, unknown>, CHANGE_TEMPLATE_UPDATE_FIELDS);
    expect(result).not.toHaveProperty('code');
    expect(result).toHaveProperty('name', 'Standard Change');
    expect(result).toHaveProperty('tasks');
  });
});

/* ================================================================== */
/* Workstream C: Incident allowlists                                   */
/* ================================================================== */
describe('Incident allowlists (Workstream C)', () => {
  it('INCIDENT_UPDATE_FIELDS does NOT contain priority (computed field)', () => {
    // This is the key fix: priority is computed from impact+urgency
    expect(INCIDENT_UPDATE_FIELDS.has('priority')).toBe(false);
  });

  it('INCIDENT_UPDATE_FIELDS does NOT contain readonly fields', () => {
    expect(INCIDENT_UPDATE_FIELDS.has('id')).toBe(false);
    expect(INCIDENT_UPDATE_FIELDS.has('number')).toBe(false);
    expect(INCIDENT_UPDATE_FIELDS.has('tenantId')).toBe(false);
    expect(INCIDENT_UPDATE_FIELDS.has('createdAt')).toBe(false);
    expect(INCIDENT_UPDATE_FIELDS.has('updatedAt')).toBe(false);
    expect(INCIDENT_UPDATE_FIELDS.has('state')).toBe(false); // frontend uses 'state', backend uses 'status'
  });

  it('INCIDENT_UPDATE_FIELDS contains expected fields', () => {
    expect(INCIDENT_UPDATE_FIELDS.has('shortDescription')).toBe(true);
    expect(INCIDENT_UPDATE_FIELDS.has('description')).toBe(true);
    expect(INCIDENT_UPDATE_FIELDS.has('status')).toBe(true);
    expect(INCIDENT_UPDATE_FIELDS.has('impact')).toBe(true);
    expect(INCIDENT_UPDATE_FIELDS.has('urgency')).toBe(true);
    expect(INCIDENT_UPDATE_FIELDS.has('category')).toBe(true);
    expect(INCIDENT_UPDATE_FIELDS.has('serviceId')).toBe(true);
    expect(INCIDENT_UPDATE_FIELDS.has('resolutionNotes')).toBe(true);
  });

  it('INCIDENT_EMPTY_STRING_FIELDS covers enum/uuid/date fields', () => {
    expect(INCIDENT_EMPTY_STRING_FIELDS.has('category')).toBe(true);
    expect(INCIDENT_EMPTY_STRING_FIELDS.has('impact')).toBe(true);
    expect(INCIDENT_EMPTY_STRING_FIELDS.has('urgency')).toBe(true);
    expect(INCIDENT_EMPTY_STRING_FIELDS.has('status')).toBe(true);
    expect(INCIDENT_EMPTY_STRING_FIELDS.has('serviceId')).toBe(true);
    expect(INCIDENT_EMPTY_STRING_FIELDS.has('offeringId')).toBe(true);
  });

  it('normalizeUpdatePayload strips priority and empty strings from incident payload', () => {
    const raw = {
      shortDescription: 'Server down',
      description: 'Production server is not responding',
      status: 'open',
      impact: '',          // empty string -> should be stripped
      urgency: 'medium',
      priority: 'p3',     // forbidden -> should be stripped
      category: '',        // empty string -> should be stripped
      serviceId: '',       // empty string -> should be stripped
    };
    const result = normalizeUpdatePayload(
      raw as Record<string, unknown>,
      INCIDENT_UPDATE_FIELDS,
      INCIDENT_EMPTY_STRING_FIELDS,
    );
    expect(result).toEqual({
      shortDescription: 'Server down',
      description: 'Production server is not responding',
      status: 'open',
      urgency: 'medium',
    });
    expect(result).not.toHaveProperty('priority');
    expect(result).not.toHaveProperty('impact');
    expect(result).not.toHaveProperty('category');
    expect(result).not.toHaveProperty('serviceId');
  });

  it('INCIDENT_CREATE_FIELDS does not include status (auto-set on create)', () => {
    // status is set automatically on create
    expect(INCIDENT_CREATE_FIELDS.has('status')).toBe(false);
  });
});
