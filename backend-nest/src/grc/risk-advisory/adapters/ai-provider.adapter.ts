import { Injectable } from '@nestjs/common';
import { AdvisoryResult, RiskTheme } from '../dto/advisory.dto';

/**
 * AI Provider Adapter Interface
 *
 * Defines the contract for AI-powered advisory generation.
 * Phase 1 uses a stub/deterministic implementation.
 * Phase 2 will integrate real LLM providers (OpenAI/Azure/Bedrock).
 *
 * The adapter receives structured risk context and returns
 * an advisory result. The implementation can be swapped
 * without changing the service layer.
 */
export interface AiProviderAdapter {
  /**
   * Generate an advisory from structured risk context.
   * Returns null if the provider cannot generate an advisory
   * (e.g., stub mode with insufficient context).
   */
  generateAdvisory(context: AiAdvisoryContext): Promise<AiAdvisoryResponse | null>;

  /**
   * Check if the provider is available and configured.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the provider name for explainability tracking.
   */
  getProviderName(): string;
}

export interface AiAdvisoryContext {
  riskId: string;
  riskTitle: string;
  riskDescription: string | null;
  riskCategory: string | null;
  riskSeverity: string;
  riskLikelihood: string;
  riskImpact: string;
  inherentScore: number | null;
  residualScore: number | null;
  linkedControls: Array<{
    id: string;
    name: string;
    status: string;
    effectivenessPercent?: number;
  }>;
  linkedPolicies: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  affectedCis: Array<{
    id: string;
    name: string;
    className?: string;
    lifecycle?: string;
    environment?: string;
  }>;
  affectedServices: Array<{
    id: string;
    name: string;
  }>;
}

export interface AiAdvisoryResponse {
  summary: string;
  riskTheme: RiskTheme;
  confidence: number;
  mitigationSuggestions: string[];
  warnings: string[];
  assumptions: string[];
}

/**
 * Stub AI Provider - Deterministic Implementation
 *
 * Returns null for all requests, signaling the service
 * to use deterministic heuristics instead.
 * This stub satisfies the AiProviderAdapter contract
 * and will be replaced with a real LLM provider in Phase 2.
 */
@Injectable()
export class StubAiProvider implements AiProviderAdapter {
  async generateAdvisory(
    _context: AiAdvisoryContext,
  ): Promise<AiAdvisoryResponse | null> {
    // Stub: always returns null, forcing deterministic heuristics
    return null;
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  getProviderName(): string {
    return 'stub-deterministic';
  }
}
