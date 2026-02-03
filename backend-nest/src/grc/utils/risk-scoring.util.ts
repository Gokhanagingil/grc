import { RiskBand, ControlEffectiveness } from '../enums';

/**
 * Risk Scoring Utilities
 *
 * Helper functions for calculating risk scores and bands.
 * Score = likelihood × impact (1-5 scale each, resulting in 1-25 range)
 * Bands: 1-4 Low, 5-9 Medium, 10-15 High, 16-25 Critical
 */

/**
 * Effectiveness reduction factors for residual risk calculation
 * These represent the base reduction percentage for each effectiveness level
 */
export const EFFECTIVENESS_REDUCTION: Record<ControlEffectiveness, number> = {
  [ControlEffectiveness.EFFECTIVE]: 0.35, // High effectiveness = 35% reduction
  [ControlEffectiveness.PARTIALLY_EFFECTIVE]: 0.2, // Medium effectiveness = 20% reduction
  [ControlEffectiveness.INEFFECTIVE]: 0.1, // Low effectiveness = 10% reduction
  [ControlEffectiveness.UNKNOWN]: 0.05, // Unknown = minimal 5% reduction
};

/**
 * Maximum reduction factor for a single control (prevents one control from eliminating all risk)
 */
export const MAX_SINGLE_CONTROL_REDUCTION = 0.6;

/**
 * Control link data for residual risk calculation (enum-based)
 */
export interface ControlLinkData {
  effectivenessRating: ControlEffectiveness;
  coverage?: number; // 0-1, default 1.0
}

/**
 * Control link data for residual risk calculation (numeric percent-based)
 * Used with the new effectivenessPercent model
 */
export interface ControlLinkDataNumeric {
  effectivenessPercent: number; // 0-100
  coverage?: number; // 0-1, default 1.0
}

/**
 * Convert numeric effectiveness percent (0-100) to reduction factor (0-1)
 *
 * The reduction factor represents how much the control reduces risk.
 * A 100% effective control provides maximum reduction (capped at MAX_SINGLE_CONTROL_REDUCTION).
 * A 0% effective control provides no reduction.
 *
 * Formula: reductionFactor = (effectivenessPercent / 100) * MAX_SINGLE_CONTROL_REDUCTION
 *
 * Examples:
 * - 100% effectiveness → 0.60 reduction (capped at MAX_SINGLE_CONTROL_REDUCTION)
 * - 70% effectiveness → 0.42 reduction
 * - 50% effectiveness → 0.30 reduction
 * - 20% effectiveness → 0.12 reduction
 * - 0% effectiveness → 0.00 reduction
 *
 * @param effectivenessPercent - Effectiveness percentage (0-100)
 * @returns Reduction factor (0 to MAX_SINGLE_CONTROL_REDUCTION)
 */
export function effectivenessPercentToReductionFactor(
  effectivenessPercent: number,
): number {
  // Clamp to valid range
  const clampedPercent = Math.max(0, Math.min(100, effectivenessPercent));
  // Convert to reduction factor, scaled to max reduction
  return (clampedPercent / 100) * MAX_SINGLE_CONTROL_REDUCTION;
}

/**
 * Calculate residual risk score using diminishing returns model
 *
 * Formula:
 * 1. For each control, calculate reduction factor: r_i = baseReduction × coverage
 * 2. Cap each r_i at MAX_SINGLE_CONTROL_REDUCTION (0.60)
 * 3. Calculate total multiplier: totalMultiplier = Π(1 - r_i)
 * 4. Calculate raw residual: rawResidual = inherentScore × totalMultiplier
 * 5. Apply floor: residualScore = max(1, round(rawResidual))
 *
 * This model provides:
 * - Diminishing returns: Multiple controls have decreasing marginal benefit
 * - No negative risk: Residual score never goes below 1
 * - Intuitive behavior: High effectiveness controls provide significant reduction
 *
 * @param inherentScore - The inherent risk score (1-25)
 * @param controls - Array of linked controls with effectiveness ratings
 * @returns Calculated residual score (1-25)
 */
