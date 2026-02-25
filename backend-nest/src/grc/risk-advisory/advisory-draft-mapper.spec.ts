import 'reflect-metadata';
import { CapaType, CAPAPriority } from '../enums';
import { SuggestedRecordType, MitigationTimeframe } from './dto/advisory.dto';
import type { SuggestedRecord } from './dto/advisory.dto';
import {
  resolveCapaType,
  resolveCapaPriority,
  isValidCapaType,
  isValidCapaPriority,
  buildCapaDraftPayload,
  resolveEffectiveTargetType,
  AdvisoryCapaSemantic,
} from './advisory-draft-mapper';

// ============================================================================
// resolveCapaType
// ============================================================================

describe('resolveCapaType', () => {
  it('maps UPPERCASE "CORRECTIVE" to lowercase CapaType.CORRECTIVE', () => {
    expect(resolveCapaType('CORRECTIVE')).toBe(CapaType.CORRECTIVE);
    expect(resolveCapaType('CORRECTIVE')).toBe('corrective');
  });

  it('maps UPPERCASE "PREVENTIVE" to lowercase CapaType.PREVENTIVE', () => {
    expect(resolveCapaType('PREVENTIVE')).toBe(CapaType.PREVENTIVE);
    expect(resolveCapaType('PREVENTIVE')).toBe('preventive');
  });

  it('maps "BOTH" to CapaType.BOTH', () => {
    expect(resolveCapaType('BOTH')).toBe(CapaType.BOTH);
    expect(resolveCapaType('BOTH')).toBe('both');
  });

  it('maps "CORRECTIVE_PREVENTIVE" to CapaType.BOTH', () => {
    expect(resolveCapaType('CORRECTIVE_PREVENTIVE')).toBe(CapaType.BOTH);
  });

  it('accepts already-lowercase DB values', () => {
    expect(resolveCapaType('corrective')).toBe(CapaType.CORRECTIVE);
    expect(resolveCapaType('preventive')).toBe(CapaType.PREVENTIVE);
    expect(resolveCapaType('both')).toBe(CapaType.BOTH);
  });

  it('handles mixed case', () => {
    expect(resolveCapaType('Corrective')).toBe(CapaType.CORRECTIVE);
    expect(resolveCapaType('Preventive')).toBe(CapaType.PREVENTIVE);
  });

  it('returns default CORRECTIVE for undefined/null/empty', () => {
    expect(resolveCapaType(undefined)).toBe(CapaType.CORRECTIVE);
    expect(resolveCapaType(null)).toBe(CapaType.CORRECTIVE);
    expect(resolveCapaType('')).toBe(CapaType.CORRECTIVE);
    expect(resolveCapaType('  ')).toBe(CapaType.CORRECTIVE);
  });

  it('returns null for unknown string values', () => {
    expect(resolveCapaType('UNKNOWN')).toBeNull();
    expect(resolveCapaType('invalid')).toBeNull();
  });

  it('returns default CORRECTIVE for non-string types (number, boolean)', () => {
    // Non-string values are treated as missing — default to CORRECTIVE
    expect(resolveCapaType(123)).toBe(CapaType.CORRECTIVE);
    expect(resolveCapaType(true)).toBe(CapaType.CORRECTIVE);
  });
});

// ============================================================================
// resolveCapaPriority
// ============================================================================

describe('resolveCapaPriority', () => {
  it('maps HIGH to CAPAPriority.HIGH', () => {
    expect(resolveCapaPriority('HIGH')).toBe(CAPAPriority.HIGH);
  });

  it('maps MEDIUM to CAPAPriority.MEDIUM', () => {
    expect(resolveCapaPriority('MEDIUM')).toBe(CAPAPriority.MEDIUM);
  });

  it('maps LOW to CAPAPriority.LOW', () => {
    expect(resolveCapaPriority('LOW')).toBe(CAPAPriority.LOW);
  });

  it('maps CRITICAL to CAPAPriority.CRITICAL', () => {
    expect(resolveCapaPriority('CRITICAL')).toBe(CAPAPriority.CRITICAL);
  });

  it('handles lowercase input', () => {
    expect(resolveCapaPriority('high')).toBe(CAPAPriority.HIGH);
    expect(resolveCapaPriority('low')).toBe(CAPAPriority.LOW);
  });

  it('defaults to MEDIUM for undefined/unknown', () => {
    expect(resolveCapaPriority(undefined)).toBe(CAPAPriority.MEDIUM);
    expect(resolveCapaPriority('UNKNOWN')).toBe(CAPAPriority.MEDIUM);
  });
});

