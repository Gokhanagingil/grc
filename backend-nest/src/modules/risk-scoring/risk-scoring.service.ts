import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';

/**
 * Risk Scoring Engine
 * Calculates risk scores based on likelihood, impact, and control effectiveness
 */

export interface RiskScoreInput {
  likelihood: number; // 1-5
  impact: number; // 1-5
  controlEffectiveness: number; // 0-1 (0 = no controls, 1 = fully controlled)
}

export interface RiskScoreResult {
  inherentRisk: number; // likelihood × impact
  residualRisk: number; // inherentRisk × (1 - controlEffectiveness)
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  color: string;
}

@Injectable()
export class RiskScoringService {
  private readonly logger = new Logger(RiskScoringService.name);

  /**
   * Calculate risk score
   */
  calculateRiskScore(input: RiskScoreInput): RiskScoreResult {
    // Validate inputs
    const likelihood = Math.max(1, Math.min(5, input.likelihood));
    const impact = Math.max(1, Math.min(5, input.impact));
    const controlEffectiveness = Math.max(
      0,
      Math.min(1, input.controlEffectiveness),
    );

    // Inherent risk = likelihood × impact (1-25 scale)
    const inherentRisk = likelihood * impact;

    // Residual risk = inherentRisk × (1 - controlEffectiveness)
    const residualRisk = inherentRisk * (1 - controlEffectiveness);

    // Determine risk level based on residual risk
    let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    let color: string;

    if (residualRisk <= 5) {
      riskLevel = 'Low';
      color = '#4caf50'; // Green
    } else if (residualRisk <= 10) {
      riskLevel = 'Medium';
      color = '#ff9800'; // Orange
    } else if (residualRisk <= 18) {
      riskLevel = 'High';
      color = '#f44336'; // Red
    } else {
      riskLevel = 'Critical';
      color = '#9c27b0'; // Purple
    }

    return {
      inherentRisk,
      residualRisk: Math.round(residualRisk * 100) / 100, // Round to 2 decimals
      riskLevel,
      color,
    };
  }

  /**
   * Calculate control effectiveness from linked controls
   * Queries control library for actual effectiveness values
   */
  async calculateControlEffectiveness(
    controlsLinked: string[],
    controlRepository?: any,
  ): Promise<number> {
    if (!controlRepository || controlsLinked.length === 0) {
      return 0;
    }

    try {
      // Query controls and sum effectiveness (max 0.85)
      const controls = await controlRepository.find({
        where: { id: In(controlsLinked) },
      });

      let totalEffectiveness = 0;
      for (const control of controls) {
        const eff = control.effectiveness || 0.15; // Default 15% if not set
        totalEffectiveness += eff;
      }

      // Cap at 85% (never 100% due to inherent risk)
      return Math.min(0.85, totalEffectiveness);
    } catch (error) {
      // Fallback: simple calculation
      return Math.min(0.85, controlsLinked.length * 0.15);
    }
  }

  /**
   * Synchronous version (for backward compatibility)
   * Uses simple calculation if repository not available
   */
  calculateControlEffectivenessSync(
    controlsLinked: string[],
    controlEffectivenessMap?: Map<string, number>,
  ): number {
    if (!controlEffectivenessMap || controlsLinked.length === 0) {
      return 0;
    }

    let totalEffectiveness = 0;
    for (const controlId of controlsLinked) {
      const eff = controlEffectivenessMap.get(controlId) || 0.15;
      totalEffectiveness += eff;
    }

    return Math.min(0.85, totalEffectiveness);
  }

  /**
   * Get risk matrix (likelihood × impact)
   */
  getRiskMatrix(): number[][] {
    const matrix: number[][] = [];
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const row: number[] = [];
      for (let impact = 1; impact <= 5; impact++) {
        row.push(likelihood * impact);
      }
      matrix.push(row);
    }
    return matrix;
  }
}
