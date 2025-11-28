import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { parseBooleanQuery } from '../../common/search/boolean-query-parser';
import { tenantWhere } from '../../common/tenant/tenant-query.util';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute boolean search query on a table
   */
  async executeQuery(queryString: string, table: string, tenantId: string) {
    try {
      // Parse the query
      const ast = parseBooleanQuery(queryString);

      if (!ast) {
        return {
          items: [],
          total: 0,
          note: 'Invalid query format',
        };
      }

      // Map table names to entity classes
      const tableMapping: Record<string, string> = {
        risk_catalog: 'risk_catalog',
        risk_instances: 'risk_instances',
        policies: 'policies',
        standards: 'standards',
        controls: 'controls',
      };

      const tableName = tableMapping[table] || table;

      // Build query
      const qb = this.dataSource
        .createQueryBuilder()
        .select('*')
        .from(tableName, 't');
      qb.where('t.tenant_id = :tenantId', { tenantId });

      // Field mapping (depends on table)
      const fieldMapping = this.getFieldMapping(tableName);

      // Apply boolean query (simplified - would need full recursive builder)
      // For now, use simplified condition builder
      this.applyBooleanConditions(qb, ast, fieldMapping, 'q');

      const items = await qb.getRawMany();
      const total = items.length;

      return {
        items,
        total,
        query: queryString,
        table: tableName,
      };
    } catch (error: any) {
      this.logger.warn(
        'Error executing search query:',
        error?.message || error,
      );
      return {
        items: [],
        total: 0,
        note: 'Query execution failed',
        error: error?.message,
      };
    }
  }

  private getFieldMapping(tableName: string): Record<string, string> {
    const mappings: Record<string, Record<string, string>> = {
      risk_catalog: {
        name: 't.name',
        code: 't.code',
        category: 't.category_id',
        likelihood: 't.default_likelihood',
        impact: 't.default_impact',
      },
      risk_instances: {
        status: 't.status',
        likelihood: 't.likelihood',
        impact: 't.impact',
        entity_type: 't.entity_type',
      },
      policies: {
        title: 't.title',
        code: 't.code',
        status: 't.status',
      },
    };

    return mappings[tableName] || {};
  }

  private applyBooleanConditions(
    qb: any,
    node: any,
    fieldMapping: Record<string, string>,
    paramPrefix: string,
  ): void {
    // Simplified implementation
    // In production, would need full recursive query builder
    if (node.type === 'condition' && node.condition) {
      const cond = node.condition;
      const dbField = fieldMapping[cond.field] || `t.${cond.field}`;
      const paramName = `${paramPrefix}_0`;

      switch (cond.operator) {
        case '=':
          qb.andWhere(`${dbField} = :${paramName}`, {
            [paramName]: cond.value,
          });
          break;
        case '>':
          qb.andWhere(`${dbField} > :${paramName}`, {
            [paramName]: cond.value,
          });
          break;
        case '>=':
          qb.andWhere(`${dbField} >= :${paramName}`, {
            [paramName]: cond.value,
          });
          break;
        case '<':
          qb.andWhere(`${dbField} < :${paramName}`, {
            [paramName]: cond.value,
          });
          break;
        case '<=':
          qb.andWhere(`${dbField} <= :${paramName}`, {
            [paramName]: cond.value,
          });
          break;
        case 'LIKE':
          qb.andWhere(`${dbField} ILIKE :${paramName}`, {
            [paramName]: `%${cond.value}%`,
          });
          break;
      }
    }
  }
}
