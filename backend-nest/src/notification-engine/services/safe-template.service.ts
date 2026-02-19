import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../../common/logger';

const MAX_TEMPLATE_LENGTH = 10000;
const MAX_OUTPUT_LENGTH = 50000;
const MAX_ITERATIONS = 1000;

@Injectable()
export class SafeTemplateService {
  private readonly logger: StructuredLoggerService;

  constructor() {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('SafeTemplateService');
  }

  render(
    template: string,
    variables: Record<string, unknown>,
    allowedVariables?: string[],
  ): string {
    if (!template) return '';

    if (template.length > MAX_TEMPLATE_LENGTH) {
      this.logger.warn('Template exceeds max length', {
        length: template.length,
        max: MAX_TEMPLATE_LENGTH,
      });
      return this.escapeHtml(template.substring(0, MAX_TEMPLATE_LENGTH));
    }

    const safeVars = this.filterVariables(variables, allowedVariables);
    let result = template;
    let iterations = 0;

    result = result.replace(
      /\{\{(\s*[\w.]+\s*)\}\}/g,
      (_match, key: string) => {
        iterations++;
        if (iterations > MAX_ITERATIONS) return '';

        const trimmedKey = key.trim();
        const value = this.resolveVariable(trimmedKey, safeVars);

        if (value === undefined || value === null) return '';

        const strValue =
          typeof value === 'object'
            ? JSON.stringify(value)
            : `${value as string | number | boolean}`;
        return this.escapeHtml(strValue);
      },
    );

    result = this.processConditionals(result, safeVars);

    if (result.length > MAX_OUTPUT_LENGTH) {
      result = result.substring(0, MAX_OUTPUT_LENGTH);
    }

    return result;
  }

  renderSubject(
    template: string,
    variables: Record<string, unknown>,
    allowedVariables?: string[],
  ): string {
    return this.stripHtml(this.render(template, variables, allowedVariables));
  }

  private filterVariables(
    variables: Record<string, unknown>,
    allowedVariables?: string[],
  ): Record<string, unknown> {
    if (!allowedVariables || allowedVariables.length === 0) {
      return variables;
    }

    const filtered: Record<string, unknown> = {};
    for (const key of allowedVariables) {
      const value = this.resolveVariable(key, variables);
      if (value !== undefined) {
        this.setNestedValue(filtered, key, value);
      }
    }
    return filtered;
  }

  private resolveVariable(path: string, obj: Record<string, unknown>): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  private processConditionals(
    template: string,
    variables: Record<string, unknown>,
  ): string {
    return template.replace(
      /\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
      (_match, key: string, ifBlock: string, elseBlock: string) => {
        const value = this.resolveVariable(key.trim(), variables);
        if (value && value !== '' && value !== 0) {
          return ifBlock;
        }
        return elseBlock || '';
      },
    );
  }

  escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private stripHtml(str: string): string {
    return str.replace(/<[^>]*>/g, '');
  }

  validateTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (template.length > MAX_TEMPLATE_LENGTH) {
      errors.push(`Template exceeds maximum length of ${MAX_TEMPLATE_LENGTH}`);
    }

    const dangerousPatterns = [
      /\{\{.*eval\s*\(/i,
      /\{\{.*Function\s*\(/i,
      /\{\{.*constructor\s*\(/i,
      /\{\{.*__proto__/i,
      /\{\{.*prototype/i,
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(template)) {
        errors.push(
          `Template contains potentially unsafe pattern: ${pattern.source}`,
        );
      }
    }

    const openTags = (template.match(/\{\{#if\s+/g) || []).length;
    const closeTags = (template.match(/\{\{\/if\}\}/g) || []).length;
    if (openTags !== closeTags) {
      errors.push(
        `Mismatched if/endif blocks: ${openTags} opens, ${closeTags} closes`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  previewTemplate(
    template: string,
    sampleData: Record<string, unknown>,
  ): { rendered: string; errors: string[] } {
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      return { rendered: '', errors: validation.errors };
    }

    const rendered = this.render(template, sampleData);
    return { rendered, errors: [] };
  }
}
