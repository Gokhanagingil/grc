import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  RiskInstanceEntity,
  EntityType,
  RiskStatus,
} from '../../entities/app/risk-instance.entity';
import { RiskCatalogEntity } from '../../entities/app/risk-catalog.entity';
import { ControlLibraryEntity } from '../../entities/app/control-library.entity';
import { EntityEntity } from '../../entities/app/entity.entity';
import { RiskScoringService } from '../risk-scoring/risk-scoring.service';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { Optional } from '@nestjs/common';
import { parseSort } from '../../common/http/listing.util';
import { CreateRiskInstanceDto, UpdateRiskInstanceDto } from './dto/create-risk-instance.dto';
// RealtimeGateway is optional - use type import to avoid runtime dependency
type RealtimeGateway = {
  broadcastRiskResidualUpdated: (id: string, risk: number, tenantId: string) => void;
};

export interface QueryRiskInstanceDto {
  page?: string;
  pageSize?: string;
  limit?: string;
  catalog_id?: string;
  entity_id?: string;
  entity_type?: EntityType;
  status?: RiskStatus;
  category?: string;
  owner_id?: string;
  score_min?: string;
  score_max?: string;
  search?: string;
  q?: string;
  sort?: string;
  dir?: 'ASC' | 'DESC';
}

@Injectable()
export class RiskInstanceService {
  private readonly logger = new Logger(RiskInstanceService.name);

  constructor(
    @InjectRepository(RiskInstanceEntity)
    private readonly instanceRepo: Repository<RiskInstanceEntity>,
    @InjectRepository(RiskCatalogEntity)
    private readonly catalogRepo: Repository<RiskCatalogEntity>,
    @InjectRepository(ControlLibraryEntity)
    private readonly controlRepo: Repository<ControlLibraryEntity>,
    @InjectRepository(EntityEntity)
    private readonly entityRepo: Repository<EntityEntity>,
    private readonly riskScoringService: RiskScoringService,
    @Optional() private readonly realtimeGateway?: RealtimeGateway,
  ) {}

  /**
   * Calculate control effectiveness from actual control records
   */
  private async calculateControlEffectiveness(
    controlIds: string[],
    tenantId: string,
  ): Promise<number> {
    if (!controlIds || controlIds.length === 0) {
      return 0;
    }

    try {
      const controls = await this.controlRepo.find({
        where: { id: In(controlIds), ...tenantWhere(tenantId) },
      });

      let totalEffectiveness = 0;
      for (const control of controls) {
        const eff = Number(control.effectiveness) || 0.15; // Default 15% if not set
        totalEffectiveness += eff;
      }

      // Clamp to 0-1 range, max 0.85 (never 100% due to inherent risk)
      return Math.min(0.85, Math.max(0, totalEffectiveness));
    } catch (error: any) {
      this.logger.warn(
        'Error calculating control effectiveness:',
        error?.message || error,
      );
      // Fallback: simple calculation
      return Math.min(0.85, controlIds.length * 0.15);
    }
  }

  /**
   * Auto-calculate scores from likelihood and impact
   */
  private calculateScores(likelihood: number, impact: number) {
    return {
      inherent_score: likelihood * impact,
      residual_score: likelihood * impact, // Will be updated after controls
    };
  }

