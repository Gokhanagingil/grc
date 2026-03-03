import { Logger } from '@nestjs/common';
import {
  AiAdvisorProvider,
  AiAdvisorInput,
  AiAdviceOutput,
} from './ai-advisor-provider.interface';
import { StubAdvisorProvider } from './stub-advisor.provider';

/**
 * Real AI Advisor Provider (shell)
 *
 * Wiring only — behind env vars. Falls back to StubProvider
 * if real provider is not configured (safe degradation).
 *
 * In v0 this is a placeholder. Real provider integration
 * can be added in v1 by implementing the actual API call.
 */
export class RealAdvisorProvider implements AiAdvisorProvider {
  readonly providerName = 'real';
  private readonly logger = new Logger(RealAdvisorProvider.name);
  private readonly fallback = new StubAdvisorProvider();

  private readonly apiUrl: string | undefined;
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiUrl = process.env.AI_ADVISOR_API_URL;
    this.apiKey = process.env.AI_ADVISOR_API_KEY;
  }

  get isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey);
  }

  async generateAdvice(input: AiAdvisorInput): Promise<AiAdviceOutput> {
    if (!this.isConfigured) {
      this.logger.warn(
        'Real AI provider not configured (missing AI_ADVISOR_API_URL or AI_ADVISOR_API_KEY). Falling back to stub.',
      );
      return this.fallback.generateAdvice(input);
    }

    // v0: Real provider integration placeholder
    // In v1, this would make an HTTP call to the AI service
    this.logger.log('Real AI provider called (v0 placeholder — using stub fallback)', {
      apiUrl: this.apiUrl ? '***configured***' : 'missing',
    });

    return this.fallback.generateAdvice(input);
  }
}
