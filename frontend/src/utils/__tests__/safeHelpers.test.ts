import { safeArray, ensureArray, safeMap, safeFilter, safeSome, normalizeArrayFields } from '../safeHelpers';

describe('safeHelpers', () => {
  describe('safeArray', () => {
    it('returns the array if input is already an array', () => {
      const input = [1, 2, 3];
      expect(safeArray(input)).toBe(input);
    });

    it('returns empty array for null', () => {
      expect(safeArray(null)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(safeArray(undefined)).toEqual([]);
    });
  });

  describe('ensureArray', () => {
    describe('direct array input', () => {
      it('returns the array if input is already an array', () => {
        const input = [1, 2, 3];
        expect(ensureArray(input)).toEqual([1, 2, 3]);
      });

      it('returns empty array for empty array input', () => {
        expect(ensureArray([])).toEqual([]);
      });
    });

    describe('null/undefined handling', () => {
      it('returns empty array for null', () => {
        expect(ensureArray(null)).toEqual([]);
      });

      it('returns empty array for undefined', () => {
        expect(ensureArray(undefined)).toEqual([]);
      });
    });

    describe('primitive handling', () => {
      it('returns empty array for string', () => {
        expect(ensureArray('test')).toEqual([]);
      });

      it('returns empty array for number', () => {
        expect(ensureArray(123)).toEqual([]);
      });

      it('returns empty array for boolean', () => {
        expect(ensureArray(true)).toEqual([]);
      });
    });

    describe('envelope response handling', () => {
      it('unwraps {success: true, data: [...]} envelope', () => {
        const input = { success: true, data: [1, 2, 3] };
        expect(ensureArray(input)).toEqual([1, 2, 3]);
      });

      it('returns empty array for {success: false, ...} envelope', () => {
        const input = { success: false, error: { message: 'Error' } };
        expect(ensureArray(input)).toEqual([]);
      });

      it('unwraps nested {success: true, data: {items: [...]}} envelope', () => {
        const input = { success: true, data: { items: [1, 2, 3] } };
        expect(ensureArray(input)).toEqual([1, 2, 3]);
      });

      it('returns empty array when success envelope has non-array data', () => {
        const input = { success: true, data: { notAnArray: 'value' } };
        expect(ensureArray(input)).toEqual([]);
      });
    });

    describe('axios response pattern handling', () => {
      it('unwraps {data: [...]} pattern', () => {
        const input = { data: [1, 2, 3] };
        expect(ensureArray(input)).toEqual([1, 2, 3]);
      });

      it('unwraps {data: {users: [...]}} pattern', () => {
        const input = { data: { users: [{ id: 1 }, { id: 2 }] } };
        expect(ensureArray(input)).toEqual([{ id: 1 }, { id: 2 }]);
      });

      it('unwraps {data: {findings: [...]}} pattern', () => {
        const input = { data: { findings: [{ id: 1 }] } };
        expect(ensureArray(input)).toEqual([{ id: 1 }]);
      });

      it('unwraps {data: {requirements: [...]}} pattern', () => {
        const input = { data: { requirements: [{ id: 1 }] } };
        expect(ensureArray(input)).toEqual([{ id: 1 }]);
      });

      it('unwraps {data: {reports: [...]}} pattern', () => {
        const input = { data: { reports: [{ id: 1 }] } };
        expect(ensureArray(input)).toEqual([{ id: 1 }]);
      });
    });

    describe('object with items pattern', () => {
      it('extracts items array from {items: [...]}', () => {
        const input = { items: [1, 2, 3] };
        expect(ensureArray(input)).toEqual([1, 2, 3]);
      });
    });

    describe('AuditDetail crash scenarios', () => {
      it('handles undefined users response - no crash', () => {
        // Scenario: API returns undefined
        expect(() => ensureArray(undefined)).not.toThrow();
        expect(ensureArray(undefined)).toEqual([]);
      });

      it('handles null users response - no crash', () => {
        // Scenario: API returns null
        expect(() => ensureArray(null)).not.toThrow();
        expect(ensureArray(null)).toEqual([]);
      });

      it('handles error envelope response - no crash', () => {
        // Scenario: API returns {success: false, error: {...}}
        const errorResponse = { success: false, error: { code: 'ERROR', message: 'Failed' } };
        expect(() => ensureArray(errorResponse)).not.toThrow();
        expect(ensureArray(errorResponse)).toEqual([]);
      });

      it('handles object instead of array - no crash', () => {
        // Scenario: API returns object when array expected
        const objectResponse = { id: 1, name: 'test' };
        expect(() => ensureArray(objectResponse)).not.toThrow();
        expect(ensureArray(objectResponse)).toEqual([]);
      });

      it('handles normal array response correctly', () => {
        // Scenario: API returns expected array
        const users = [{ id: 1, first_name: 'John', last_name: 'Doe' }];
        expect(ensureArray(users)).toEqual(users);
      });

      it('handles wrapped users response correctly', () => {
        // Scenario: API returns {users: [...]}
        const response = { users: [{ id: 1, first_name: 'John', last_name: 'Doe' }] };
        expect(ensureArray(response)).toEqual([{ id: 1, first_name: 'John', last_name: 'Doe' }]);
      });

      it('handles success envelope with users correctly', () => {
        // Scenario: API returns {success: true, data: {users: [...]}}
        const response = { 
          success: true, 
          data: { users: [{ id: 1, first_name: 'John', last_name: 'Doe' }] } 
        };
        expect(ensureArray(response)).toEqual([{ id: 1, first_name: 'John', last_name: 'Doe' }]);
      });
    });
  });

  describe('safeMap', () => {
    it('maps over array correctly', () => {
      const input = [1, 2, 3];
      expect(safeMap(input, x => x * 2)).toEqual([2, 4, 6]);
    });

    it('returns empty array for null', () => {
      expect(safeMap(null, x => x)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(safeMap(undefined, x => x)).toEqual([]);
    });
  });

  describe('safeFilter', () => {
    it('filters array correctly', () => {
      const input = [1, 2, 3, 4];
      expect(safeFilter(input, x => x > 2)).toEqual([3, 4]);
    });

    it('returns empty array for null', () => {
      expect(safeFilter(null, x => x > 0)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(safeFilter(undefined, x => x > 0)).toEqual([]);
    });
  });

  describe('safeSome', () => {
    it('returns true when condition is met', () => {
      const input = [1, 2, 3];
      expect(safeSome(input, x => x === 2)).toBe(true);
    });

    it('returns false when condition is not met', () => {
      const input = [1, 2, 3];
      expect(safeSome(input, x => x === 5)).toBe(false);
    });

    it('returns false for null', () => {
      expect(safeSome(null, x => x === 1)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(safeSome(undefined, x => x === 1)).toBe(false);
    });
  });

  describe('normalizeArrayFields', () => {
    it('normalizes missing array fields to empty arrays', () => {
      const data = { name: 'test' } as { name: string; items?: string[]; tags?: string[] };
      const result = normalizeArrayFields(data, ['items', 'tags']);
      expect(result.items).toEqual([]);
      expect(result.tags).toEqual([]);
    });

    it('preserves existing array fields', () => {
      const data = { name: 'test', items: [1, 2, 3] };
      const result = normalizeArrayFields(data, ['items']);
      expect(result.items).toEqual([1, 2, 3]);
    });

    it('returns object with empty arrays for null input', () => {
      const result = normalizeArrayFields(null, ['items', 'tags']);
      expect(result.items).toEqual([]);
      expect(result.tags).toEqual([]);
    });

    it('returns object with empty arrays for undefined input', () => {
      const result = normalizeArrayFields(undefined, ['items', 'tags']);
      expect(result.items).toEqual([]);
      expect(result.tags).toEqual([]);
    });
  });

  describe('Permissions object crash regression tests', () => {
    interface AuditPermissions {
      read: boolean;
      write: boolean;
      delete: boolean;
      maskedFields?: string[];
      deniedFields?: string[];
    }

    it('handles permissions with undefined maskedFields - no crash on .length access', () => {
      const permissions: AuditPermissions = {
        read: true,
        write: true,
        delete: false,
      };
      
      // This pattern caused the crash: permissions.maskedFields.length
      // Fixed pattern: (permissions.maskedFields?.length ?? 0)
      expect(() => {
        const length = permissions.maskedFields?.length ?? 0;
        return length > 0;
      }).not.toThrow();
      
      expect(permissions.maskedFields?.length ?? 0).toBe(0);
    });

    it('handles permissions with undefined deniedFields - no crash on .length access', () => {
      const permissions: AuditPermissions = {
        read: true,
        write: false,
        delete: false,
      };
      
      // This pattern caused the crash: permissions.deniedFields.length
      // Fixed pattern: (permissions.deniedFields?.length ?? 0)
      expect(() => {
        const length = permissions.deniedFields?.length ?? 0;
        return length > 0;
      }).not.toThrow();
      
      expect(permissions.deniedFields?.length ?? 0).toBe(0);
    });

    it('handles permissions with undefined maskedFields - no crash on .includes access', () => {
      const permissions: AuditPermissions = {
        read: true,
        write: true,
        delete: false,
      };
      
      // This pattern caused the crash: permissions?.maskedFields.includes(fieldName)
      // Fixed pattern: permissions?.maskedFields?.includes(fieldName)
      expect(() => {
        const isHidden = permissions?.maskedFields?.includes('someField');
        return isHidden;
      }).not.toThrow();
      
      expect(permissions?.maskedFields?.includes('someField')).toBe(undefined);
    });

    it('handles permissions with undefined deniedFields - no crash on .includes access', () => {
      const permissions: AuditPermissions = {
        read: true,
        write: false,
        delete: false,
      };
      
      // This pattern caused the crash: permissions?.deniedFields.includes(fieldName)
      // Fixed pattern: permissions?.deniedFields?.includes(fieldName)
      expect(() => {
        const isDenied = permissions?.deniedFields?.includes('someField');
        return isDenied;
      }).not.toThrow();
      
      expect(permissions?.deniedFields?.includes('someField')).toBe(undefined);
    });

    it('handles permissions with empty arrays correctly', () => {
      const permissions: AuditPermissions = {
        read: true,
        write: true,
        delete: false,
        maskedFields: [],
        deniedFields: [],
      };
      
      expect(permissions.maskedFields?.length ?? 0).toBe(0);
      expect(permissions.deniedFields?.length ?? 0).toBe(0);
      expect(permissions.maskedFields?.includes('someField')).toBe(false);
      expect(permissions.deniedFields?.includes('someField')).toBe(false);
    });

    it('handles permissions with populated arrays correctly', () => {
      const permissions: AuditPermissions = {
        read: true,
        write: true,
        delete: false,
        maskedFields: ['field1', 'field2'],
        deniedFields: ['field3'],
      };
      
      expect(permissions.maskedFields?.length ?? 0).toBe(2);
      expect(permissions.deniedFields?.length ?? 0).toBe(1);
      expect(permissions.maskedFields?.includes('field1')).toBe(true);
      expect(permissions.maskedFields?.includes('unknown')).toBe(false);
      expect(permissions.deniedFields?.includes('field3')).toBe(true);
    });

    it('handles null permissions object correctly', () => {
      const permissions: AuditPermissions | null = null;
      
      // This pattern is safe: permissions?.maskedFields?.includes(fieldName)
      expect(() => {
        const isHidden = permissions?.maskedFields?.includes('someField');
        return isHidden;
      }).not.toThrow();
      
      expect(permissions?.maskedFields?.includes('someField')).toBe(undefined);
      expect(permissions?.maskedFields?.length ?? 0).toBe(0);
    });
  });

  describe('AuditDetail array .length access regression tests', () => {
    // These tests verify that safeArray properly guards against undefined arrays
    // when accessing .length in AuditDetail component JSX

    it('handles undefined auditRequirements array - no crash on .length access', () => {
      const auditRequirements: unknown[] | undefined = undefined;
      
      // This pattern caused the crash: auditRequirements.length
      // Fixed pattern: safeArray(auditRequirements).length
      expect(() => {
        const length = safeArray(auditRequirements).length;
        return length;
      }).not.toThrow();
      
      expect(safeArray(auditRequirements).length).toBe(0);
    });

    it('handles undefined findings array - no crash on .length access', () => {
      const findings: unknown[] | undefined = undefined;
      
      expect(() => {
        const length = safeArray(findings).length;
        return length;
      }).not.toThrow();
      
      expect(safeArray(findings).length).toBe(0);
    });

    it('handles undefined reports array - no crash on .length access', () => {
      const reports: unknown[] | undefined = undefined;
      
      expect(() => {
        const length = safeArray(reports).length;
        return length;
      }).not.toThrow();
      
      expect(safeArray(reports).length).toBe(0);
    });

    it('handles undefined availableRequirements array - no crash on .length access', () => {
      const availableRequirements: unknown[] | undefined = undefined;
      
      expect(() => {
        const length = safeArray(availableRequirements).length;
        return length;
      }).not.toThrow();
      
      expect(safeArray(availableRequirements).length).toBe(0);
    });

    it('handles null arrays - no crash on .length access', () => {
      const nullArray: unknown[] | null = null;
      
      expect(() => {
        const length = safeArray(nullArray).length;
        return length;
      }).not.toThrow();
      
      expect(safeArray(nullArray).length).toBe(0);
    });

    it('handles empty arrays correctly', () => {
      const emptyArray: unknown[] = [];
      
      expect(safeArray(emptyArray).length).toBe(0);
      expect(safeArray(emptyArray).length === 0).toBe(true);
      expect(safeArray(emptyArray).length > 0).toBe(false);
    });

    it('handles populated arrays correctly', () => {
      const populatedArray = [{ id: '1' }, { id: '2' }, { id: '3' }];
      
      expect(safeArray(populatedArray).length).toBe(3);
      expect(safeArray(populatedArray).length === 0).toBe(false);
      expect(safeArray(populatedArray).length > 0).toBe(true);
    });

    it('handles Tab label template string with undefined array', () => {
      const auditRequirements: unknown[] | undefined = undefined;
      
      // This is the exact pattern used in AuditDetail.tsx Tab labels
      expect(() => {
        const label = `Scope & Standards (${safeArray(auditRequirements).length})`;
        return label;
      }).not.toThrow();
      
      expect(`Scope & Standards (${safeArray(auditRequirements).length})`).toBe('Scope & Standards (0)');
    });

    it('handles conditional rendering with undefined array', () => {
      const auditRequirements: unknown[] | undefined = undefined;
      
      // This is the exact pattern used in AuditDetail.tsx conditional rendering
      expect(() => {
        const isEmpty = safeArray(auditRequirements).length === 0;
        const hasItems = safeArray(auditRequirements).length > 0;
        return { isEmpty, hasItems };
      }).not.toThrow();
      
      expect(safeArray(auditRequirements).length === 0).toBe(true);
      expect(safeArray(auditRequirements).length > 0).toBe(false);
    });

    it('handles checkbox indeterminate logic with undefined array', () => {
      const availableRequirements: unknown[] | undefined = undefined;
      const selectedRequirementIds: string[] = ['1', '2'];
      
      // This is the exact pattern used in AuditDetail.tsx checkbox logic
      expect(() => {
        const indeterminate = selectedRequirementIds.length > 0 && 
          selectedRequirementIds.length < safeArray(availableRequirements).length;
        const checked = selectedRequirementIds.length === safeArray(availableRequirements).length;
        return { indeterminate, checked };
      }).not.toThrow();
      
      // With undefined availableRequirements (length 0), indeterminate should be false
      // because selectedRequirementIds.length (2) is NOT less than 0
      expect(selectedRequirementIds.length > 0 && 
        selectedRequirementIds.length < safeArray(availableRequirements).length).toBe(false);
      // checked should be false because 2 !== 0
      expect(selectedRequirementIds.length === safeArray(availableRequirements).length).toBe(false);
    });
  });
});
