import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { randomUUID } from 'crypto';
import { EntityTypeEntity } from '../../entities/app/entity-type.entity';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { CreateEntityTypeDto } from './dto/create-entity-type.dto';
import { parsePagination, parseSort as parseSortLegacy } from '../../common/search/pagination.dto';
import { parseSort } from '../../common/http/listing.util';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class EntityTypeService {
  private readonly logger = new Logger(EntityTypeService.name);

  constructor(
    @InjectRepository(EntityTypeEntity)
    private readonly entityTypeRepo: Repository<EntityTypeEntity>,
    private readonly cacheService: CacheService,
  ) {}

  async list(
    tenantId: string,
    query?: {
      page?: string;
      pageSize?: string;
      limit?: string;
      search?: string;
      q?: string;
      sort?: string;
      dir?: string;
    },
  ) {
    try {
      const page = Math.max(parseInt(query?.page ?? '1', 10), 1);
      const pageSize = Math.min(
        Math.max(parseInt(query?.pageSize ?? query?.limit ?? '20', 10), 1),
        200,
      );
      const skip = (page - 1) * pageSize;

      const where: FindOptionsWhere<EntityTypeEntity> = {
        ...tenantWhere(tenantId),
      };

      // Text search (q or search parameter)
      const searchTerm = query?.q || query?.search;
      if (searchTerm) {
        where.name = ILike(`%${searchTerm}%`) as any;
      }

      // Parse sort with whitelist
      const { column, direction } = parseSort(
        query?.sort,
        ['created_at', 'code', 'name', 'updated_at'],
        'code',
        'ASC',
      );

      const [items, total] = await this.entityTypeRepo.findAndCount({
        where,
        order: { [column]: direction },
        skip,
        take: pageSize,
      });

      return {
        items,
        total,
        page,
        pageSize,
      };
    } catch (error: any) {
      this.logger.warn('Error listing entity types:', error?.message || error);
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async getOne(id: string, tenantId: string) {
    try {
      const entityType = await this.entityTypeRepo.findOne({
        where: { id, ...tenantWhere(tenantId) },
      });

      if (!entityType) {
        throw new NotFoundException(`Entity type ${id} not found`);
      }

      return entityType;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error getting entity type:', error?.message || error);
      throw new NotFoundException(`Entity type ${id} not found`);
    }
  }

  async create(dto: CreateEntityTypeDto, tenantId: string) {
    try {
      // Check for duplicate code
      const existing = await this.entityTypeRepo.findOne({
        where: {
          code: dto.code,
          ...tenantWhere(tenantId),
        },
      });

      if (existing) {
        throw new ConflictException(
          `Entity type with code ${dto.code} already exists`,
        );
      }

      const entityType = this.entityTypeRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
      });

      const saved = await this.entityTypeRepo.save(entityType);
      // Invalidate cache
      await this.cacheService.delete(`entity-types:choices:${tenantId}`);
      return saved;
    } catch (error: any) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error('Error creating entity type:', error?.message || error);
      throw new Error(
        `Failed to create entity type: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async update(
    id: string,
    dto: Partial<CreateEntityTypeDto>,
    tenantId: string,
  ) {
    try {
      const entityType = await this.getOne(id, tenantId);

      // Check code uniqueness if code is being updated
      if (dto.code && dto.code !== entityType.code) {
        const existing = await this.entityTypeRepo.findOne({
          where: {
            code: dto.code,
            ...tenantWhere(tenantId),
          },
        });

        if (existing) {
          throw new ConflictException(
            `Entity type with code ${dto.code} already exists`,
          );
        }
      }

      if (dto.name !== undefined) entityType.name = dto.name;
      if (dto.description !== undefined)
        entityType.description = dto.description;
      if (dto.code !== undefined) entityType.code = dto.code;

      const saved = await this.entityTypeRepo.save(entityType);
      // Invalidate cache
      await this.cacheService.delete(`entity-types:choices:${tenantId}`);
      return saved;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error('Error updating entity type:', error?.message || error);
      throw new Error(
        `Failed to update entity type: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async remove(id: string, tenantId: string) {
    try {
      const entityType = await this.getOne(id, tenantId);
      await this.entityTypeRepo.remove(entityType);
      // Invalidate cache
      await this.cacheService.delete(`entity-types:choices:${tenantId}`);
      return { success: true, id };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error removing entity type:', error?.message || error);
      throw new Error(
        `Failed to remove entity type: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async getChoices(tenantId: string) {
    const cacheKey = `entity-types:choices:${tenantId}`;
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const items = await this.entityTypeRepo.find({
            where: { ...tenantWhere(tenantId) },
            order: { code: 'ASC' },
          });
          return items.map((et) => ({
            id: et.id,
            code: et.code,
            name: et.name,
          }));
        } catch (error: any) {
          this.logger.warn(
            'Error getting entity type choices:',
            error?.message || error,
          );
          return [];
        }
      },
      300, // 5 minutes TTL
    );
  }
}