export function calculateResidualScore(
  inherentScore: number,
  controls: ControlLinkData[],
): number {
  if (inherentScore < 1 || inherentScore > 25) {
    throw new Error('Inherent score must be between 1 and 25');
  }

  if (!controls || controls.length === 0) {
    return inherentScore;
  }

  let totalMultiplier = 1.0;

  for (const control of controls) {
    const baseReduction =
      EFFECTIVENESS_REDUCTION[control.effectivenessRating] ||
      EFFECTIVENESS_REDUCTION[ControlEffectiveness.UNKNOWN];
    const coverage = control.coverage ?? 1.0;

    // Calculate reduction factor for this control
    let reductionFactor = baseReduction * coverage;

    // Cap at maximum single control reduction
    reductionFactor = Math.min(reductionFactor, MAX_SINGLE_CONTROL_REDUCTION);

    // Apply diminishing returns: multiply by (1 - reduction)
    totalMultiplier *= 1 - reductionFactor;
  }

  // Calculate raw residual score
  const rawResidual = inherentScore * totalMultiplier;

  // Apply floor of 1 and round to nearest integer
  return Math.max(1, Math.round(rawResidual));
}

/**
 * Calculate residual risk score using numeric percent-based effectiveness
 *
 * This is the preferred method for new code. Uses effectivenessPercent (0-100)
 * instead of enum-based effectivenessRating.
 *
 * Formula:
 * 1. For each control, convert effectivenessPercent to reduction factor
 * 2. Apply coverage multiplier: r_i = reductionFactor × coverage
 * 3. Calculate total multiplier: totalMultiplier = Π(1 - r_i)
 * 4. Calculate raw residual: rawResidual = inherentScore × totalMultiplier
 * 5. Apply floor: residualScore = max(1, round(rawResidual))
 *
 * @param inherentScore - The inherent risk score (1-25)
 * @param controls - Array of linked controls with effectiveness percentages
 * @returns Calculated residual score (1-25)
 */
export function calculateResidualScoreNumeric(
  inherentScore: number,
  controls: ControlLinkDataNumeric[],
): number {
  if (inherentScore < 1 || inherentScore > 25) {
    throw new Error('Inherent score must be between 1 and 25');
  }

  if (!controls || controls.length === 0) {
    return inherentScore;
  }

  let totalMultiplier = 1.0;

  for (const control of controls) {
    const reductionFactor = effectivenessPercentToReductionFactor(
      control.effectivenessPercent,
    );
    const coverage = control.coverage ?? 1.0;

    // Apply coverage to reduction factor
    const effectiveReduction = reductionFactor * coverage;

    // Apply diminishing returns: multiply by (1 - reduction)
    totalMultiplier *= 1 - effectiveReduction;
  }

  // Calculate raw residual score
  const rawResidual = inherentScore * totalMultiplier;

  // Apply floor of 1 and round to nearest integer
  return Math.max(1, Math.round(rawResidual));
}

/**
 * Calculate residual likelihood and impact from residual score
 * Uses a balanced approach to distribute the reduction
 *
 * @param inherentLikelihood - Original likelihood (1-5)
 * @param inherentImpact - Original impact (1-5)
 * @param residualScore - Calculated residual score
 * @returns Object with residual likelihood and impact
 */
export function calculateResidualComponents(
  inherentLikelihood: number,
  inherentImpact: number,
  residualScore: number,
): { residualLikelihood: number; residualImpact: number } {
  const inherentScore = inherentLikelihood * inherentImpact;

  if (residualScore >= inherentScore) {
    return {
      residualLikelihood: inherentLikelihood,
      residualImpact: inherentImpact,
    };
  }

  // Calculate reduction ratio
  const reductionRatio = residualScore / inherentScore;

  // Apply reduction proportionally to both likelihood and impact
  // Using square root to distribute evenly (since score = L × I)
  const sqrtRatio = Math.sqrt(reductionRatio);

  let residualLikelihood = Math.round(inherentLikelihood * sqrtRatio);
  let residualImpact = Math.round(inherentImpact * sqrtRatio);

  // Ensure minimum of 1
  residualLikelihood = Math.max(1, residualLikelihood);
  residualImpact = Math.max(1, residualImpact);

  // Ensure maximum of 5
  residualLikelihood = Math.min(5, residualLikelihood);
  residualImpact = Math.min(5, residualImpact);

  return { residualLikelihood, residualImpact };
}

/**
 * Calculate risk score from likelihood and impact
 * @param likelihood - Likelihood value (1-5)
 * @param impact - Impact value (1-5)
 * @returns Calculated score (1-25)
 */
export function calculateRiskScore(likelihood: number, impact: number): number {
  if (likelihood < 1 || likelihood > 5) {
    throw new Error('Likelihood must be between 1 and 5');
  }
  if (impact < 1 || impact > 5) {
    throw new Error('Impact must be between 1 and 5');
  }
  return likelihood * impact;
}