// ============================================================================
// isValidCapaType / isValidCapaPriority
// ============================================================================

describe('isValidCapaType', () => {
  it('returns true for valid CapaType values', () => {
    expect(isValidCapaType('corrective')).toBe(true);
    expect(isValidCapaType('preventive')).toBe(true);
    expect(isValidCapaType('both')).toBe(true);
  });

  it('returns false for UPPERCASE (invalid DB values)', () => {
    // This is the root cause bug — UPPERCASE values are NOT valid CapaType values
    expect(isValidCapaType('CORRECTIVE')).toBe(false);
    expect(isValidCapaType('PREVENTIVE')).toBe(false);
  });

  it('returns false for non-string/unknown values', () => {
    expect(isValidCapaType(null)).toBe(false);
    expect(isValidCapaType(undefined)).toBe(false);
    expect(isValidCapaType(123)).toBe(false);
    expect(isValidCapaType('invalid')).toBe(false);
  });
});

describe('isValidCapaPriority', () => {
  it('returns true for valid CAPAPriority values', () => {
    expect(isValidCapaPriority('HIGH')).toBe(true);
    expect(isValidCapaPriority('MEDIUM')).toBe(true);
    expect(isValidCapaPriority('LOW')).toBe(true);
    expect(isValidCapaPriority('CRITICAL')).toBe(true);
  });

  it('returns false for lowercase (invalid)', () => {
    expect(isValidCapaPriority('high')).toBe(false);
    expect(isValidCapaPriority('medium')).toBe(false);
  });
});

// ============================================================================
// resolveEffectiveTargetType
// ============================================================================

describe('resolveEffectiveTargetType', () => {
  it('maps TASK to CAPA (TASK creates CAPA in current architecture)', () => {
    expect(resolveEffectiveTargetType(SuggestedRecordType.TASK)).toBe(
      SuggestedRecordType.CAPA,
    );
  });

  it('keeps CAPA as CAPA', () => {
    expect(resolveEffectiveTargetType(SuggestedRecordType.CAPA)).toBe(
      SuggestedRecordType.CAPA,
    );
  });

  it('keeps CHANGE as CHANGE', () => {
    expect(resolveEffectiveTargetType(SuggestedRecordType.CHANGE)).toBe(
      SuggestedRecordType.CHANGE,
    );
  });

  it('keeps CONTROL_TEST as CONTROL_TEST', () => {
    expect(resolveEffectiveTargetType(SuggestedRecordType.CONTROL_TEST)).toBe(
      SuggestedRecordType.CONTROL_TEST,
    );
  });
});

// ============================================================================
// buildCapaDraftPayload
// ============================================================================

