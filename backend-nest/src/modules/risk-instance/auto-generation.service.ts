import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiskCatalogEntity } from '../../entities/app/risk-catalog.entity';
import {
  RiskInstanceEntity,
  EntityType,
  RiskStatus,
} from '../../entities/app/risk-instance.entity';
import { RiskInstanceService } from './risk-instance.service';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { randomUUID } from 'crypto';
import { parseBooleanQuery } from '../../common/search/boolean-query-parser';
import { Not } from 'typeorm';

/**
 * Auto-generation service for Risk Instances
 * Generates risk instances based on RiskCatalog entity_type and entity_filter
 */
@Injectable()
export class AutoGenerationService {
  private readonly logger = new Logger(AutoGenerationService.name);

  constructor(
    @InjectRepository(RiskCatalogEntity)
    private readonly catalogRepo: Repository<RiskCatalogEntity>,
    @InjectRepository(RiskInstanceEntity)
    private readonly instanceRepo: Repository<RiskInstanceEntity>,
    private readonly riskInstanceService: RiskInstanceService,
  ) {}

  /**
   * Generate risk instances for a catalog entry
   * Finds all entities matching entity_filter and creates instances
   */
  async generateInstances(
    catalogId: string,
    tenantId: string,
  ): Promise<{ created: number; skipped: number }> {
    try {
      const catalog = await this.catalogRepo.findOne({
        where: { id: catalogId, ...tenantWhere(tenantId) },
      });

      if (!catalog) {
        throw new NotFoundException(`Risk catalog ${catalogId} not found`);
      }

      if (!catalog.entity_type || !catalog.entity_filter) {
        throw new Error(
          'Catalog must have entity_type and entity_filter for auto-generation',
        );
      }

      // Find entities matching the filter
      // Note: In a real system, you'd query from an entity registry/database
      // For now, we'll simulate finding entities
      const entities = await this.findEntities(
        tenantId,
        catalog.entity_type,
        catalog.entity_filter,
      );

      let created = 0;
      let skipped = 0;

      for (const entity of entities) {
        // Check if instance already exists
        const existing = await this.instanceRepo.findOne({
          where: {
            catalog_id: catalogId,
            entity_id: entity.id,
            ...tenantWhere(tenantId),
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create instance
        // Cast string to EntityType enum (catalog.entity_type is string, but service expects EntityType)
        const entityType = catalog.entity_type as EntityType;
        await this.riskInstanceService.create(tenantId, {
          catalog_id: catalogId,
          entity_id: entity.id,
          entity_type: entityType,
          owner_id: entity.owner_id,
          likelihood: catalog.default_likelihood,
          impact: catalog.default_impact,
          controls_linked: catalog.control_refs || [],
        });

        created++;
      }

      this.logger.log(
        `Generated ${created} instances, skipped ${skipped} (catalog: ${catalogId})`,
      );

      return { created, skipped };
    } catch (error: any) {
      this.logger.error('Error generating instances:', error?.message || error);
      throw error;
    }
  }

  /**
   * Find entities matching the filter query
   * Simplified: returns mock entities for demonstration
   * In production, would query actual entity registry
   */
  private async findEntities(
    tenantId: string,
    entityType: string | EntityType,
    entityFilter: string,
  ): Promise<Array<{ id: string; owner_id?: string }>> {
    // Parse the boolean query filter
    const ast = parseBooleanQuery(entityFilter);

    if (!ast) {
      this.logger.warn(`Invalid entity filter: ${entityFilter}`);
      return [];
    }

    // In a real system, you'd query the entity registry:
    // - Applications table
    // - Databases table
    // - Processes table
    // etc.

    // For now, simulate finding entities based on the filter
    // Example: if filter is "criticality>4", find all entities with criticality > 4

    // Mock entities (in production, use actual repository)
    const mockEntities: Array<{ id: string; owner_id?: string }> = [];

    // Simulate finding 10-20 entities based on filter
    const count = Math.floor(Math.random() * 10) + 10; // 10-20 entities

    for (let i = 0; i < count; i++) {
      mockEntities.push({
        id: randomUUID(),
        owner_id: randomUUID(), // Would be actual entity owner
      });
    }

    this.logger.log(
      `Found ${mockEntities.length} entities matching filter: ${entityFilter} (type: ${entityType})`,
    );

    return mockEntities;
  }

  /**
   * Generate instances for all catalogs with entity_type and entity_filter
   */
  async generateAllInstances(tenantId: string): Promise<
    {
      catalogId: string;
      catalogCode: string;
      created: number;
      skipped: number;
      error?: string;
    }[]
  > {
    const catalogs = await this.catalogRepo.find({
      where: {
        ...tenantWhere(tenantId),
        entity_type: Not(null),
        entity_filter: Not(null),
      } as any,
    });

    const results: {
      catalogId: string;
      catalogCode: string;
      created: number;
      skipped: number;
      error?: string;
    }[] = [];

    for (const catalog of catalogs) {
      try {
        const result = await this.generateInstances(catalog.id, tenantId);
        results.push({
          catalogId: catalog.id,
          catalogCode: catalog.code,
          ...result,
        });
      } catch (error: any) {
        this.logger.error(
          `Error generating for catalog ${catalog.id}:`,
          error?.message,
        );
        results.push({
          catalogId: catalog.id,
          catalogCode: catalog.code,
          created: 0,
          skipped: 0,
          error: error?.message,
        });
      }
    }

    return results;
  }
}
