import { RiskBand } from '../enums';

/**
 * Risk Scoring Utilities
 *
 * Helper functions for calculating risk scores and bands.
 * Score = likelihood × impact (1-5 scale each, resulting in 1-25 range)
 * Bands: 1-4 Low, 5-9 Medium, 10-15 High, 16-25 Critical
 */

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