describe('buildCapaDraftPayload', () => {
  const makeSuggestedRecord = (
    overrides: Partial<SuggestedRecord> = {},
  ): SuggestedRecord => ({
    id: 'sr-001',
    type: SuggestedRecordType.CAPA,
    title: 'Implement corrective action for patching gap',
    description: 'Address the identified patching deficiency',
    priority: 'HIGH',
    timeframe: MitigationTimeframe.IMMEDIATE,
    templateData: { type: 'CORRECTIVE' },
    ...overrides,
  });

  it('produces valid payload for CORRECTIVE suggestion', () => {
    const record = makeSuggestedRecord({
      templateData: { type: 'CORRECTIVE' },
    });
    const result = buildCapaDraftPayload(record);

    expect('payload' in result).toBe(true);
    if ('payload' in result) {
      expect(result.payload.type).toBe(CapaType.CORRECTIVE);
      expect(result.payload.type).toBe('corrective');
      expect(result.payload.priority).toBe(CAPAPriority.HIGH);
      expect(result.payload.title).toBe(record.title);
      expect(result.payload.description).toBe(record.description);
      expect(result.payload.metadata.advisorySource).toBe(
        'risk-advisory-pack-v1',
      );
      expect(result.payload.metadata.suggestedRecordId).toBe('sr-001');
    }
  });

  it('produces valid payload for PREVENTIVE suggestion', () => {
    const record = makeSuggestedRecord({
      templateData: { type: 'PREVENTIVE' },
    });
    const result = buildCapaDraftPayload(record);

    expect('payload' in result).toBe(true);
    if ('payload' in result) {
      expect(result.payload.type).toBe(CapaType.PREVENTIVE);
      expect(result.payload.type).toBe('preventive');
    }
  });

  it('uses titleOverride and descriptionOverride when provided', () => {
    const record = makeSuggestedRecord();
    const result = buildCapaDraftPayload(record, 'Custom Title', 'Custom Desc');

    expect('payload' in result).toBe(true);
    if ('payload' in result) {
      expect(result.payload.title).toBe('Custom Title');
      expect(result.payload.description).toBe('Custom Desc');
    }
  });

  it('defaults to CORRECTIVE when templateData.type is missing', () => {
    const record = makeSuggestedRecord({ templateData: {} });
    const result = buildCapaDraftPayload(record);

    expect('payload' in result).toBe(true);
    if ('payload' in result) {
      expect(result.payload.type).toBe(CapaType.CORRECTIVE);
    }
  });

  it('returns error for unsupported CAPA type', () => {
    const record = makeSuggestedRecord({
      templateData: { type: 'UNSUPPORTED_TYPE' },
    });
    const result = buildCapaDraftPayload(record);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.errorCode).toBe('INVALID_CAPA_TYPE');
      expect(result.error).toContain('Unsupported CAPA type');
    }
  });

  it('maps priority correctly for each level', () => {
    for (const [input, expected] of [
      ['HIGH', CAPAPriority.HIGH],
      ['MEDIUM', CAPAPriority.MEDIUM],
      ['LOW', CAPAPriority.LOW],
    ] as const) {
      const record = makeSuggestedRecord({ priority: input });
      const result = buildCapaDraftPayload(record);

      expect('payload' in result).toBe(true);
      if ('payload' in result) {
        expect(result.payload.priority).toBe(expected);
      }
    }
  });

  it('handles TASK type suggestions (routed to CAPA)', () => {
    const record = makeSuggestedRecord({
      type: SuggestedRecordType.TASK,
      templateData: { type: 'CORRECTIVE' },
    });
    const result = buildCapaDraftPayload(record);

    expect('payload' in result).toBe(true);
    if ('payload' in result) {
      expect(result.payload.type).toBe(CapaType.CORRECTIVE);
      expect(result.payload.metadata.advisoryRecordType).toBe('TASK');
    }
  });
});

// ============================================================================
// Error attribution: CAPA failure must NOT be labeled as Task
// ============================================================================

describe('error attribution accuracy', () => {
  it('TASK suggestion resolves to CAPA target type for error reporting', () => {
    // When a TASK suggestion fails during CAPA creation, the error must
    // identify the target as CAPA, not Task, to avoid confusion
    const effectiveTarget = resolveEffectiveTargetType(
      SuggestedRecordType.TASK,
    );
    expect(effectiveTarget).toBe(SuggestedRecordType.CAPA);
    expect(effectiveTarget).not.toBe(SuggestedRecordType.TASK);
  });

  it('CAPA suggestion keeps CAPA as target type', () => {
    const effectiveTarget = resolveEffectiveTargetType(
      SuggestedRecordType.CAPA,
    );
    expect(effectiveTarget).toBe(SuggestedRecordType.CAPA);
  });
});

// ============================================================================
// AdvisoryCapaSemantic enum coverage
// ============================================================================

describe('AdvisoryCapaSemantic', () => {
  it('has all expected semantic values', () => {
    expect(AdvisoryCapaSemantic.CORRECTIVE).toBe('CORRECTIVE');
    expect(AdvisoryCapaSemantic.PREVENTIVE).toBe('PREVENTIVE');
    expect(AdvisoryCapaSemantic.CORRECTIVE_PREVENTIVE).toBe(
      'CORRECTIVE_PREVENTIVE',
    );
    expect(AdvisoryCapaSemantic.BOTH).toBe('BOTH');
  });

  it('all semantics map to valid CapaType values', () => {
    for (const semantic of Object.values(AdvisoryCapaSemantic)) {
      const resolved = resolveCapaType(semantic);
      expect(resolved).not.toBeNull();
      expect(isValidCapaType(resolved)).toBe(true);
    }
  });
});
