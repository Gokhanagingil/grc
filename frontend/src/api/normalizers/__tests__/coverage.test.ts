import {
  safeArray,
  normalizeCoverageSummary,
  normalizeRequirementCoverage,
  normalizeProcessCoverage,
  normalizeCoverageData,
  DEFAULT_COVERAGE_SUMMARY,
  DEFAULT_REQUIREMENT_COVERAGE,
  DEFAULT_PROCESS_COVERAGE,
} from '../coverage';

describe('Coverage Normalizers', () => {
  describe('safeArray', () => {
    it('returns empty array for undefined input', () => {
      const result = safeArray(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty array for null input', () => {
      const result = safeArray(null);
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (string)', () => {
      const result = safeArray('invalid');
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (number)', () => {
      const result = safeArray(123);
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (object)', () => {
      const result = safeArray({ key: 'value' });
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array input (boolean)', () => {
      const result = safeArray(true);
      expect(result).toEqual([]);
    });

    it('preserves valid array input', () => {
      const input = [1, 2, 3];
      const result = safeArray(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it('preserves empty array input', () => {
      const result = safeArray([]);
      expect(result).toEqual([]);
    });

    it('preserves array with objects', () => {
      const input = [{ id: '1' }, { id: '2' }];
      const result = safeArray(input);
      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
    });

    it('does not throw for any input type', () => {
      expect(() => safeArray(undefined)).not.toThrow();
      expect(() => safeArray(null)).not.toThrow();
      expect(() => safeArray({})).not.toThrow();
      expect(() => safeArray('string')).not.toThrow();
      expect(() => safeArray(123)).not.toThrow();
      expect(() => safeArray(true)).not.toThrow();
      expect(() => safeArray([])).not.toThrow();
      expect(() => safeArray([1, 2, 3])).not.toThrow();
    });
  });

  describe('normalizeCoverageSummary', () => {
    it('returns default summary for undefined input', () => {
      const result = normalizeCoverageSummary(undefined);
      expect(result).toEqual(DEFAULT_COVERAGE_SUMMARY);
    });

    it('returns default summary for null input', () => {
      const result = normalizeCoverageSummary(null);
      expect(result).toEqual(DEFAULT_COVERAGE_SUMMARY);
    });

    it('returns default summary for non-object input', () => {
      expect(normalizeCoverageSummary('string')).toEqual(DEFAULT_COVERAGE_SUMMARY);
      expect(normalizeCoverageSummary(123)).toEqual(DEFAULT_COVERAGE_SUMMARY);
      expect(normalizeCoverageSummary(true)).toEqual(DEFAULT_COVERAGE_SUMMARY);
    });

    it('normalizes summary with missing fields', () => {
      const input = {
        requirementCoverage: 75,
        processCoverage: 50,
      };
      const result = normalizeCoverageSummary(input);
      expect(result.requirementCoverage).toBe(75);
      expect(result.processCoverage).toBe(50);
      expect(result.unlinkedControlsCount).toBe(0);
      expect(result.totalRequirements).toBe(0);
    });

    it('preserves valid summary data', () => {
      const input = {
        requirementCoverage: 80,
        processCoverage: 60,
        unlinkedControlsCount: 5,
        totalRequirements: 100,
        coveredRequirements: 80,
        totalProcesses: 50,
        coveredProcesses: 30,
        totalControls: 200,
      };
      const result = normalizeCoverageSummary(input);
      expect(result).toEqual(input);
    });

    it('handles non-numeric values gracefully', () => {
      const input = {
        requirementCoverage: 'invalid',
        processCoverage: null,
        unlinkedControlsCount: undefined,
      };
      const result = normalizeCoverageSummary(input);
      expect(result.requirementCoverage).toBe(0);
      expect(result.processCoverage).toBe(0);
      expect(result.unlinkedControlsCount).toBe(0);
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeCoverageSummary(undefined)).not.toThrow();
      expect(() => normalizeCoverageSummary(null)).not.toThrow();
      expect(() => normalizeCoverageSummary({})).not.toThrow();
      expect(() => normalizeCoverageSummary('string')).not.toThrow();
      expect(() => normalizeCoverageSummary(123)).not.toThrow();
    });
  });

  describe('normalizeRequirementCoverage', () => {
    it('returns default response for undefined input', () => {
      const result = normalizeRequirementCoverage(undefined);
      expect(result).toEqual(DEFAULT_REQUIREMENT_COVERAGE);
    });

    it('returns default response for null input', () => {
      const result = normalizeRequirementCoverage(null);
      expect(result).toEqual(DEFAULT_REQUIREMENT_COVERAGE);
    });

    it('returns default response for non-object input', () => {
      expect(normalizeRequirementCoverage('string')).toEqual(DEFAULT_REQUIREMENT_COVERAGE);
      expect(normalizeRequirementCoverage(123)).toEqual(DEFAULT_REQUIREMENT_COVERAGE);
      expect(normalizeRequirementCoverage(true)).toEqual(DEFAULT_REQUIREMENT_COVERAGE);
    });

    it('normalizes response with undefined requirements array', () => {
      const input = {
        total: 10,
        covered: 8,
        uncovered: 2,
        coveragePercent: 80,
        requirements: undefined,
      };
      const result = normalizeRequirementCoverage(input);
      expect(result.requirements).toEqual([]);
      expect(result.total).toBe(10);
    });

    it('normalizes response with null requirements array', () => {
      const input = {
        total: 10,
        covered: 8,
        uncovered: 2,
        coveragePercent: 80,
        requirements: null,
      };
      const result = normalizeRequirementCoverage(input);
      expect(result.requirements).toEqual([]);
    });

    it('normalizes response with object instead of array for requirements', () => {
      const input = {
        total: 10,
        covered: 8,
        uncovered: 2,
        coveragePercent: 80,
        requirements: { id: '1', title: 'Not an array' },
      };
      const result = normalizeRequirementCoverage(input);
      expect(result.requirements).toEqual([]);
    });

    it('preserves valid requirements array', () => {
      const input = {
        total: 2,
        covered: 1,
        uncovered: 1,
        coveragePercent: 50,
        requirements: [
          { id: '1', title: 'Req 1', referenceCode: 'R1', status: 'active', controlCount: 3, isCovered: true },
          { id: '2', title: 'Req 2', referenceCode: 'R2', status: 'active', controlCount: 0, isCovered: false },
        ],
      };
      const result = normalizeRequirementCoverage(input);
      expect(result.requirements).toHaveLength(2);
      expect(result.requirements[0].id).toBe('1');
      expect(result.requirements[1].id).toBe('2');
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeRequirementCoverage(undefined)).not.toThrow();
      expect(() => normalizeRequirementCoverage(null)).not.toThrow();
      expect(() => normalizeRequirementCoverage({})).not.toThrow();
      expect(() => normalizeRequirementCoverage('string')).not.toThrow();
      expect(() => normalizeRequirementCoverage(123)).not.toThrow();
    });
  });

  describe('normalizeProcessCoverage', () => {
    it('returns default response for undefined input', () => {
      const result = normalizeProcessCoverage(undefined);
      expect(result).toEqual(DEFAULT_PROCESS_COVERAGE);
    });

    it('returns default response for null input', () => {
      const result = normalizeProcessCoverage(null);
      expect(result).toEqual(DEFAULT_PROCESS_COVERAGE);
    });

    it('returns default response for non-object input', () => {
      expect(normalizeProcessCoverage('string')).toEqual(DEFAULT_PROCESS_COVERAGE);
      expect(normalizeProcessCoverage(123)).toEqual(DEFAULT_PROCESS_COVERAGE);
      expect(normalizeProcessCoverage(true)).toEqual(DEFAULT_PROCESS_COVERAGE);
    });

    it('normalizes response with undefined processes array', () => {
      const input = {
        total: 5,
        covered: 3,
        uncovered: 2,
        coveragePercent: 60,
        processes: undefined,
      };
      const result = normalizeProcessCoverage(input);
      expect(result.processes).toEqual([]);
      expect(result.total).toBe(5);
    });

    it('normalizes response with null processes array', () => {
      const input = {
        total: 5,
        covered: 3,
        uncovered: 2,
        coveragePercent: 60,
        processes: null,
      };
      const result = normalizeProcessCoverage(input);
      expect(result.processes).toEqual([]);
    });

    it('normalizes response with object instead of array for processes', () => {
      const input = {
        total: 5,
        covered: 3,
        uncovered: 2,
        coveragePercent: 60,
        processes: { id: '1', name: 'Not an array' },
      };
      const result = normalizeProcessCoverage(input);
      expect(result.processes).toEqual([]);
    });

    it('preserves valid processes array', () => {
      const input = {
        total: 2,
        covered: 1,
        uncovered: 1,
        coveragePercent: 50,
        processes: [
          { id: '1', name: 'Process 1', code: 'P1', isActive: true, controlCount: 5, isCovered: true },
          { id: '2', name: 'Process 2', code: 'P2', isActive: false, controlCount: 0, isCovered: false },
        ],
      };
      const result = normalizeProcessCoverage(input);
      expect(result.processes).toHaveLength(2);
      expect(result.processes[0].id).toBe('1');
      expect(result.processes[1].id).toBe('2');
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeProcessCoverage(undefined)).not.toThrow();
      expect(() => normalizeProcessCoverage(null)).not.toThrow();
      expect(() => normalizeProcessCoverage({})).not.toThrow();
      expect(() => normalizeProcessCoverage('string')).not.toThrow();
      expect(() => normalizeProcessCoverage(123)).not.toThrow();
    });
  });

  describe('normalizeCoverageData', () => {
    it('returns all defaults for undefined inputs', () => {
      const result = normalizeCoverageData(undefined, undefined, undefined);
      expect(result).toEqual({
        summary: DEFAULT_COVERAGE_SUMMARY,
        requirementCoverage: DEFAULT_REQUIREMENT_COVERAGE,
        processCoverage: DEFAULT_PROCESS_COVERAGE,
      });
    });

    it('returns all defaults for null inputs', () => {
      const result = normalizeCoverageData(null, null, null);
      expect(result).toEqual({
        summary: DEFAULT_COVERAGE_SUMMARY,
        requirementCoverage: DEFAULT_REQUIREMENT_COVERAGE,
        processCoverage: DEFAULT_PROCESS_COVERAGE,
      });
    });

    it('normalizes mixed valid and invalid inputs', () => {
      const summary = {
        requirementCoverage: 75,
        processCoverage: 50,
        totalControls: 100,
      };
      const reqCoverage = {
        total: 10,
        requirements: [{ id: '1', title: 'Req 1' }],
      };

      const result = normalizeCoverageData(summary, reqCoverage, null);
      expect(result.summary.requirementCoverage).toBe(75);
      expect(result.requirementCoverage.requirements).toHaveLength(1);
      expect(result.processCoverage).toEqual(DEFAULT_PROCESS_COVERAGE);
    });

    it('does not throw for any combination of malformed inputs', () => {
      expect(() => normalizeCoverageData(undefined, null, {})).not.toThrow();
      expect(() => normalizeCoverageData('string', 123, true)).not.toThrow();
      expect(() => normalizeCoverageData([], [], [])).not.toThrow();
    });
  });

  describe('Regression: Coverage page crash scenarios', () => {
    it('handles API returning undefined for all coverage data', () => {
      const result = normalizeCoverageData(undefined, undefined, undefined);

      expect(result.summary).toEqual(DEFAULT_COVERAGE_SUMMARY);
      expect(result.requirementCoverage.requirements).toEqual([]);
      expect(result.processCoverage.processes).toEqual([]);

      expect(result.requirementCoverage.requirements.length).toBe(0);
      expect(result.processCoverage.processes.length).toBe(0);
    });

    it('handles API returning object instead of array for requirements', () => {
      const malformedResponse = {
        total: 10,
        covered: 5,
        uncovered: 5,
        coveragePercent: 50,
        requirements: { id: '1', title: 'Not an array' },
      };
      const result = normalizeRequirementCoverage(malformedResponse);

      expect(result.requirements).toEqual([]);
      expect(result.requirements.length).toBe(0);
    });

    it('handles API returning object instead of array for processes', () => {
      const malformedResponse = {
        total: 5,
        covered: 2,
        uncovered: 3,
        coveragePercent: 40,
        processes: { id: '1', name: 'Not an array' },
      };
      const result = normalizeProcessCoverage(malformedResponse);

      expect(result.processes).toEqual([]);
      expect(result.processes.length).toBe(0);
    });

    it('handles API returning empty response object', () => {
      const result = normalizeCoverageData({}, {}, {});

      expect(result.summary.requirementCoverage).toBe(0);
      expect(result.summary.processCoverage).toBe(0);
      expect(result.requirementCoverage.requirements).toEqual([]);
      expect(result.processCoverage.processes).toEqual([]);
    });

    it('handles API returning response with missing array fields', () => {
      const reqResponse = {
        total: 10,
        covered: 8,
        uncovered: 2,
        coveragePercent: 80,
      };
      const procResponse = {
        total: 5,
        covered: 3,
        uncovered: 2,
        coveragePercent: 60,
      };

      const result = normalizeCoverageData({}, reqResponse, procResponse);

      expect(result.requirementCoverage.requirements).toEqual([]);
      expect(result.processCoverage.processes).toEqual([]);
      expect(result.requirementCoverage.total).toBe(10);
      expect(result.processCoverage.total).toBe(5);
    });

    it('safeArray prevents .length crash on undefined', () => {
      const undefinedValue: unknown = undefined;
      const result = safeArray(undefinedValue);

      expect(() => result.length).not.toThrow();
      expect(result.length).toBe(0);
    });

    it('safeArray prevents .length crash on null', () => {
      const nullValue: unknown = null;
      const result = safeArray(nullValue);

      expect(() => result.length).not.toThrow();
      expect(result.length).toBe(0);
    });

    it('safeArray prevents .map crash on undefined', () => {
      const undefinedValue: unknown = undefined;
      const result = safeArray<{ id: string }>(undefinedValue);

      expect(() => result.map((item) => item.id)).not.toThrow();
      expect(result.map((item) => item.id)).toEqual([]);
    });
  });
});
