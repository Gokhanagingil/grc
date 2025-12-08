import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import {
  GrcAuditReportTemplate,
  TemplateSectionConfig,
} from '../entities/grc-audit-report-template.entity';
import { AuditStandard, TemplateLanguage } from '../enums';

/**
 * Audit context data for template rendering
 */
export interface AuditContext {
  audit: {
    id: string;
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    auditor?: string;
    status?: string;
  };
  organization?: {
    name: string;
    address?: string;
    contact?: string;
  };
  findings?: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    status: string;
  }>;
  recommendations?: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
  }>;
  controls?: Array<{
    id: string;
    name: string;
    status: string;
    effectiveness?: string;
  }>;
  risks?: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
  }>;
  [key: string]: unknown;
}

/**
 * GRC Audit Report Template Service
 *
 * Multi-tenant service for managing audit report templates.
 * Provides template loading and rendering with placeholder replacement.
 */
@Injectable()
export class GrcAuditReportTemplateService extends MultiTenantServiceBase<GrcAuditReportTemplate> {
  constructor(
    @InjectRepository(GrcAuditReportTemplate)
    repository: Repository<GrcAuditReportTemplate>,
  ) {
    super(repository);
  }

  /**
   * Get all templates for a tenant
   */
  async getTemplates(
    tenantId: string,
    filters?: {
      standard?: AuditStandard;
      language?: TemplateLanguage;
      isActive?: boolean;
    },
  ): Promise<GrcAuditReportTemplate[]> {
    const queryBuilder = this.repository.createQueryBuilder('template');
    queryBuilder.where('template.tenantId = :tenantId', { tenantId });
    queryBuilder.andWhere('template.isDeleted = :isDeleted', {
      isDeleted: false,
    });

    if (filters?.standard) {
      queryBuilder.andWhere('template.standard = :standard', {
        standard: filters.standard,
      });
    }

    if (filters?.language) {
      queryBuilder.andWhere('template.language = :language', {
        language: filters.language,
      });
    }

    if (filters?.isActive !== undefined) {
      queryBuilder.andWhere('template.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    queryBuilder.orderBy('template.name', 'ASC');

    return queryBuilder.getMany();
  }

  /**
   * Get a template by ID
   */
  async getTemplate(
    tenantId: string,
    templateId: string,
  ): Promise<GrcAuditReportTemplate> {
    const template = await this.repository.findOne({
      where: { id: templateId, tenantId, isDeleted: false },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    return template;
  }

  /**
   * Create a new template
   */
  async createTemplate(
    tenantId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      standard?: AuditStandard;
      language?: TemplateLanguage;
      templateBody?: string;
      sections?: TemplateSectionConfig[];
    },
  ): Promise<GrcAuditReportTemplate> {
    return this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
      isActive: true,
    });
  }

  /**
   * Update a template
   */
  async updateTemplate(
    tenantId: string,
    userId: string,
    templateId: string,
    data: Partial<{
      name: string;
      description: string;
      standard: AuditStandard;
      language: TemplateLanguage;
      templateBody: string;
      sections: TemplateSectionConfig[];
      isActive: boolean;
    }>,
  ): Promise<GrcAuditReportTemplate> {
    // Validate template exists before updating
    await this.getTemplate(tenantId, templateId);

    const updated = await this.updateForTenant(tenantId, templateId, {
      ...data,
      updatedBy: userId,
    });

    if (!updated) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    return updated;
  }

  /**
   * Delete a template (soft delete)
   */
  async deleteTemplate(
    tenantId: string,
    userId: string,
    templateId: string,
  ): Promise<boolean> {
    // Validate template exists before deleting
    await this.getTemplate(tenantId, templateId);

    await this.updateForTenant(tenantId, templateId, {
      isDeleted: true,
      updatedBy: userId,
    });

    return true;
  }

  /**
   * Render a template with context data
   * Replaces placeholders like {{audit.name}} with actual values
   */
  async renderTemplate(
    tenantId: string,
    templateId: string,
    context: AuditContext,
  ): Promise<string> {
    const template = await this.getTemplate(tenantId, templateId);

    if (!template.templateBody) {
      return '';
    }

    return this.replacePlaceholders(template.templateBody, context);
  }

  /**
   * Render a template body string with context data
   * Can be used for preview without saving
   */
  renderTemplateBody(templateBody: string, context: AuditContext): string {
    return this.replacePlaceholders(templateBody, context);
  }

  /**
   * Replace placeholders in template with actual values
   * Supports nested paths like {{audit.name}}, {{organization.address}}
   * Also supports array iteration with {{#each findings}}...{{/each}}
   */
  private replacePlaceholders(template: string, context: AuditContext): string {
    let result = template;

    result = this.processEachBlocks(result, context);

    result = this.processIfBlocks(result, context);

    const placeholderRegex = /\{\{([^#/}]+)\}\}/g;
    result = result.replace(
      placeholderRegex,
      (_match: string, path: string): string => {
        const value = this.getNestedValue(context, path.trim());
        if (value === undefined || value === null) {
          return '';
        }
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value as string | number | boolean);
      },
    );

    return result;
  }

  /**
   * Process {{#each array}}...{{/each}} blocks
   */
  private processEachBlocks(template: string, context: AuditContext): string {
    const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

    return template.replace(
      eachRegex,
      (_match: string, arrayName: string, content: string): string => {
        const array = context[arrayName];
        if (!Array.isArray(array)) {
          return '';
        }

        return array
          .map((item: Record<string, unknown>, index: number): string => {
            let itemContent = content;

            const itemPlaceholderRegex = /\{\{this\.([^}]+)\}\}/g;
            itemContent = itemContent.replace(
              itemPlaceholderRegex,
              (_m: string, prop: string): string => {
                const value = item[prop.trim()];
                if (value === undefined || value === null) {
                  return '';
                }
                if (typeof value === 'object') {
                  return JSON.stringify(value);
                }
                return String(value as string | number | boolean);
              },
            );

            itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
            itemContent = itemContent.replace(
              /\{\{@number\}\}/g,
              String(index + 1),
            );

            return itemContent;
          })
          .join('');
      },
    );
  }

  /**
   * Process {{#if condition}}...{{/if}} blocks
   */
  private processIfBlocks(template: string, context: AuditContext): string {
    const ifRegex =
      /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

    return template.replace(
      ifRegex,
      (
        _match: string,
        condition: string,
        ifContent: string,
        elseContent: string | undefined,
      ): string => {
        const value = this.getNestedValue(context, condition.trim());
        const isTruthy =
          value !== undefined &&
          value !== null &&
          value !== false &&
          value !== '' &&
          value !== 0;

        if (isTruthy) {
          return ifContent;
        } else {
          return elseContent || '';
        }
      },
    );
  }

  /**
   * Get nested value from object using dot notation path
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Extract all placeholders from a template
   * Useful for validation and documentation
   */
  extractPlaceholders(templateBody: string): string[] {
    const placeholders = new Set<string>();

    const simpleRegex = /\{\{([^#/}]+)\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = simpleRegex.exec(templateBody)) !== null) {
      const captured = match[1];
      if (captured) {
        placeholders.add(captured.trim());
      }
    }

    const eachRegex = /\{\{#each\s+(\w+)\}\}/g;
    while ((match = eachRegex.exec(templateBody)) !== null) {
      const captured = match[1];
      if (captured) {
        placeholders.add(`#each ${captured}`);
      }
    }

    const ifRegex = /\{\{#if\s+([^}]+)\}\}/g;
    while ((match = ifRegex.exec(templateBody)) !== null) {
      const captured = match[1];
      if (captured) {
        placeholders.add(`#if ${captured.trim()}`);
      }
    }

    return Array.from(placeholders);
  }

  /**
   * Validate a template body for syntax errors
   */
  validateTemplate(templateBody: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    const eachOpenCount = (templateBody.match(/\{\{#each/g) || []).length;
    const eachCloseCount = (templateBody.match(/\{\{\/each\}\}/g) || []).length;
    if (eachOpenCount !== eachCloseCount) {
      errors.push(
        `Mismatched {{#each}} blocks: ${eachOpenCount} opening, ${eachCloseCount} closing`,
      );
    }

    const ifOpenCount = (templateBody.match(/\{\{#if/g) || []).length;
    const ifCloseCount = (templateBody.match(/\{\{\/if\}\}/g) || []).length;
    if (ifOpenCount !== ifCloseCount) {
      errors.push(
        `Mismatched {{#if}} blocks: ${ifOpenCount} opening, ${ifCloseCount} closing`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