/**
 * Determine risk band from score
 * @param score - Risk score (1-25)
 * @returns Risk band (Low, Medium, High, Critical)
 */
export function getRiskBand(score: number): RiskBand {
  if (score < 1 || score > 25) {
    throw new Error('Score must be between 1 and 25');
  }
  if (score <= 4) {
    return RiskBand.LOW;
  }
  if (score <= 9) {
    return RiskBand.MEDIUM;
  }
  if (score <= 15) {
    return RiskBand.HIGH;
  }
  return RiskBand.CRITICAL;
}

/**
 * Calculate score and band from likelihood and impact
 * @param likelihood - Likelihood value (1-5)
 * @param impact - Impact value (1-5)
 * @returns Object with score and band
 */
export function calculateScoreAndBand(
  likelihood: number,
  impact: number,
): { score: number; band: RiskBand } {
  const score = calculateRiskScore(likelihood, impact);
  const band = getRiskBand(score);
  return { score, band };
}

/**
 * Get band color for UI display
 * @param band - Risk band
 * @returns Hex color code
 */
export function getBandColor(band: RiskBand): string {
  switch (band) {
    case RiskBand.LOW:
      return '#4caf50'; // Green
    case RiskBand.MEDIUM:
      return '#ff9800'; // Orange
    case RiskBand.HIGH:
      return '#f44336'; // Red
    case RiskBand.CRITICAL:
      return '#9c27b0'; // Purple
    default:
      return '#9e9e9e'; // Grey
  }
}

/**
 * Get band label for display
 * @param band - Risk band
 * @returns Human-readable label
 */
export function getBandLabel(band: RiskBand): string {
  switch (band) {
    case RiskBand.LOW:
      return 'Low';
    case RiskBand.MEDIUM:
      return 'Medium';
    case RiskBand.HIGH:
      return 'High';
    case RiskBand.CRITICAL:
      return 'Critical';
    default:
      return 'Unknown';
  }
}

/**
 * Heatmap cell structure for aggregation
 */
export interface HeatmapCell {
  likelihood: number;
  impact: number;
  count: number;
  band: RiskBand;
}

/**
 * Heatmap data structure
 */
export interface HeatmapData {
  inherent: HeatmapCell[];
  residual: HeatmapCell[];
}

/**
 * Generate empty heatmap grid (5x5)
 * @returns Array of 25 cells with zero counts
 */
export function generateEmptyHeatmapGrid(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let likelihood = 1; likelihood <= 5; likelihood++) {
    for (let impact = 1; impact <= 5; impact++) {
      const { band } = calculateScoreAndBand(likelihood, impact);
      cells.push({
        likelihood,
        impact,
        count: 0,
        band,
      });
    }
  }
  return cells;
}

/**
 * Aggregate risks into heatmap data
 * @param risks - Array of risks with likelihood/impact values
 * @returns Heatmap data with inherent and residual grids
 */
export function aggregateRisksToHeatmap(
  risks: Array<{
    inherentLikelihood?: number | null;
    inherentImpact?: number | null;
    residualLikelihood?: number | null;
    residualImpact?: number | null;
  }>,
): HeatmapData {
  const inherentGrid = generateEmptyHeatmapGrid();
  const residualGrid = generateEmptyHeatmapGrid();

  for (const risk of risks) {
    // Aggregate inherent scores
    if (
      risk.inherentLikelihood != null &&
      risk.inherentImpact != null &&
      risk.inherentLikelihood >= 1 &&
      risk.inherentLikelihood <= 5 &&
      risk.inherentImpact >= 1 &&
      risk.inherentImpact <= 5
    ) {
      const inherentIndex =
        (risk.inherentLikelihood - 1) * 5 + (risk.inherentImpact - 1);
      inherentGrid[inherentIndex].count++;
    }

    // Aggregate residual scores
    if (
      risk.residualLikelihood != null &&
      risk.residualImpact != null &&
      risk.residualLikelihood >= 1 &&
      risk.residualLikelihood <= 5 &&
      risk.residualImpact >= 1 &&
      risk.residualImpact <= 5
    ) {
      const residualIndex =
        (risk.residualLikelihood - 1) * 5 + (risk.residualImpact - 1);
      residualGrid[residualIndex].count++;
    }
  }

  return {
    inherent: inherentGrid,
    residual: residualGrid,
  };
}
