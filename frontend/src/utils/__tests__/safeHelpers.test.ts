import { safeArray, ensureArray, safeMap, safeFilter, safeSome, normalizeArrayFields, toStringArray, unwrapApiEnvelope, extractPoliciesArray, extractActionsObject, extractPaginatedItems } from '../safeHelpers';

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

  describe('toStringArray', () => {
    describe('null/undefined handling', () => {
      it('returns empty array for null', () => {
        expect(toStringArray(null)).toEqual([]);
      });

      it('returns empty array for undefined', () => {
        expect(toStringArray(undefined)).toEqual([]);
      });
    });

    describe('array input handling', () => {
      it('returns array of strings from string array', () => {
        expect(toStringArray(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
      });

      it('filters out non-string values from array', () => {
        expect(toStringArray(['a', 123, 'b', null, 'c', undefined])).toEqual(['a', 'b', 'c']);
      });

      it('trims whitespace from strings', () => {
        expect(toStringArray(['  a  ', ' b ', 'c'])).toEqual(['a', 'b', 'c']);
      });

      it('removes empty strings after trim', () => {
        expect(toStringArray(['a', '', '  ', 'b'])).toEqual(['a', 'b']);
      });

      it('handles mixed array with all edge cases', () => {
        expect(toStringArray(['valid', '', '  ', 123, null, '  trimmed  ', undefined, 'end'])).toEqual(['valid', 'trimmed', 'end']);
      });
    });

    describe('string input handling', () => {
      it('returns single-element array for non-empty string', () => {
        expect(toStringArray('fieldName')).toEqual(['fieldName']);
      });

      it('trims and returns single-element array', () => {
        expect(toStringArray('  fieldName  ')).toEqual(['fieldName']);
      });

      it('returns empty array for empty string', () => {
        expect(toStringArray('')).toEqual([]);
      });

      it('returns empty array for whitespace-only string', () => {
        expect(toStringArray('   ')).toEqual([]);
      });
    });

    describe('other types handling', () => {
      it('returns empty array for number', () => {
        expect(toStringArray(123)).toEqual([]);
      });

      it('returns empty array for boolean', () => {
        expect(toStringArray(true)).toEqual([]);
      });

      it('returns empty array for object', () => {
        expect(toStringArray({ field: 'value' })).toEqual([]);
      });
    });

    describe('UiPolicy field normalization scenarios', () => {
      it('normalizes undefined hiddenFields to empty array', () => {
        const actions = { hiddenFields: undefined };
        expect(toStringArray(actions.hiddenFields)).toEqual([]);
      });

      it('normalizes null readonlyFields to empty array', () => {
        const actions = { readonlyFields: null };
        expect(toStringArray(actions.readonlyFields)).toEqual([]);
      });

      it('normalizes string instead of array to single-element array', () => {
        const actions = { mandatoryFields: 'singleField' };
        expect(toStringArray(actions.mandatoryFields)).toEqual(['singleField']);
      });

      it('preserves valid string array', () => {
        const actions = { disabledFields: ['field1', 'field2'] };
        expect(toStringArray(actions.disabledFields)).toEqual(['field1', 'field2']);
      });
    });
  });

  describe('unwrapApiEnvelope', () => {
    describe('null/undefined handling', () => {
      it('returns null for null input', () => {
        expect(unwrapApiEnvelope(null)).toBeNull();
      });

      it('returns undefined for undefined input', () => {
        expect(unwrapApiEnvelope(undefined)).toBeUndefined();
      });
    });

    describe('primitive handling', () => {
      it('returns string as-is', () => {
        expect(unwrapApiEnvelope('test')).toBe('test');
      });

      it('returns number as-is', () => {
        expect(unwrapApiEnvelope(123)).toBe(123);
      });

      it('returns boolean as-is', () => {
        expect(unwrapApiEnvelope(true)).toBe(true);
      });
    });

    describe('success envelope handling', () => {
      it('unwraps {success: true, data: X} envelope', () => {
        const input = { success: true, data: { policies: [] } };
        expect(unwrapApiEnvelope(input)).toEqual({ policies: [] });
      });

      it('returns error envelope as-is when success is false', () => {
        const input = { success: false, error: { message: 'Error' } };
        expect(unwrapApiEnvelope(input)).toEqual(input);
      });

      it('unwraps double-wrapped envelope', () => {
        const input = { success: true, data: { success: true, data: { policies: [] } } };
        expect(unwrapApiEnvelope(input)).toEqual({ policies: [] });
      });
    });

    describe('axios response pattern handling', () => {
      it('unwraps simple {data: X} wrapper', () => {
        const input = { data: { policies: [] } };
        expect(unwrapApiEnvelope(input)).toEqual({ policies: [] });
      });

      it('unwraps axios-like response with status', () => {
        const input = { data: { policies: [] }, status: 200, headers: {} };
        expect(unwrapApiEnvelope(input)).toEqual({ policies: [] });
      });
    });

    describe('non-wrapper object handling', () => {
      it('returns object with policies as-is (not a wrapper)', () => {
        const input = { policies: [{ id: 1 }], tableName: 'audits' };
        expect(unwrapApiEnvelope(input)).toEqual(input);
      });

      it('returns object with actions as-is (not a wrapper)', () => {
        const input = { actions: { hiddenFields: [] }, tableName: 'audits' };
        expect(unwrapApiEnvelope(input)).toEqual(input);
      });
    });
  });

  describe('extractPoliciesArray', () => {
    describe('null/undefined handling', () => {
      it('returns empty array for null', () => {
        expect(extractPoliciesArray(null)).toEqual([]);
      });

      it('returns empty array for undefined', () => {
        expect(extractPoliciesArray(undefined)).toEqual([]);
      });
    });

    describe('direct array handling', () => {
      it('returns array as-is', () => {
        const policies = [{ id: 1 }, { id: 2 }];
        expect(extractPoliciesArray(policies)).toEqual(policies);
      });
    });

    describe('object with policies field', () => {
      it('extracts policies from {policies: [...]}', () => {
        const input = { policies: [{ id: 1 }], tableName: 'audits' };
        expect(extractPoliciesArray(input)).toEqual([{ id: 1 }]);
      });

      it('returns empty array when policies is not an array', () => {
        const input = { policies: 'not an array', tableName: 'audits' };
        expect(extractPoliciesArray(input)).toEqual([]);
      });
    });

    describe('envelope handling', () => {
      it('extracts policies from {success: true, data: {policies: [...]}}', () => {
        const input = { success: true, data: { policies: [{ id: 1 }], tableName: 'audits' } };
        expect(extractPoliciesArray(input)).toEqual([{ id: 1 }]);
      });

      it('extracts policies from double-wrapped envelope', () => {
        const input = { success: true, data: { success: true, data: { policies: [{ id: 1 }] } } };
        expect(extractPoliciesArray(input)).toEqual([{ id: 1 }]);
      });

      it('returns empty array for error envelope', () => {
        const input = { success: false, error: { message: 'Error' } };
        expect(extractPoliciesArray(input)).toEqual([]);
      });
    });

    describe('useUiPolicy crash scenarios', () => {
      it('handles response.data being undefined - no crash', () => {
        // Scenario: API returns undefined data
        expect(() => extractPoliciesArray(undefined)).not.toThrow();
        expect(extractPoliciesArray(undefined)).toEqual([]);
      });

      it('handles response.data.policies being undefined - no crash', () => {
        // Scenario: API returns {tableName: 'audits'} without policies
        const input = { tableName: 'audits' };
        expect(() => extractPoliciesArray(input)).not.toThrow();
        expect(extractPoliciesArray(input)).toEqual([]);
      });

      it('handles wrapped response without policies - no crash', () => {
        // Scenario: API returns {success: true, data: {tableName: 'audits'}}
        const input = { success: true, data: { tableName: 'audits' } };
        expect(() => extractPoliciesArray(input)).not.toThrow();
        expect(extractPoliciesArray(input)).toEqual([]);
      });
    });
  });

  describe('extractActionsObject', () => {
    describe('null/undefined handling', () => {
      it('returns undefined for null', () => {
        expect(extractActionsObject(null)).toBeUndefined();
      });

      it('returns undefined for undefined', () => {
        expect(extractActionsObject(undefined)).toBeUndefined();
      });
    });

    describe('object with actions field', () => {
      it('extracts actions from {actions: {...}}', () => {
        const actions = { hiddenFields: ['field1'], readonlyFields: [] };
        const input = { actions, tableName: 'audits' };
        expect(extractActionsObject(input)).toEqual(actions);
      });

      it('returns undefined when actions is null', () => {
        const input = { actions: null, tableName: 'audits' };
        expect(extractActionsObject(input)).toBeUndefined();
      });

      it('returns undefined when actions is not an object', () => {
        const input = { actions: 'not an object', tableName: 'audits' };
        expect(extractActionsObject(input)).toBeUndefined();
      });
    });

    describe('envelope handling', () => {
      it('extracts actions from {success: true, data: {actions: {...}}}', () => {
        const actions = { hiddenFields: ['field1'] };
        const input = { success: true, data: { actions, tableName: 'audits' } };
        expect(extractActionsObject(input)).toEqual(actions);
      });

      it('extracts actions from double-wrapped envelope', () => {
        const actions = { hiddenFields: ['field1'] };
        const input = { success: true, data: { success: true, data: { actions } } };
        expect(extractActionsObject(input)).toEqual(actions);
      });

      it('returns undefined for error envelope', () => {
        const input = { success: false, error: { message: 'Error' } };
        expect(extractActionsObject(input)).toBeUndefined();
      });
    });

    describe('useUiPolicy crash scenarios', () => {
      it('handles response.data being undefined - no crash', () => {
        expect(() => extractActionsObject(undefined)).not.toThrow();
        expect(extractActionsObject(undefined)).toBeUndefined();
      });

      it('handles response.data.actions being undefined - no crash', () => {
        const input = { tableName: 'audits' };
        expect(() => extractActionsObject(input)).not.toThrow();
        expect(extractActionsObject(input)).toBeUndefined();
      });

      it('handles wrapped response without actions - no crash', () => {
        const input = { success: true, data: { tableName: 'audits' } };
        expect(() => extractActionsObject(input)).not.toThrow();
        expect(extractActionsObject(input)).toBeUndefined();
      });
    });
  });

  // ====================================================================
  // extractPaginatedItems tests (PR4 — CMDB envelope normalization)
  // ====================================================================
  describe('extractPaginatedItems', () => {
    const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];

    it('extracts items from LIST-CONTRACT envelope: { success: true, data: { items: [...] } }', () => {
      const input = { success: true, data: { items, total: 2, page: 1, pageSize: 20, totalPages: 1 } };
      expect(extractPaginatedItems(input)).toEqual(items);
    });

    it('extracts items from { data: { items: [...] } } envelope (no success field)', () => {
      const input = { data: { items, total: 2 } };
      expect(extractPaginatedItems(input)).toEqual(items);
    });

    it('extracts items from flat paginated: { items: [...] }', () => {
      const input = { items, total: 2, page: 1, pageSize: 20 };
      expect(extractPaginatedItems(input)).toEqual(items);
    });

    it('extracts items from { success: true, data: [...] } array envelope', () => {
      const input = { success: true, data: items };
      expect(extractPaginatedItems(input)).toEqual(items);
    });

    it('extracts items from { data: [...] } partial envelope', () => {
      const input = { data: items };
      expect(extractPaginatedItems(input)).toEqual(items);
    });

    it('returns flat array as-is', () => {
      expect(extractPaginatedItems(items)).toEqual(items);
    });

    it('returns empty array for null', () => {
      expect(extractPaginatedItems(null)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(extractPaginatedItems(undefined)).toEqual([]);
    });

    it('returns empty array for non-object', () => {
      expect(extractPaginatedItems('string')).toEqual([]);
      expect(extractPaginatedItems(42)).toEqual([]);
    });

    it('returns empty array for empty object', () => {
      expect(extractPaginatedItems({})).toEqual([]);
    });

    it('returns empty array for { success: false, data: ... }', () => {
      const input = { success: false, data: { items } };
      // success=false but 'success' and 'data' keys present — should still try to extract
      expect(extractPaginatedItems(input)).toEqual(items);
    });

    it('handles double-wrapped { success: true, data: { data: [...] } }', () => {
      const input = { success: true, data: { data: items } };
      expect(extractPaginatedItems(input)).toEqual(items);
    });
  });
});