  async list(tenantId: string, query: QueryRiskInstanceDto) {
    try {
      const page = Math.max(parseInt(query.page ?? '1', 10), 1);
      const pageSize = Math.min(
        Math.max(parseInt(query.pageSize ?? query.limit ?? '20', 10), 1),
        200,
      );
      const skip = (page - 1) * pageSize;

      const qb = this.instanceRepo
        .createQueryBuilder('instance')
        .leftJoinAndSelect('instance.catalog', 'catalog')
        .leftJoinAndSelect('instance.entity', 'entity')
        .leftJoinAndSelect('catalog.category', 'category')
        .where('instance.tenant_id = :tenantId', { tenantId })
        .skip(skip)
        .take(pageSize);

      // Filters
      if (query.catalog_id) {
        qb.andWhere('instance.catalog_id = :catalogId', {
          catalogId: query.catalog_id,
        });
      }

      if (query.entity_id) {
        qb.andWhere('instance.entity_id = :entityId', {
          entityId: query.entity_id,
        });
      }

      if (query.entity_type) {
        qb.andWhere('instance.entity_type = :entityType', {
          entityType: query.entity_type,
        });
      }

      if (query.status) {
        qb.andWhere('instance.status = :status', { status: query.status });
      }

      if (query.category) {
        qb.andWhere('category.code = :categoryCode', {
          categoryCode: query.category,
        });
      }

      if (query.owner_id) {
        qb.andWhere(
          '(instance.owner_id = :ownerId OR instance.treatment_owner_id = :ownerId)',
          { ownerId: query.owner_id },
        );
      }

      // Score range filters (on inherent_score)
      if (query.score_min) {
        const minScore = parseInt(query.score_min, 10);
        qb.andWhere('instance.inherent_score >= :minScore', { minScore });
      }

      if (query.score_max) {
        const maxScore = parseInt(query.score_max, 10);
        qb.andWhere('instance.inherent_score <= :maxScore', { maxScore });
      }

      // Text search
      const searchTerm = query.q || query.search;
      if (searchTerm) {
        qb.andWhere(
          '(catalog.title ILIKE :search OR catalog.name ILIKE :search OR catalog.code ILIKE :search OR instance.description ILIKE :search OR instance.notes ILIKE :search)',
          { search: `%${searchTerm}%` },
        );
      }

      // Sorting
      let sortColumn = 'created_at';
      let sortDirection: 'ASC' | 'DESC' = 'DESC';
      
      const sortableColumns = [
        'created_at',
        'updated_at',
        'inherent_score',
        'residual_score',
        'inherent_likelihood',
        'inherent_impact',
        'status',
      ];

      if (query.sort) {
        const parsed = parseSort(
          query.sort,
          sortableColumns,
          'created_at',
          'DESC',
        );
        sortColumn = parsed.column;
        sortDirection = parsed.direction;
      } else if (query.dir) {
        sortDirection = query.dir === 'ASC' ? 'ASC' : 'DESC';
      }
      
      qb.orderBy(`instance.${sortColumn}`, sortDirection);

      const [items, total] = await qb.getManyAndCount();

      // Calculate residual scores for display
      const itemsWithScores = await Promise.all(
        items.map(async (item) => {
          // Use residual_likelihood/impact if set, otherwise use inherent
          const residualLikelihood = item.residual_likelihood ?? item.inherent_likelihood;
          const residualImpact = item.residual_impact ?? item.inherent_impact;
          
          // Calculate residual score
          let residualScore = item.residual_score;
          if (!residualScore && residualLikelihood && residualImpact) {
            residualScore = residualLikelihood * residualImpact;
          }

          return {
            ...item,
            residual_score: residualScore ?? item.inherent_score,
          };
        }),
      );

      return {
        items: itemsWithScores,
        total,
        page,
        pageSize,
        limit: pageSize,
      };
    } catch (error: any) {
      this.logger.warn(
        'Error listing risk instances:',
        error?.message || error,
      );
      return { items: [], total: 0, page: 1, pageSize: 20, limit: 20 };
    }
  }

