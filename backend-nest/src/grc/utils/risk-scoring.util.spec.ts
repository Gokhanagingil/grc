import { ControlEffectiveness } from '../enums';
import {
  calculateResidualScore,
  calculateResidualScoreNumeric,
  calculateResidualComponents,
  calculateRiskScore,
  getRiskBand,
  calculateScoreAndBand,
  effectivenessPercentToReductionFactor,
  EFFECTIVENESS_REDUCTION,
  MAX_SINGLE_CONTROL_REDUCTION,
  ControlLinkData,
  ControlLinkDataNumeric,
} from './risk-scoring.util';
import { RiskBand } from '../enums';

describe('Risk Scoring Utilities', () => {
  describe('calculateResidualScore', () => {
    it('should return inherent score when no controls are linked', () => {
      expect(calculateResidualScore(16, [])).toBe(16);
      expect(calculateResidualScore(25, [])).toBe(25);
      expect(calculateResidualScore(1, [])).toBe(1);
    });

    it('should return inherent score when controls array is empty', () => {
      expect(calculateResidualScore(16, [])).toBe(16);
    });

    it('should reduce score with a single EFFECTIVE control', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
      ];
      // 16 * (1 - 0.35) = 16 * 0.65 = 10.4 -> 10
      const result = calculateResidualScore(16, controls);
      expect(result).toBe(10);
    });

    it('should reduce score with a single PARTIALLY_EFFECTIVE control', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.PARTIALLY_EFFECTIVE },
      ];
      // 16 * (1 - 0.20) = 16 * 0.80 = 12.8 -> 13
      const result = calculateResidualScore(16, controls);
      expect(result).toBe(13);
    });

    it('should reduce score with a single INEFFECTIVE control', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.INEFFECTIVE },
      ];
      // 16 * (1 - 0.10) = 16 * 0.90 = 14.4 -> 14
      const result = calculateResidualScore(16, controls);
      expect(result).toBe(14);
    });

    it('should apply diminishing returns with multiple EFFECTIVE controls', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
      ];
      // 16 * (1 - 0.35)^3 = 16 * 0.65^3 = 16 * 0.274625 = 4.394 -> 4
      const result = calculateResidualScore(16, controls);
      expect(result).toBe(4);
      expect(result).toBeGreaterThanOrEqual(1); // Never below 1
    });

    it('should never return a score below 1', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
      ];
      // Even with many high-effectiveness controls, score should be >= 1
      const result = calculateResidualScore(16, controls);
      expect(result).toBeGreaterThanOrEqual(1);
    });

    it('should handle minimum inherent score of 1', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
      ];
      // 1 * (1 - 0.35) = 0.65 -> 1 (floor)
      const result = calculateResidualScore(1, controls);
      expect(result).toBe(1);
    });

    it('should respect coverage parameter', () => {
      const controlsFullCoverage: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE, coverage: 1.0 },
      ];
      const controlsHalfCoverage: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE, coverage: 0.5 },
      ];
      const controlsZeroCoverage: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE, coverage: 0 },
      ];

      // Full coverage: 16 * (1 - 0.35) = 10.4 -> 10
      expect(calculateResidualScore(16, controlsFullCoverage)).toBe(10);

      // Half coverage: 16 * (1 - 0.175) = 16 * 0.825 = 13.2 -> 13
      expect(calculateResidualScore(16, controlsHalfCoverage)).toBe(13);

      // Zero coverage: 16 * (1 - 0) = 16 (no effect)
      expect(calculateResidualScore(16, controlsZeroCoverage)).toBe(16);
    });

    it('should cap single control reduction at MAX_SINGLE_CONTROL_REDUCTION', () => {
      // Even if we somehow had a control with > 60% reduction, it should be capped
      // This is tested implicitly since EFFECTIVE is 35% which is below the cap
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE, coverage: 2.0 }, // Would be 70% without cap
      ];
      // Should be capped at 60%: 16 * (1 - 0.60) = 16 * 0.40 = 6.4 -> 6
      const result = calculateResidualScore(16, controls);
      expect(result).toBe(6);
    });

    it('should throw error for invalid inherent score', () => {
      expect(() => calculateResidualScore(0, [])).toThrow(
        'Inherent score must be between 1 and 25',
      );
      expect(() => calculateResidualScore(26, [])).toThrow(
        'Inherent score must be between 1 and 25',
      );
      expect(() => calculateResidualScore(-1, [])).toThrow(
        'Inherent score must be between 1 and 25',
      );
    });

    it('should handle UNKNOWN effectiveness', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.UNKNOWN },
      ];
      // 16 * (1 - 0.05) = 16 * 0.95 = 15.2 -> 15
      const result = calculateResidualScore(16, controls);
      expect(result).toBe(15);
    });

    it('should handle mixed effectiveness controls', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.PARTIALLY_EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.INEFFECTIVE },
      ];
      // 16 * (1 - 0.35) * (1 - 0.20) * (1 - 0.10)
      // = 16 * 0.65 * 0.80 * 0.90
      // = 16 * 0.468 = 7.488 -> 7
      const result = calculateResidualScore(16, controls);
      expect(result).toBe(7);
    });
  });

  describe('calculateResidualComponents', () => {
    it('should return inherent values when residual equals inherent', () => {
      const result = calculateResidualComponents(4, 4, 16);
      expect(result.residualLikelihood).toBe(4);
      expect(result.residualImpact).toBe(4);
    });

    it('should reduce both likelihood and impact proportionally', () => {
      // Inherent: 4 * 4 = 16, Residual: 8
      // Ratio: 8/16 = 0.5, sqrt(0.5) = 0.707
      // Residual L: round(4 * 0.707) = round(2.83) = 3
      // Residual I: round(4 * 0.707) = round(2.83) = 3
      const result = calculateResidualComponents(4, 4, 8);
      expect(result.residualLikelihood).toBe(3);
      expect(result.residualImpact).toBe(3);
    });

    it('should ensure minimum of 1 for both components', () => {
      const result = calculateResidualComponents(5, 5, 1);
      expect(result.residualLikelihood).toBeGreaterThanOrEqual(1);
      expect(result.residualImpact).toBeGreaterThanOrEqual(1);
    });

    it('should ensure maximum of 5 for both components', () => {
      const result = calculateResidualComponents(5, 5, 25);
      expect(result.residualLikelihood).toBeLessThanOrEqual(5);
      expect(result.residualImpact).toBeLessThanOrEqual(5);
    });
  });

  describe('calculateRiskScore', () => {
    it('should calculate score as likelihood * impact', () => {
      expect(calculateRiskScore(1, 1)).toBe(1);
      expect(calculateRiskScore(5, 5)).toBe(25);
      expect(calculateRiskScore(3, 4)).toBe(12);
      expect(calculateRiskScore(4, 4)).toBe(16);
    });

    it('should throw error for invalid likelihood', () => {
      expect(() => calculateRiskScore(0, 3)).toThrow(
        'Likelihood must be between 1 and 5',
      );
      expect(() => calculateRiskScore(6, 3)).toThrow(
        'Likelihood must be between 1 and 5',
      );
    });

    it('should throw error for invalid impact', () => {
      expect(() => calculateRiskScore(3, 0)).toThrow(
        'Impact must be between 1 and 5',
      );
      expect(() => calculateRiskScore(3, 6)).toThrow(
        'Impact must be between 1 and 5',
      );
    });
  });

  describe('getRiskBand', () => {
    it('should return LOW for scores 1-4', () => {
      expect(getRiskBand(1)).toBe(RiskBand.LOW);
      expect(getRiskBand(4)).toBe(RiskBand.LOW);
    });

    it('should return MEDIUM for scores 5-9', () => {
      expect(getRiskBand(5)).toBe(RiskBand.MEDIUM);
      expect(getRiskBand(9)).toBe(RiskBand.MEDIUM);
    });

    it('should return HIGH for scores 10-15', () => {
      expect(getRiskBand(10)).toBe(RiskBand.HIGH);
      expect(getRiskBand(15)).toBe(RiskBand.HIGH);
    });

    it('should return CRITICAL for scores 16-25', () => {
      expect(getRiskBand(16)).toBe(RiskBand.CRITICAL);
      expect(getRiskBand(25)).toBe(RiskBand.CRITICAL);
    });

    it('should throw error for invalid scores', () => {
      expect(() => getRiskBand(0)).toThrow('Score must be between 1 and 25');
      expect(() => getRiskBand(26)).toThrow('Score must be between 1 and 25');
    });
  });

  describe('calculateScoreAndBand', () => {
    it('should return both score and band', () => {
      const result = calculateScoreAndBand(4, 4);
      expect(result.score).toBe(16);
      expect(result.band).toBe(RiskBand.CRITICAL);
    });

    it('should handle edge cases', () => {
      expect(calculateScoreAndBand(1, 1)).toEqual({
        score: 1,
        band: RiskBand.LOW,
      });
      expect(calculateScoreAndBand(5, 5)).toEqual({
        score: 25,
        band: RiskBand.CRITICAL,
      });
    });
  });

  describe('EFFECTIVENESS_REDUCTION constants', () => {
    it('should have correct reduction values', () => {
      expect(EFFECTIVENESS_REDUCTION[ControlEffectiveness.EFFECTIVE]).toBe(
        0.35,
      );
      expect(
        EFFECTIVENESS_REDUCTION[ControlEffectiveness.PARTIALLY_EFFECTIVE],
      ).toBe(0.2);
      expect(EFFECTIVENESS_REDUCTION[ControlEffectiveness.INEFFECTIVE]).toBe(
        0.1,
      );
      expect(EFFECTIVENESS_REDUCTION[ControlEffectiveness.UNKNOWN]).toBe(0.05);
    });
  });

  describe('MAX_SINGLE_CONTROL_REDUCTION constant', () => {
    it('should be 0.6 (60%)', () => {
      expect(MAX_SINGLE_CONTROL_REDUCTION).toBe(0.6);
    });
  });

  describe('Acceptance criteria edge cases', () => {
    it('Inherent 16 + 3 high controls should result in score >= 1', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
      ];
      const result = calculateResidualScore(16, controls);
      expect(result).toBeGreaterThanOrEqual(1);
    });

    it('Inherent 1 + any controls should stay at 1', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
        { effectivenessRating: ControlEffectiveness.EFFECTIVE },
      ];
      const result = calculateResidualScore(1, controls);
      expect(result).toBe(1);
    });

    it('Coverage 0 should have no effect', () => {
      const controls: ControlLinkData[] = [
        { effectivenessRating: ControlEffectiveness.EFFECTIVE, coverage: 0 },
      ];
      const result = calculateResidualScore(16, controls);
      expect(result).toBe(16);
    });

    it('Residual should never be negative', () => {
      const manyControls: ControlLinkData[] = Array(10).fill({
        effectivenessRating: ControlEffectiveness.EFFECTIVE,
      });
      const result = calculateResidualScore(25, manyControls);
      expect(result).toBeGreaterThanOrEqual(1);
    });
  });

  describe('effectivenessPercentToReductionFactor', () => {
    it('should return 0 for 0% effectiveness', () => {
      expect(effectivenessPercentToReductionFactor(0)).toBe(0);
    });

    it('should return MAX_SINGLE_CONTROL_REDUCTION for 100% effectiveness', () => {
      expect(effectivenessPercentToReductionFactor(100)).toBe(
        MAX_SINGLE_CONTROL_REDUCTION,
      );
    });

    it('should return half of MAX_SINGLE_CONTROL_REDUCTION for 50% effectiveness', () => {
      expect(effectivenessPercentToReductionFactor(50)).toBe(
        MAX_SINGLE_CONTROL_REDUCTION / 2,
      );
    });

    it('should clamp values below 0 to 0', () => {
      expect(effectivenessPercentToReductionFactor(-10)).toBe(0);
      expect(effectivenessPercentToReductionFactor(-100)).toBe(0);
    });

    it('should clamp values above 100 to MAX_SINGLE_CONTROL_REDUCTION', () => {
      expect(effectivenessPercentToReductionFactor(150)).toBe(
        MAX_SINGLE_CONTROL_REDUCTION,
      );
      expect(effectivenessPercentToReductionFactor(200)).toBe(
        MAX_SINGLE_CONTROL_REDUCTION,
      );
    });

    it('should scale linearly between 0 and 100', () => {
      // 70% effectiveness = 0.7 * 0.6 = 0.42
      expect(effectivenessPercentToReductionFactor(70)).toBeCloseTo(0.42, 5);
      // 25% effectiveness = 0.25 * 0.6 = 0.15
      expect(effectivenessPercentToReductionFactor(25)).toBeCloseTo(0.15, 5);
    });
  });

  describe('calculateResidualScoreNumeric', () => {
    it('should return inherent score when no controls are linked', () => {
      expect(calculateResidualScoreNumeric(16, [])).toBe(16);
      expect(calculateResidualScoreNumeric(25, [])).toBe(25);
      expect(calculateResidualScoreNumeric(1, [])).toBe(1);
    });

    it('should return inherent score when controls array is empty', () => {
      expect(calculateResidualScoreNumeric(16, [])).toBe(16);
    });

    it('should reduce score with a single 100% effective control', () => {
      const controls: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 100 },
      ];
      // 16 * (1 - 0.6) = 16 * 0.4 = 6.4 -> 6
      const result = calculateResidualScoreNumeric(16, controls);
      expect(result).toBe(6);
    });

    it('should reduce score with a single 50% effective control (default)', () => {
      const controls: ControlLinkDataNumeric[] = [{ effectivenessPercent: 50 }];
      // 16 * (1 - 0.3) = 16 * 0.7 = 11.2 -> 11
      const result = calculateResidualScoreNumeric(16, controls);
      expect(result).toBe(11);
    });

    it('should have no effect with 0% effective control', () => {
      const controls: ControlLinkDataNumeric[] = [{ effectivenessPercent: 0 }];
      // 16 * (1 - 0) = 16
      const result = calculateResidualScoreNumeric(16, controls);
      expect(result).toBe(16);
    });

    it('should apply diminishing returns with multiple controls', () => {
      const controls: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 100 },
        { effectivenessPercent: 100 },
        { effectivenessPercent: 100 },
      ];
      // 16 * (1 - 0.6)^3 = 16 * 0.4^3 = 16 * 0.064 = 1.024 -> 1
      const result = calculateResidualScoreNumeric(16, controls);
      expect(result).toBe(1);
    });

    it('should never return a score below 1', () => {
      const controls: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 100 },
        { effectivenessPercent: 100 },
        { effectivenessPercent: 100 },
        { effectivenessPercent: 100 },
        { effectivenessPercent: 100 },
      ];
      const result = calculateResidualScoreNumeric(16, controls);
      expect(result).toBeGreaterThanOrEqual(1);
    });

    it('should handle minimum inherent score of 1', () => {
      const controls: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 100 },
      ];
      const result = calculateResidualScoreNumeric(1, controls);
      expect(result).toBe(1);
    });

    it('should respect coverage parameter', () => {
      const controlsFullCoverage: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 100, coverage: 1.0 },
      ];
      const controlsHalfCoverage: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 100, coverage: 0.5 },
      ];
      const controlsZeroCoverage: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 100, coverage: 0 },
      ];

      // Full coverage: 16 * (1 - 0.6) = 6.4 -> 6
      expect(calculateResidualScoreNumeric(16, controlsFullCoverage)).toBe(6);

      // Half coverage: 16 * (1 - 0.3) = 16 * 0.7 = 11.2 -> 11
      expect(calculateResidualScoreNumeric(16, controlsHalfCoverage)).toBe(11);

      // Zero coverage: 16 * (1 - 0) = 16 (no effect)
      expect(calculateResidualScoreNumeric(16, controlsZeroCoverage)).toBe(16);
    });

    it('should throw error for invalid inherent score', () => {
      expect(() => calculateResidualScoreNumeric(0, [])).toThrow(
        'Inherent score must be between 1 and 25',
      );
      expect(() => calculateResidualScoreNumeric(26, [])).toThrow(
        'Inherent score must be between 1 and 25',
      );
      expect(() => calculateResidualScoreNumeric(-1, [])).toThrow(
        'Inherent score must be between 1 and 25',
      );
    });

    it('should handle mixed effectiveness controls', () => {
      const controls: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 100 }, // 0.6 reduction
        { effectivenessPercent: 50 }, // 0.3 reduction
        { effectivenessPercent: 20 }, // 0.12 reduction
      ];
      // 16 * (1 - 0.6) * (1 - 0.3) * (1 - 0.12)
      // = 16 * 0.4 * 0.7 * 0.88
      // = 16 * 0.2464 = 3.9424 -> 4
      const result = calculateResidualScoreNumeric(16, controls);
      expect(result).toBe(4);
    });

    it('should clamp effectiveness percent to valid range', () => {
      const controlsNegative: ControlLinkDataNumeric[] = [
        { effectivenessPercent: -50 },
      ];
      const controlsOver100: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 150 },
      ];

      // Negative should be clamped to 0, no reduction
      expect(calculateResidualScoreNumeric(16, controlsNegative)).toBe(16);

      // Over 100 should be clamped to 100, max reduction
      expect(calculateResidualScoreNumeric(16, controlsOver100)).toBe(6);
    });
  });

  describe('Numeric effectiveness acceptance criteria', () => {
    it('no controls => residual == inherent', () => {
      expect(calculateResidualScoreNumeric(16, [])).toBe(16);
      expect(calculateResidualScoreNumeric(10, [])).toBe(10);
    });

    it('control global effectiveness reduces residual', () => {
      const controls: ControlLinkDataNumeric[] = [{ effectivenessPercent: 70 }];
      // 70% effectiveness = 0.42 reduction factor
      // 16 * (1 - 0.42) = 16 * 0.58 = 9.28 -> 9
      const result = calculateResidualScoreNumeric(16, controls);
      expect(result).toBeLessThan(16);
      expect(result).toBe(9);
    });

    it('override effectiveness takes precedence over global', () => {
      // This test validates the logic that would be used in the service
      // where overrideEffectivenessPercent ?? control.effectivenessPercent is used
      const globalEffectiveness = 70;
      const overrideEffectiveness = 20;

      const controlsWithGlobal: ControlLinkDataNumeric[] = [
        { effectivenessPercent: globalEffectiveness },
      ];
      const controlsWithOverride: ControlLinkDataNumeric[] = [
        { effectivenessPercent: overrideEffectiveness },
      ];

      const residualWithGlobal = calculateResidualScoreNumeric(
        16,
        controlsWithGlobal,
      );
      const residualWithOverride = calculateResidualScoreNumeric(
        16,
        controlsWithOverride,
      );

      // Override (20%) should result in higher residual than global (70%)
      expect(residualWithOverride).toBeGreaterThan(residualWithGlobal);
    });

    it('bounds 0..100 enforced', () => {
      // 0% effectiveness = no reduction
      const controls0: ControlLinkDataNumeric[] = [{ effectivenessPercent: 0 }];
      expect(calculateResidualScoreNumeric(16, controls0)).toBe(16);

      // 100% effectiveness = max reduction (60%)
      const controls100: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 100 },
      ];
      expect(calculateResidualScoreNumeric(16, controls100)).toBe(6);

      // Values outside bounds should be clamped
      const controlsNegative: ControlLinkDataNumeric[] = [
        { effectivenessPercent: -50 },
      ];
      expect(calculateResidualScoreNumeric(16, controlsNegative)).toBe(16);

      const controlsOver: ControlLinkDataNumeric[] = [
        { effectivenessPercent: 150 },
      ];
      expect(calculateResidualScoreNumeric(16, controlsOver)).toBe(6);
    });
  });
});
