import {
  normalizeAuditPermissions,
  normalizeFinding,
  normalizeFindings,
  normalizeAuditRequirements,
  normalizeAuditReports,
  normalizeAvailableRequirements,
  normalizeAuditRelatedData,
} from '../audit';

describe('Audit Normalizers', () => {
  describe('normalizeAuditPermissions', () => {
    it('returns default permissions for undefined input', () => {
      const result = normalizeAuditPermissions(undefined);
      expect(result).toEqual({
        read: true,
        write: false,
        delete: false,
        maskedFields: [],
        deniedFields: [],
      });
    });

    it('returns default permissions for null input', () => {
      const result = normalizeAuditPermissions(null);
      expect(result).toEqual({
        read: true,
        write: false,
        delete: false,
        maskedFields: [],
        deniedFields: [],
      });
    });

    it('returns default permissions for empty object input', () => {
      const result = normalizeAuditPermissions({});
      expect(result).toEqual({
        read: true,
        write: false,
        delete: false,
        maskedFields: [],
        deniedFields: [],
      });
    });

    it('returns default permissions for non-object input (string)', () => {
      const result = normalizeAuditPermissions('invalid');
      expect(result).toEqual({
        read: true,
        write: false,
        delete: false,
        maskedFields: [],
        deniedFields: [],
      });
    });

    it('returns default permissions for non-object input (number)', () => {
      const result = normalizeAuditPermissions(123);
      expect(result).toEqual({
        read: true,
        write: false,
        delete: false,
        maskedFields: [],
        deniedFields: [],
      });
    });

    it('normalizes permissions with missing array fields', () => {
      const input = {
        read: true,
        write: true,
        delete: false,
      };
      const result = normalizeAuditPermissions(input);
      expect(result.maskedFields).toEqual([]);
      expect(result.deniedFields).toEqual([]);
    });

    it('normalizes permissions with undefined array fields', () => {
      const input = {
        read: true,
        write: true,
        delete: false,
        maskedFields: undefined,
        deniedFields: undefined,
      };
      const result = normalizeAuditPermissions(input);
      expect(result.maskedFields).toEqual([]);
      expect(result.deniedFields).toEqual([]);
    });

    it('normalizes permissions with null array fields', () => {
      const input = {
        read: true,
        write: true,
        delete: false,
        maskedFields: null,
        deniedFields: null,
      };
      const result = normalizeAuditPermissions(input);
      expect(result.maskedFields).toEqual([]);
      expect(result.deniedFields).toEqual([]);
    });

    it('normalizes permissions with wrong type array fields (object instead of array)', () => {
      const input = {
        read: true,
        write: true,
        delete: false,
        maskedFields: { field: 'value' },
        deniedFields: { field: 'value' },
      };
      const result = normalizeAuditPermissions(input);
      expect(result.maskedFields).toEqual([]);
      expect(result.deniedFields).toEqual([]);
    });

    it('preserves valid array fields', () => {
      const input = {
        read: true,
        write: true,
        delete: true,
        maskedFields: ['field1', 'field2'],
        deniedFields: ['field3'],
      };
      const result = normalizeAuditPermissions(input);
      expect(result).toEqual({
        read: true,
        write: true,
        delete: true,
        maskedFields: ['field1', 'field2'],
        deniedFields: ['field3'],
      });
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeAuditPermissions(undefined)).not.toThrow();
      expect(() => normalizeAuditPermissions(null)).not.toThrow();
      expect(() => normalizeAuditPermissions({})).not.toThrow();
      expect(() => normalizeAuditPermissions('string')).not.toThrow();
      expect(() => normalizeAuditPermissions(123)).not.toThrow();
      expect(() => normalizeAuditPermissions([])).not.toThrow();
      expect(() => normalizeAuditPermissions(true)).not.toThrow();
    });
  });

  describe('normalizeFinding', () => {
    it('returns null for undefined input', () => {
      const result = normalizeFinding(undefined);
      expect(result).toBeNull();
    });

    it('returns null for null input', () => {
      const result = normalizeFinding(null);
      expect(result).toBeNull();
    });

    it('returns null for non-object input', () => {
      expect(normalizeFinding('string')).toBeNull();
      expect(normalizeFinding(123)).toBeNull();
      expect(normalizeFinding(true)).toBeNull();
    });

    it('normalizes finding with missing nested arrays', () => {
      const input = {
        id: '1',
        auditId: 'audit-1',
        title: 'Test Finding',
        type: 'observation',
        severity: 'medium',
        status: 'open',
        createdAt: '2024-01-01',
      };
      const result = normalizeFinding(input);
      expect(result).not.toBeNull();
      expect(result!.capas).toEqual([]);
      expect(result!.issueRequirements).toEqual([]);
    });

    it('normalizes finding with undefined nested arrays', () => {
      const input = {
        id: '1',
        auditId: 'audit-1',
        title: 'Test Finding',
        type: 'observation',
        severity: 'medium',
        status: 'open',
        createdAt: '2024-01-01',
        capas: undefined,
        issueRequirements: undefined,
      };
      const result = normalizeFinding(input);
      expect(result).not.toBeNull();
      expect(result!.capas).toEqual([]);
      expect(result!.issueRequirements).toEqual([]);
    });

    it('normalizes finding with null nested arrays', () => {
      const input = {
        id: '1',
        auditId: 'audit-1',
        title: 'Test Finding',
        type: 'observation',
        severity: 'medium',
        status: 'open',
        createdAt: '2024-01-01',
        capas: null,
        issueRequirements: null,
      };
      const result = normalizeFinding(input);
      expect(result).not.toBeNull();
      expect(result!.capas).toEqual([]);
      expect(result!.issueRequirements).toEqual([]);
    });

    it('normalizes finding with wrong type nested arrays (object instead of array)', () => {
      const input = {
        id: '1',
        auditId: 'audit-1',
        title: 'Test Finding',
        type: 'observation',
        severity: 'medium',
        status: 'open',
        createdAt: '2024-01-01',
        capas: { id: '1' },
        issueRequirements: { id: '1', requirementId: 'req-1' },
      };
      const result = normalizeFinding(input);
      expect(result).not.toBeNull();
      expect(result!.capas).toEqual([]);
      expect(result!.issueRequirements).toEqual([]);
    });

    it('preserves valid nested arrays', () => {
      const input = {
        id: '1',
        auditId: 'audit-1',
        title: 'Test Finding',
        type: 'observation',
        severity: 'medium',
        status: 'open',
        createdAt: '2024-01-01',
        capas: [{ id: 'capa-1' }],
        issueRequirements: [{ id: 'ir-1', requirementId: 'req-1' }],
      };
      const result = normalizeFinding(input);
      expect(result).not.toBeNull();
      expect(result!.capas).toEqual([{ id: 'capa-1' }]);
      expect(result!.issueRequirements).toEqual([{ id: 'ir-1', requirementId: 'req-1' }]);
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeFinding(undefined)).not.toThrow();
      expect(() => normalizeFinding(null)).not.toThrow();
      expect(() => normalizeFinding({})).not.toThrow();
      expect(() => normalizeFinding('string')).not.toThrow();
      expect(() => normalizeFinding(123)).not.toThrow();
    });
  });

  describe('normalizeFindings', () => {
    it('returns empty array for undefined input', () => {
      const result = normalizeFindings(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty array for null input', () => {
      const result = normalizeFindings(null);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty object input', () => {
      const result = normalizeFindings({});
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (string)', () => {
      const result = normalizeFindings('invalid');
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (number)', () => {
      const result = normalizeFindings(123);
      expect(result).toEqual([]);
    });

    it('normalizes array of findings with nested arrays', () => {
      const input = [
        {
          id: '1',
          auditId: 'audit-1',
          title: 'Finding 1',
          type: 'observation',
          severity: 'medium',
          status: 'open',
          createdAt: '2024-01-01',
        },
        {
          id: '2',
          auditId: 'audit-1',
          title: 'Finding 2',
          type: 'non-conformity',
          severity: 'high',
          status: 'in_progress',
          createdAt: '2024-01-02',
          capas: [{ id: 'capa-1' }],
        },
      ];
      const result = normalizeFindings(input);
      expect(result).toHaveLength(2);
      expect(result[0].capas).toEqual([]);
      expect(result[0].issueRequirements).toEqual([]);
      expect(result[1].capas).toEqual([{ id: 'capa-1' }]);
      expect(result[1].issueRequirements).toEqual([]);
    });

    it('filters out invalid findings from array', () => {
      const input = [
        {
          id: '1',
          auditId: 'audit-1',
          title: 'Valid Finding',
          type: 'observation',
          severity: 'medium',
          status: 'open',
          createdAt: '2024-01-01',
        },
        null,
        undefined,
        'invalid',
      ];
      const result = normalizeFindings(input);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Valid Finding');
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeFindings(undefined)).not.toThrow();
      expect(() => normalizeFindings(null)).not.toThrow();
      expect(() => normalizeFindings({})).not.toThrow();
      expect(() => normalizeFindings('string')).not.toThrow();
      expect(() => normalizeFindings(123)).not.toThrow();
      expect(() => normalizeFindings([null, undefined, 'invalid'])).not.toThrow();
    });
  });

  describe('normalizeAuditRequirements', () => {
    it('returns empty array for undefined input', () => {
      const result = normalizeAuditRequirements(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty array for null input', () => {
      const result = normalizeAuditRequirements(null);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty object input', () => {
      const result = normalizeAuditRequirements({});
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (string)', () => {
      const result = normalizeAuditRequirements('invalid');
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (number)', () => {
      const result = normalizeAuditRequirements(123);
      expect(result).toEqual([]);
    });

    it('preserves valid array input', () => {
      const input = [
        { id: '1', auditId: 'audit-1', requirementId: 'req-1', status: 'planned', createdAt: '2024-01-01' },
        { id: '2', auditId: 'audit-1', requirementId: 'req-2', status: 'in_scope', createdAt: '2024-01-02' },
      ];
      const result = normalizeAuditRequirements(input);
      expect(result).toEqual(input);
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeAuditRequirements(undefined)).not.toThrow();
      expect(() => normalizeAuditRequirements(null)).not.toThrow();
      expect(() => normalizeAuditRequirements({})).not.toThrow();
      expect(() => normalizeAuditRequirements('string')).not.toThrow();
      expect(() => normalizeAuditRequirements(123)).not.toThrow();
    });
  });

  describe('normalizeAuditReports', () => {
    it('returns empty array for undefined input', () => {
      const result = normalizeAuditReports(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty array for null input', () => {
      const result = normalizeAuditReports(null);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty object input', () => {
      const result = normalizeAuditReports({});
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (string)', () => {
      const result = normalizeAuditReports('invalid');
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (number)', () => {
      const result = normalizeAuditReports(123);
      expect(result).toEqual([]);
    });

    it('preserves valid array input', () => {
      const input = [
        { id: 1, audit_id: 1, version: 1, status: 'draft', created_by: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, audit_id: 1, version: 2, status: 'final', created_by: 1, created_at: '2024-01-02', updated_at: '2024-01-02' },
      ];
      const result = normalizeAuditReports(input);
      expect(result).toEqual(input);
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeAuditReports(undefined)).not.toThrow();
      expect(() => normalizeAuditReports(null)).not.toThrow();
      expect(() => normalizeAuditReports({})).not.toThrow();
      expect(() => normalizeAuditReports('string')).not.toThrow();
      expect(() => normalizeAuditReports(123)).not.toThrow();
    });
  });

  describe('normalizeAvailableRequirements', () => {
    it('returns empty array for undefined input', () => {
      const result = normalizeAvailableRequirements(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty array for null input', () => {
      const result = normalizeAvailableRequirements(null);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty object input', () => {
      const result = normalizeAvailableRequirements({});
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (string)', () => {
      const result = normalizeAvailableRequirements('invalid');
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (number)', () => {
      const result = normalizeAvailableRequirements(123);
      expect(result).toEqual([]);
    });

    it('preserves valid array input', () => {
      const input = [
        { id: '1', framework: 'ISO27001', referenceCode: 'A.5.1', title: 'Policies for information security' },
        { id: '2', framework: 'SOC2', referenceCode: 'CC1.1', title: 'Control environment' },
      ];
      const result = normalizeAvailableRequirements(input);
      expect(result).toEqual(input);
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeAvailableRequirements(undefined)).not.toThrow();
      expect(() => normalizeAvailableRequirements(null)).not.toThrow();
      expect(() => normalizeAvailableRequirements({})).not.toThrow();
      expect(() => normalizeAvailableRequirements('string')).not.toThrow();
      expect(() => normalizeAvailableRequirements(123)).not.toThrow();
    });
  });

  describe('normalizeAuditRelatedData', () => {
    it('returns all empty arrays for undefined inputs', () => {
      const result = normalizeAuditRelatedData(undefined, undefined, undefined);
      expect(result).toEqual({
        findings: [],
        auditRequirements: [],
        reports: [],
      });
    });

    it('returns all empty arrays for null inputs', () => {
      const result = normalizeAuditRelatedData(null, null, null);
      expect(result).toEqual({
        findings: [],
        auditRequirements: [],
        reports: [],
      });
    });

    it('returns all empty arrays for empty object inputs', () => {
      const result = normalizeAuditRelatedData({}, {}, {});
      expect(result).toEqual({
        findings: [],
        auditRequirements: [],
        reports: [],
      });
    });

    it('normalizes mixed valid and invalid inputs', () => {
      const findings = [
        { id: '1', auditId: 'audit-1', title: 'Finding', type: 'obs', severity: 'medium', status: 'open', createdAt: '2024-01-01' },
      ];
      const requirements = [
        { id: '1', auditId: 'audit-1', requirementId: 'req-1', status: 'planned', createdAt: '2024-01-01' },
      ];
      
      const result = normalizeAuditRelatedData(findings, requirements, null);
      expect(result.findings).toHaveLength(1);
      expect(result.auditRequirements).toHaveLength(1);
      expect(result.reports).toEqual([]);
    });

    it('does not throw for any combination of malformed inputs', () => {
      expect(() => normalizeAuditRelatedData(undefined, null, {})).not.toThrow();
      expect(() => normalizeAuditRelatedData('string', 123, true)).not.toThrow();
      expect(() => normalizeAuditRelatedData([], [], [])).not.toThrow();
    });
  });

  describe('Regression: AuditDetail crash scenarios', () => {
    it('handles API returning undefined for all related data', () => {
      const result = normalizeAuditRelatedData(undefined, undefined, undefined);
      
      expect(result.findings).toEqual([]);
      expect(result.auditRequirements).toEqual([]);
      expect(result.reports).toEqual([]);
      
      expect(result.findings.length).toBe(0);
      expect(result.auditRequirements.length).toBe(0);
      expect(result.reports.length).toBe(0);
    });

    it('handles API returning object instead of array for findings', () => {
      const malformedFindings = { id: '1', title: 'Not an array' };
      const result = normalizeFindings(malformedFindings);
      
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('handles API returning object instead of array for permissions fields', () => {
      const malformedPermissions = {
        read: true,
        write: true,
        delete: false,
        maskedFields: { field: 'not an array' },
        deniedFields: { field: 'not an array' },
      };
      const result = normalizeAuditPermissions(malformedPermissions);
      
      expect(result.maskedFields).toEqual([]);
      expect(result.deniedFields).toEqual([]);
      expect(result.maskedFields.length).toBe(0);
      expect(result.deniedFields.length).toBe(0);
    });

    it('handles finding with malformed nested capas and issueRequirements', () => {
      const malformedFinding = {
        id: '1',
        auditId: 'audit-1',
        title: 'Finding with malformed nested data',
        type: 'observation',
        severity: 'medium',
        status: 'open',
        createdAt: '2024-01-01',
        capas: 'not an array',
        issueRequirements: { id: '1' },
      };
      const result = normalizeFinding(malformedFinding);
      
      expect(result).not.toBeNull();
      expect(result!.capas).toEqual([]);
      expect(result!.issueRequirements).toEqual([]);
      expect(result!.capas.length).toBe(0);
      expect(result!.issueRequirements.length).toBe(0);
    });

    it('safe to call .map, .filter, .some, .length on normalized arrays', () => {
      const result = normalizeAuditRelatedData(undefined, undefined, undefined);
      
      expect(() => result.findings.map(f => f.id)).not.toThrow();
      expect(() => result.findings.filter(f => f.severity === 'high')).not.toThrow();
      expect(() => result.findings.some(f => f.status === 'open')).not.toThrow();
      expect(() => result.findings.length).not.toThrow();
      
      expect(() => result.auditRequirements.map(r => r.id)).not.toThrow();
      expect(() => result.auditRequirements.filter(r => r.status === 'planned')).not.toThrow();
      expect(() => result.auditRequirements.some(r => r.status === 'completed')).not.toThrow();
      expect(() => result.auditRequirements.length).not.toThrow();
      
      expect(() => result.reports.map(r => r.id)).not.toThrow();
      expect(() => result.reports.filter(r => r.status === 'final')).not.toThrow();
      expect(() => result.reports.some(r => r.version > 1)).not.toThrow();
      expect(() => result.reports.length).not.toThrow();
    });

    it('safe to call .includes, .join on normalized permissions arrays', () => {
      const result = normalizeAuditPermissions(undefined);
      
      expect(() => result.maskedFields.includes('field')).not.toThrow();
      expect(() => result.maskedFields.join(', ')).not.toThrow();
      expect(() => result.deniedFields.includes('field')).not.toThrow();
      expect(() => result.deniedFields.join(', ')).not.toThrow();
      
      expect(result.maskedFields.includes('field')).toBe(false);
      expect(result.maskedFields.join(', ')).toBe('');
      expect(result.deniedFields.includes('field')).toBe(false);
      expect(result.deniedFields.join(', ')).toBe('');
    });
  });
});