  async getOne(id: string, tenantId: string) {
    try {
      const instance = await this.instanceRepo.findOne({
        where: { id, ...tenantWhere(tenantId) },
        relations: ['catalog', 'catalog.category', 'entity'],
      });

      if (!instance) {
        throw new NotFoundException(`Risk instance ${id} not found`);
      }

      // Calculate residual score if not already set
      if (!instance.residual_score) {
        const residualLikelihood = instance.residual_likelihood ?? instance.inherent_likelihood;
        const residualImpact = instance.residual_impact ?? instance.inherent_impact;
        instance.residual_score = residualLikelihood * residualImpact;
      }

      // Load controls for detail view
      const controls =
        instance.controls_linked && instance.controls_linked.length > 0
          ? await this.controlRepo.find({
              where: {
                id: In(instance.controls_linked),
                ...tenantWhere(tenantId),
              },
            })
          : [];

      return {
        ...instance,
        controls_detail: controls.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          effectiveness: c.effectiveness,
        })),
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        'Error getting risk instance:',
        error?.message || error,
      );
      throw new NotFoundException(`Risk instance ${id} not found`);
    }
  }

  async create(tenantId: string, dto: CreateRiskInstanceDto) {
    try {
      // Check catalog exists
      const catalog = await this.catalogRepo.findOne({
        where: { id: dto.catalog_id, ...tenantWhere(tenantId) },
        relations: ['category'],
      });

      if (!catalog) {
        throw new NotFoundException(`Risk catalog ${dto.catalog_id} not found`);
      }

      // Verify entity exists if entity_id provided
      if (dto.entity_id) {
        const entity = await this.entityRepo.findOne({
          where: { id: dto.entity_id, ...tenantWhere(tenantId) },
          relations: ['entity_type'],
        });

        if (!entity) {
          throw new NotFoundException(`Entity ${dto.entity_id} not found`);
        }

        // Auto-set entity_type from entity if not provided
        if (!dto.entity_type && entity.entity_type) {
          dto.entity_type = entity.entity_type.code as EntityType;
        }
      }

      // Check for duplicate (catalog_id + entity_id + tenant_id)
      const existing = await this.instanceRepo.findOne({
        where: {
          catalog_id: dto.catalog_id,
          entity_id: dto.entity_id,
          ...tenantWhere(tenantId),
        },
      });

      if (existing) {
        throw new ConflictException(
          `Risk instance already exists for catalog ${dto.catalog_id} and entity ${dto.entity_id}`,
        );
      }

      // Auto-populate from catalog defaults
      const inherentLikelihood =
        dto.inherent_likelihood ??
        dto.likelihood ??
        catalog.default_inherent_likelihood ??
        catalog.default_likelihood ??
        3;
      
      const inherentImpact =
        dto.inherent_impact ??
        dto.impact ??
        catalog.default_inherent_impact ??
        catalog.default_impact ??
        3;

      // Calculate inherent score
      const inherentScore = inherentLikelihood * inherentImpact;

      // Set residual scores (default to inherent if not provided)
      const residualLikelihood = dto.residual_likelihood ?? inherentLikelihood;
      const residualImpact = dto.residual_impact ?? inherentImpact;
      const residualScore = residualLikelihood * residualImpact;

      // Parse treatment due date
      let treatmentDueDate: Date | undefined;
      if (dto.treatment_due_date) {
        treatmentDueDate = new Date(dto.treatment_due_date);
        if (isNaN(treatmentDueDate.getTime())) {
          this.logger.warn(`Invalid treatment_due_date: ${dto.treatment_due_date}`);
          treatmentDueDate = undefined;
        }
      }

      // Create instance with all fields
      const instance = this.instanceRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        catalog_id: dto.catalog_id,
        entity_id: dto.entity_id,
        entity_type: dto.entity_type,
        description: dto.description,
        inherent_likelihood: inherentLikelihood,
        inherent_impact: inherentImpact,
        inherent_score: inherentScore,
        residual_likelihood: residualLikelihood,
        residual_impact: residualImpact,
        residual_score: residualScore,
        treatment_action: dto.treatment_action,
        treatment_owner_id: dto.treatment_owner_id,
        treatment_due_date: treatmentDueDate,
        expected_reduction: dto.expected_reduction,
        status: dto.status ?? RiskStatus.DRAFT,
        owner_id: dto.owner_id,
        assigned_to: dto.assigned_to,
        controls_linked: dto.controls_linked || [],
        notes: dto.notes,
        // Backward compatibility
        likelihood: inherentLikelihood,
        impact: inherentImpact,
        residual_risk: residualScore,
      });

      const saved = await this.instanceRepo.save(instance);

      // Load with relations
      const withRelations = await this.instanceRepo.findOne({
        where: { id: saved.id },
        relations: ['catalog', 'catalog.category', 'entity'],
      });

      return withRelations || saved;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error(
        'Error creating risk instance:',
        error?.message || error,
      );
      throw new Error(
        `Failed to create risk instance: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async update(
    id: string,
    tenantId: string,
    updates: UpdateRiskInstanceDto,
  ) {
    try {
      const instance = await this.getOne(id, tenantId);

      // Update fields
      if (updates.entity_id !== undefined) {
        // Verify entity exists
        if (updates.entity_id) {
          const entity = await this.entityRepo.findOne({
            where: { id: updates.entity_id, ...tenantWhere(tenantId) },
          });
          if (!entity) {
            throw new NotFoundException(`Entity ${updates.entity_id} not found`);
          }
        }
        instance.entity_id = updates.entity_id;
      }

      if (updates.entity_type !== undefined) {
        instance.entity_type = updates.entity_type;
      }

      if (updates.description !== undefined) {
        instance.description = updates.description;
      }

      // Update inherent scores
      let shouldRecalcInherent = false;
      if (updates.inherent_likelihood !== undefined) {
        instance.inherent_likelihood = updates.inherent_likelihood;
        shouldRecalcInherent = true;
      }

      if (updates.inherent_impact !== undefined) {
        instance.inherent_impact = updates.inherent_impact;
        shouldRecalcInherent = true;
      }

      if (shouldRecalcInherent) {
        instance.inherent_score =
          instance.inherent_likelihood * instance.inherent_impact;
        // Update backward compatibility fields
        instance.likelihood = instance.inherent_likelihood;
        instance.impact = instance.inherent_impact;
      }

      // Update residual scores
      let shouldRecalcResidual = false;
      if (updates.residual_likelihood !== undefined) {
        instance.residual_likelihood = updates.residual_likelihood;
        shouldRecalcResidual = true;
      }

      if (updates.residual_impact !== undefined) {
        instance.residual_impact = updates.residual_impact;
        shouldRecalcResidual = true;
      }

      if (shouldRecalcResidual) {
        const residualLikelihood = instance.residual_likelihood ?? instance.inherent_likelihood;
        const residualImpact = instance.residual_impact ?? instance.inherent_impact;
        instance.residual_score = residualLikelihood * residualImpact;
        instance.residual_risk = instance.residual_score;
      }

      // Update treatment plan
      if (updates.treatment_action !== undefined) {
        instance.treatment_action = updates.treatment_action;
      }

      if (updates.treatment_owner_id !== undefined) {
        instance.treatment_owner_id = updates.treatment_owner_id;
      }

      if (updates.treatment_due_date !== undefined) {
        if (updates.treatment_due_date) {
          const dueDate = new Date(updates.treatment_due_date);
          instance.treatment_due_date = isNaN(dueDate.getTime()) ? undefined : dueDate;
        } else {
          instance.treatment_due_date = undefined;
        }
      }

      if (updates.expected_reduction !== undefined) {
        instance.expected_reduction = updates.expected_reduction;
      }

      // Update status
      if (updates.status !== undefined) {
        instance.status = updates.status;
      }

      if (updates.owner_id !== undefined) {
        instance.owner_id = updates.owner_id;
      }

      if (updates.assigned_to !== undefined) {
        instance.assigned_to = updates.assigned_to;
      }

      if (updates.notes !== undefined) {
        instance.notes = updates.notes;
      }

      // Update controls_linked if provided
      if (updates.controls_linked !== undefined) {
        instance.controls_linked = updates.controls_linked;
        // Recalculate residual risk based on new controls
        const controlEffectiveness = await this.calculateControlEffectiveness(
          updates.controls_linked,
          tenantId,
        );
        const baseLikelihood = instance.inherent_likelihood;
        const baseImpact = instance.inherent_impact;
        
        if (updates.controls_linked.length > 0) {
          // Apply effectiveness reduction
          const reductionFactor = 1 - controlEffectiveness;
          instance.residual_likelihood = Math.max(1, Math.round(baseLikelihood * reductionFactor));
          instance.residual_impact = Math.max(1, Math.round(baseImpact * reductionFactor));
        } else {
          // No controls, revert to inherent
          instance.residual_likelihood = baseLikelihood;
          instance.residual_impact = baseImpact;
        }
        instance.residual_score = instance.residual_likelihood * instance.residual_impact;
        instance.residual_risk = instance.residual_score;
        shouldRecalcResidual = true; // Trigger broadcast
      }

      instance.last_assessed_at = new Date();
      const saved = await this.instanceRepo.save(instance);

      // Broadcast WebSocket notification if gateway available
      if (this.realtimeGateway && shouldRecalcResidual) {
        try {
          this.realtimeGateway.broadcastRiskResidualUpdated(
            saved.id,
            saved.residual_score || 0,
            tenantId,
          );
        } catch (err: any) {
          this.logger.warn('Realtime broadcast failed:', err?.message || err);
        }
      }

      // Load with relations
      const withRelations = await this.instanceRepo.findOne({
        where: { id: saved.id },
        relations: ['catalog', 'catalog.category', 'entity'],
      });

      return withRelations || saved;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        'Error updating risk instance:',
        error?.message || error,
      );
      throw new Error(
        `Failed to update risk instance: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async linkControl(instanceId: string, controlId: string, tenantId: string) {
    try {
      const instance = await this.getOne(instanceId, tenantId);

      // Verify control exists
      const control = await this.controlRepo.findOne({
        where: { id: controlId, ...tenantWhere(tenantId) },
      });

      if (!control) {
        throw new NotFoundException(`Control ${controlId} not found`);
      }

      // Add control if not already linked
      const controlsLinked = instance.controls_linked || [];
      if (controlsLinked.includes(controlId)) {
        return instance; // Already linked
      }

      const updatedControls = [...controlsLinked, controlId];

      // Recalculate residual risk based on control effectiveness
      const controlEffectiveness = await this.calculateControlEffectiveness(
        updatedControls,
        tenantId,
      );
      
      // Reduce residual likelihood/impact based on control effectiveness
      const baseLikelihood = instance.residual_likelihood ?? instance.inherent_likelihood;
      const baseImpact = instance.residual_impact ?? instance.inherent_impact;
      
      // Apply effectiveness reduction (simplified - can be enhanced)
      const reductionFactor = 1 - controlEffectiveness;
      const newResidualLikelihood = Math.max(1, Math.round(baseLikelihood * reductionFactor));
      const newResidualImpact = Math.max(1, Math.round(baseImpact * reductionFactor));
      
      instance.residual_likelihood = newResidualLikelihood;
      instance.residual_impact = newResidualImpact;
      instance.residual_score = newResidualLikelihood * newResidualImpact;
      instance.controls_linked = updatedControls;
      instance.last_assessed_at = new Date();

      const saved = await this.instanceRepo.save(instance);

      // Broadcast WebSocket notification
      if (this.realtimeGateway) {
        try {
          this.realtimeGateway.broadcastRiskResidualUpdated(
            saved.id,
            saved.residual_score || 0,
            tenantId,
          );
        } catch (err: any) {
          this.logger.warn('Realtime broadcast failed:', err?.message || err);
        }
      }

      return saved;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error linking control:', error?.message || error);
      throw new Error(
        `Failed to link control: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async unlinkControl(instanceId: string, controlId: string, tenantId: string) {
    try {
      const instance = await this.getOne(instanceId, tenantId);

      const controlsLinked = instance.controls_linked || [];
      if (!controlsLinked.includes(controlId)) {
        return instance; // Not linked
      }

      const updatedControls = controlsLinked.filter((id) => id !== controlId);

      // Recalculate residual risk after control removal
      const controlEffectiveness = await this.calculateControlEffectiveness(
        updatedControls,
        tenantId,
      );
      
      // Revert to more inherent levels if controls reduced
      const baseLikelihood = instance.inherent_likelihood;
      const baseImpact = instance.inherent_impact;
      
      if (updatedControls.length === 0) {
        // No controls left, revert to inherent
        instance.residual_likelihood = baseLikelihood;
        instance.residual_impact = baseImpact;
      } else {
        // Apply remaining controls effectiveness
        const reductionFactor = 1 - controlEffectiveness;
        instance.residual_likelihood = Math.max(1, Math.round(baseLikelihood * reductionFactor));
        instance.residual_impact = Math.max(1, Math.round(baseImpact * reductionFactor));
      }
      
      instance.residual_score = instance.residual_likelihood * instance.residual_impact;
      instance.controls_linked = updatedControls;
      instance.last_assessed_at = new Date();

      const saved = await this.instanceRepo.save(instance);

      // Broadcast WebSocket notification
      if (this.realtimeGateway) {
        try {
          this.realtimeGateway.broadcastRiskResidualUpdated(
            saved.id,
            saved.residual_score || 0,
            tenantId,
          );
        } catch (err: any) {
          this.logger.warn('Realtime broadcast failed:', err?.message || err);
        }
      }

      return saved;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error unlinking control:', error?.message || error);
      throw new Error(
        `Failed to unlink control: ${error?.message || 'Unknown error'}`,
      );
    }
  }
}
