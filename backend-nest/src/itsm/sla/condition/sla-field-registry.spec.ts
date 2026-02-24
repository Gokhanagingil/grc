import { slaFieldRegistry } from './sla-field-registry';

describe('SlaFieldRegistry — CHANGE_TASK support', () => {
  it('should return fields for CHANGE_TASK record type', () => {
    const fields = slaFieldRegistry.getFieldsForRecordType('CHANGE_TASK');
    expect(fields.length).toBeGreaterThan(0);
  });

  it('should include direct task fields', () => {
    const fields = slaFieldRegistry.getFieldsForRecordType('CHANGE_TASK');
    const keys = fields.map((f) => f.key);
    expect(keys).toContain('priority');
    expect(keys).toContain('status');
    expect(keys).toContain('taskType');
    expect(keys).toContain('assignmentGroupId');
    expect(keys).toContain('assigneeId');
    expect(keys).toContain('isBlocking');
    expect(keys).toContain('stageLabel');
    expect(keys).toContain('sourceTemplateId');
  });

  it('should include derived parent change fields (dot-walk)', () => {
    const fields = slaFieldRegistry.getFieldsForRecordType('CHANGE_TASK');
    const keys = fields.map((f) => f.key);
    expect(keys).toContain('change.type');
    expect(keys).toContain('change.risk');
    expect(keys).toContain('change.serviceId');
    expect(keys).toContain('change.state');
  });

  it('should still return INCIDENT fields', () => {
    const fields = slaFieldRegistry.getFieldsForRecordType('INCIDENT');
    expect(fields.length).toBeGreaterThan(0);
    const keys = fields.map((f) => f.key);
    expect(keys).toContain('priority');
    expect(keys).toContain('impact');
    expect(keys).toContain('urgency');
  });

  it('should share common fields between INCIDENT and CHANGE_TASK', () => {
    const incFields = slaFieldRegistry.getFieldsForRecordType('INCIDENT');
    const ctFields = slaFieldRegistry.getFieldsForRecordType('CHANGE_TASK');
    const incKeys = new Set(incFields.map((f) => f.key));
    const ctKeys = new Set(ctFields.map((f) => f.key));
    // 'priority' and 'status' should exist in both
    expect(incKeys.has('priority')).toBe(true);
    expect(ctKeys.has('priority')).toBe(true);
    expect(incKeys.has('status')).toBe(true);
    expect(ctKeys.has('status')).toBe(true);
  });

  it('should return empty array for unknown record type', () => {
    const fields = slaFieldRegistry.getFieldsForRecordType('UNKNOWN_TYPE');
    expect(fields).toEqual([]);
  });

  it('should allow operators for known fields', () => {
    const allowed = slaFieldRegistry.isOperatorAllowed('priority', 'is');
    expect(allowed).toBe(true);
  });

  it('should reject unknown operators', () => {
    const allowed = slaFieldRegistry.isOperatorAllowed(
      'priority',
      'matches_regex',
    );
    expect(allowed).toBe(false);
  });

  it('isBlocking field should support is/is_not operators', () => {
    const field = slaFieldRegistry.getField('isBlocking');
    expect(field).toBeDefined();
    expect(field!.allowedOperators).toContain('is');
    expect(field!.allowedOperators).toContain('is_not');
    expect(field!.valueType).toBe('boolean');
  });
});
