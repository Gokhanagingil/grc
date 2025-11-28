import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  ILike,
  SelectQueryBuilder,
} from 'typeorm';
import { randomUUID } from 'crypto';
import { EntityEntity } from '../../entities/app/entity.entity';
import { EntityTypeEntity } from '../../entities/app/entity-type.entity';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { CreateEntityDto } from './dto/create-entity.dto';
import { QueryEntityDto } from './dto/query-entity.dto';
import { parsePagination, parseSort } from '../../common/search/pagination.dto';
import { parseQuery } from '../../common/search/query-parser';

@Injectable()
export class EntityService {
  private readonly logger = new Logger(EntityService.name);

  constructor(
    @InjectRepository(EntityEntity)
    private readonly entityRepo: Repository<EntityEntity>,
    @InjectRepository(EntityTypeEntity)
    private readonly entityTypeRepo: Repository<EntityTypeEntity>,
  ) {}

  async list(tenantId: string, query: QueryEntityDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { code: 'ASC' };

      const qb = this.entityRepo
        .createQueryBuilder('entity')
        .leftJoinAndSelect('entity.entity_type', 'entity_type')
        .where('entity.tenant_id = :tenantId', { tenantId });

      // Entity type filter
      if (query.entity_type_id) {
        qb.andWhere('entity.entity_type_id = :entityTypeId', {
          entityTypeId: query.entity_type_id,
        });
      } else if (query.entityType) {
        const entityType = await this.entityTypeRepo.findOne({
          where: { code: query.entityType, ...tenantWhere(tenantId) },
        });
        if (entityType) {
          qb.andWhere('entity.entity_type_id = :entityTypeId', {
            entityTypeId: entityType.id,
          });
        }
      }

      // Code filter
      if (query.code) {
        qb.andWhere('entity.code ILIKE :codeFilter', {
          codeFilter: `%${query.code}%`,
        });
      }

      // Name filter
      if (query.name) {
        qb.andWhere('entity.name ILIKE :nameFilter', {
          nameFilter: `%${query.name}%`,
        });
      }

      // Owner filter
      if (query.owner_user_id) {
        qb.andWhere('entity.owner_user_id = :ownerId', {
          ownerId: query.owner_user_id,
        });
      }

      // Criticality filter
      if (query.criticalityOp && query.criticalityVal) {
        const op = query.criticalityOp === '=' ? '=' : query.criticalityOp;
        const val = parseInt(query.criticalityVal, 10);
        if (!isNaN(val) && val >= 1 && val <= 5) {
          qb.andWhere(`entity.criticality ${op} :criticalityVal`, {
            criticalityVal: val,
          });
        }
      }

      // KQL search
      if (query.q) {
        const ast = parseQuery(query.q);
        if (ast) {
          const fieldMapping: Record<string, string> = {
            code: 'entity.code',
            name: 'entity.name',
            entityType: 'entity_type.code',
            criticality: 'entity.criticality',
          };

          ast.conditions.forEach((cond, idx) => {
            const dbField = fieldMapping[cond.field] || `entity.${cond.field}`;
            const paramName = `kql_${idx}`;
            const value = cond.value;

            switch (cond.operator) {
              case '=':
                qb.andWhere(`${dbField} = :${paramName}`, {
                  [paramName]: value,
                });
                break;
              case '>':
                qb.andWhere(`${dbField} > :${paramName}`, {
                  [paramName]: value,
                });
                break;
              case '>=':
                qb.andWhere(`${dbField} >= :${paramName}`, {
                  [paramName]: value,
                });
                break;
              case '<':
                qb.andWhere(`${dbField} < :${paramName}`, {
                  [paramName]: value,
                });
                break;
              case '<=':
                qb.andWhere(`${dbField} <= :${paramName}`, {
                  [paramName]: value,
                });
                break;
              case 'contains':
                qb.andWhere(`${dbField} ILIKE :${paramName}`, {
                  [paramName]: `%${value}%`,
                });
                break;
            }
          });
        }
      }

      // Legacy search (if no KQL and no column filters)
      if (query.search && !query.q && !query.code && !query.name) {
        qb.andWhere(
          '(entity.code ILIKE :search OR entity.name ILIKE :search)',
          {
            search: `%${query.search}%`,
          },
        );
      }

      // Sorting
      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`entity.${field}`, dir);
      });

      // Pagination
      qb.skip(skip).take(pageSize);

      const [items, total] = await qb.getManyAndCount();

      return {
        items,
        total,
        page,
        pageSize,
      };
    } catch (error: any) {
      this.logger.warn('Error listing entities:', error?.message || error);
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async getOne(id: string, tenantId: string) {
    try {
      const entity = await this.entityRepo.findOne({
        where: { id, ...tenantWhere(tenantId) },
        relations: ['entity_type'],
      });

      if (!entity) {
        throw new NotFoundException(`Entity ${id} not found`);
      }

      return entity;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error getting entity:', error?.message || error);
      throw new NotFoundException(`Entity ${id} not found`);
    }
  }

  async create(dto: CreateEntityDto, tenantId: string) {
    try {
      // Verify entity type exists
      const entityType = await this.entityTypeRepo.findOne({
        where: { id: dto.entity_type_id, ...tenantWhere(tenantId) },
      });

      if (!entityType) {
        throw new NotFoundException(
          `Entity type ${dto.entity_type_id} not found`,
        );
      }

      // Check for duplicate code
      const existing = await this.entityRepo.findOne({
        where: {
          code: dto.code,
          ...tenantWhere(tenantId),
        },
      });

      if (existing) {
        throw new ConflictException(
          `Entity with code ${dto.code} already exists`,
        );
      }

      const entity = this.entityRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        entity_type_id: dto.entity_type_id,
        code: dto.code,
        name: dto.name,
        criticality: dto.criticality ?? 3,
        owner_user_id: dto.owner_user_id,
        attributes: dto.attributes || {},
      });

      const saved = await this.entityRepo.save(entity);

      // Load relation
      const withType = await this.entityRepo.findOne({
        where: { id: saved.id },
        relations: ['entity_type'],
      });

      return withType || saved;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error('Error creating entity:', error?.message || error);
      throw new Error(
        `Failed to create entity: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async update(id: string, dto: Partial<CreateEntityDto>, tenantId: string) {
    try {
      const entity = await this.getOne(id, tenantId);

      // Check code uniqueness if code is being updated
      if (dto.code && dto.code !== entity.code) {
        const existing = await this.entityRepo.findOne({
          where: {
            code: dto.code,
            ...tenantWhere(tenantId),
          },
        });

        if (existing) {
          throw new ConflictException(
            `Entity with code ${dto.code} already exists`,
          );
        }
      }

      // Verify entity type if changed
      if (dto.entity_type_id && dto.entity_type_id !== entity.entity_type_id) {
        const entityType = await this.entityTypeRepo.findOne({
          where: { id: dto.entity_type_id, ...tenantWhere(tenantId) },
        });

        if (!entityType) {
          throw new NotFoundException(
            `Entity type ${dto.entity_type_id} not found`,
          );
        }

        entity.entity_type_id = dto.entity_type_id;
      }

      if (dto.code !== undefined) entity.code = dto.code;
      if (dto.name !== undefined) entity.name = dto.name;
      if (dto.criticality !== undefined) entity.criticality = dto.criticality;
      if (dto.owner_user_id !== undefined)
        entity.owner_user_id = dto.owner_user_id;
      if (dto.attributes !== undefined) entity.attributes = dto.attributes;

      const saved = await this.entityRepo.save(entity);

      // Reload with relation
      const withType = await this.entityRepo.findOne({
        where: { id: saved.id },
        relations: ['entity_type'],
      });

      return withType || saved;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error('Error updating entity:', error?.message || error);
      throw new Error(
        `Failed to update entity: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async remove(id: string, tenantId: string) {
    try {
      const entity = await this.getOne(id, tenantId);
      await this.entityRepo.remove(entity);
      return { success: true, id };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error removing entity:', error?.message || error);
      throw new Error(
        `Failed to remove entity: ${error?.message || 'Unknown error'}`,
      );
    }
  }
}
