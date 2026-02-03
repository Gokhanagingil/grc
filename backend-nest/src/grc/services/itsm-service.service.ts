import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItsmService } from '../entities';
import { ItsmServiceStatus } from '../enums';
import {
  CreateItsmServiceDto,
  UpdateItsmServiceDto,
  ItsmServiceFilterDto,
} from '../dto/itsm.dto';
import { AuditService } from '../../audit/audit.service';

/**
 * ITSM Service Service
 *
 * Manages IT services for the ITSM module.
 * Services can be linked to incidents and changes for impact analysis.
 */
@Injectable()
export class ItsmServiceService {
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'name',
    'criticality',
    'status',
  ]);

  constructor(
    @InjectRepository(ItsmService)
    private readonly serviceRepository: Repository<ItsmService>,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateItsmServiceDto,
    userId: string,
  ): Promise<ItsmService> {
    const service = this.serviceRepository.create({
      ...dto,
      tenantId,
      createdBy: userId,
    });

    const saved = await this.serviceRepository.save(service);

    if (this.auditService) {
      await this.auditService.recordCreate(
        'ItsmService',
        saved,
        userId,
        tenantId,
      );
    }

    return saved;
  }

  async findAll(
    tenantId: string,
    filter: ItsmServiceFilterDto,
  ): Promise<{ items: ItsmService[]; total: number }> {
    const {
      criticality,
      status,
      q,
      search,
      page = 1,
      pageSize = 20,
      sort,
    } = filter;

    const queryBuilder = this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.owner', 'owner')
      .where('service.tenantId = :tenantId', { tenantId })
      .andWhere('service.isDeleted = :isDeleted', { isDeleted: false });

    if (criticality) {
      queryBuilder.andWhere('service.criticality = :criticality', {
        criticality,
      });
    }

    if (status) {
      queryBuilder.andWhere('service.status = :status', { status });
    }

    const searchTerm = q || search;
    if (searchTerm) {
      queryBuilder.andWhere(
        '(service.name ILIKE :search OR service.description ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    let sortField = 'createdAt';
    let sortOrder: 'ASC' | 'DESC' = 'DESC';

    if (sort) {
      const [field, order] = sort.split(':');
      if (this.allowedSortFields.has(field)) {
        sortField = field;
        sortOrder = order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      }
    }

    const [items, total] = await queryBuilder
      .orderBy(`service.${sortField}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<ItsmService> {
    const service = await this.serviceRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['owner'],
    });

    if (!service) {
      throw new NotFoundException(`ITSM Service with ID ${id} not found`);
    }

    return service;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateItsmServiceDto,
    userId: string,
  ): Promise<ItsmService> {
    const service = await this.findOne(tenantId, id);
    const oldValue = { ...service };

    Object.assign(service, dto, { updatedBy: userId });

    const saved = await this.serviceRepository.save(service);

    if (this.auditService) {
      await this.auditService.recordUpdate(
        'ItsmService',
        saved.id,
        oldValue as unknown as Record<string, unknown>,
        saved as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return saved;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const service = await this.findOne(tenantId, id);

    service.isDeleted = true;
    service.updatedBy = userId;

    await this.serviceRepository.save(service);

    if (this.auditService) {
      await this.auditService.recordDelete(
        'ItsmService',
        service,
        userId,
        tenantId,
      );
    }
  }

  async findActiveServices(tenantId: string): Promise<ItsmService[]> {
    return this.serviceRepository.find({
      where: {
        tenantId,
        status: ItsmServiceStatus.ACTIVE,
        isDeleted: false,
      },
      order: { name: 'ASC' },
    });
  }
}
