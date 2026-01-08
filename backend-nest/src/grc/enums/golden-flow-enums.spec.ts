/**
 * Golden Flow Enums Regression Test
 *
 * This test validates that the TypeScript enum values match the PostgreSQL enum values
 * defined in the GoldenFlowPhaseOne migration. This prevents enum drift where the
 * TypeScript code uses different values than what's stored in the database.
 *
 * If this test fails, it means:
 * 1. The TypeScript enum values don't match the PostgreSQL enum values
 * 2. The seed script will fail with "invalid input value for enum" errors
 *
 * To fix: Update the TypeScript enum values in src/grc/enums/index.ts to match
 * the PostgreSQL enum values defined in the migration.
 */

import {
  ControlTestType,
  ControlTestStatus,
  TestResultOutcome,
  EffectivenessRating,
  CAPATaskStatus,
  ControlEvidenceType,
  CAPAPriority,
} from './index';

describe('Golden Flow Enums - PostgreSQL Compatibility', () => {
  describe('ControlTestType', () => {
    it('should have UPPERCASE values matching grc_control_tests_test_type_enum', () => {
      expect(ControlTestType.MANUAL).toBe('MANUAL');
      expect(ControlTestType.AUTOMATED).toBe('AUTOMATED');
      expect(ControlTestType.HYBRID).toBe('HYBRID');
    });

    it('should have exactly 3 values', () => {
      const values = Object.values(ControlTestType);
      expect(values).toHaveLength(3);
      expect(values).toEqual(['MANUAL', 'AUTOMATED', 'HYBRID']);
    });
  });

  describe('ControlTestStatus', () => {
    it('should have UPPERCASE values matching grc_control_tests_status_enum', () => {
      expect(ControlTestStatus.PLANNED).toBe('PLANNED');
      expect(ControlTestStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(ControlTestStatus.COMPLETED).toBe('COMPLETED');
      expect(ControlTestStatus.CANCELLED).toBe('CANCELLED');
    });

    it('should have exactly 4 values', () => {
      const values = Object.values(ControlTestStatus);
      expect(values).toHaveLength(4);
      expect(values).toEqual([
        'PLANNED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
      ]);
    });
  });

  describe('TestResultOutcome', () => {
    it('should have UPPERCASE values matching grc_test_results_result_enum', () => {
      expect(TestResultOutcome.PASS).toBe('PASS');
      expect(TestResultOutcome.FAIL).toBe('FAIL');
      expect(TestResultOutcome.INCONCLUSIVE).toBe('INCONCLUSIVE');
      expect(TestResultOutcome.NOT_APPLICABLE).toBe('NOT_APPLICABLE');
    });

    it('should have exactly 4 values', () => {
      const values = Object.values(TestResultOutcome);
      expect(values).toHaveLength(4);
      expect(values).toEqual([
        'PASS',
        'FAIL',
        'INCONCLUSIVE',
        'NOT_APPLICABLE',
      ]);
    });
  });

  describe('EffectivenessRating', () => {
    it('should have UPPERCASE values matching grc_test_results_effectiveness_rating_enum', () => {
      expect(EffectivenessRating.EFFECTIVE).toBe('EFFECTIVE');
      expect(EffectivenessRating.PARTIALLY_EFFECTIVE).toBe(
        'PARTIALLY_EFFECTIVE',
      );
      expect(EffectivenessRating.INEFFECTIVE).toBe('INEFFECTIVE');
    });

    it('should have exactly 3 values', () => {
      const values = Object.values(EffectivenessRating);
      expect(values).toHaveLength(3);
      expect(values).toEqual([
        'EFFECTIVE',
        'PARTIALLY_EFFECTIVE',
        'INEFFECTIVE',
      ]);
    });
  });

  describe('CAPATaskStatus', () => {
    it('should have UPPERCASE values matching grc_capa_tasks_status_enum', () => {
      expect(CAPATaskStatus.PENDING).toBe('PENDING');
      expect(CAPATaskStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(CAPATaskStatus.COMPLETED).toBe('COMPLETED');
      expect(CAPATaskStatus.CANCELLED).toBe('CANCELLED');
    });

    it('should have exactly 4 values', () => {
      const values = Object.values(CAPATaskStatus);
      expect(values).toHaveLength(4);
      expect(values).toEqual([
        'PENDING',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
      ]);
    });
  });

  describe('ControlEvidenceType', () => {
    it('should have UPPERCASE values matching grc_control_evidence_evidence_type_enum', () => {
      expect(ControlEvidenceType.BASELINE).toBe('BASELINE');
      expect(ControlEvidenceType.TEST).toBe('TEST');
      expect(ControlEvidenceType.PERIODIC).toBe('PERIODIC');
    });

    it('should have exactly 3 values', () => {
      const values = Object.values(ControlEvidenceType);
      expect(values).toHaveLength(3);
      expect(values).toEqual(['BASELINE', 'TEST', 'PERIODIC']);
    });
  });

  describe('CAPAPriority', () => {
    it('should have UPPERCASE values matching grc_capas_priority_enum', () => {
      expect(CAPAPriority.LOW).toBe('LOW');
      expect(CAPAPriority.MEDIUM).toBe('MEDIUM');
      expect(CAPAPriority.HIGH).toBe('HIGH');
      expect(CAPAPriority.CRITICAL).toBe('CRITICAL');
    });

    it('should have exactly 4 values', () => {
      const values = Object.values(CAPAPriority);
      expect(values).toHaveLength(4);
      expect(values).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    });
  });

  describe('Enum value format validation', () => {
    it('all Golden Flow enum values should be UPPERCASE', () => {
      const allEnums = [
        ControlTestType,
        ControlTestStatus,
        TestResultOutcome,
        EffectivenessRating,
        CAPATaskStatus,
        ControlEvidenceType,
        CAPAPriority,
      ];

      for (const enumObj of allEnums) {
        const values = Object.values(enumObj);
        for (const value of values) {
          expect(value).toBe(value.toUpperCase());
        }
      }
    });
  });
});
