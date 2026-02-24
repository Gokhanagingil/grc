import { Injectable, Optional, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { CustomerRiskCatalog } from '../entities/customer-risk-catalog.entity';
import { CustomerRiskBinding } from '../entities/customer-risk-binding.entity';
import { CustomerRiskObservation } from '../entities/customer-risk-observation.entity';
import {
  CustomerRiskCatalogFilterDto,
  CustomerRiskBindingFilterDto,
  CustomerRiskObservationFilterDto,
  CUSTOMER_RISK_CATALOG_SORTABLE_FIELDS,
} from '../dto/customer-risk-catalog.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';
import { CodeGeneratorService, CodePrefix } from './code-generator.service';

const CRK_PREFIX = CodePrefix.CUSTOMER_RISK;

@Injectable()
export class CustomerRiskCatalogService extends MultiTenantServiceBase<CustomerRiskCatalog> {
  constructor(
    @InjectRepository(CustomerRiskCatalog)
    repository: Repository<CustomerRiskCatalog>,
    @InjectRepository(CustomerRiskBinding)
    private readonly bindingRepository: Repository<CustomerRiskBinding>,
    @InjectRepository(CustomerRiskObservation)
    private readonly observationRepository: Repository<CustomerRiskObservation>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly codeGeneratorService?: CodeGeneratorService,
  ) {
    super(repository);
  }

  async createCatalogRisk(
    tenantId: string,
    userId: string,
    data: Partial<CustomerRiskCatalog>,
  ): Promise<CustomerRiskCatalog> {
    let code = data.code;
    if (!code && this.codeGeneratorService) {
      code = await this.codeGeneratorService.generateCode(tenantId, CRK_PREFIX);
    }

    const risk = await this.createForTenant(tenantId, {
      ...data,
      code,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'CustomerRiskCatalog',
      risk,
      userId,
      tenantId,
    );

    this.eventEmitter.emit('customer-risk-catalog.created', {
      id: risk.id,
      tenantId,
      userId,
      title: risk.title,
    });

    return risk;
  }

  async updateCatalogRisk(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<CustomerRiskCatalog>,
  ): Promise<CustomerRiskCatalog | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) return null;

    const beforeState = { ...existing };
    const updated = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    } as Partial<Omit<CustomerRiskCatalog, 'id' | 'tenantId'>>);

    if (updated) {
      await this.auditService?.recordUpdate(
        'CustomerRiskCatalog',
        id,
        beforeState as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );

      this.eventEmitter.emit('customer-risk-catalog.updated', {
        id: updated.id,
        tenantId,
        userId,
      });
    }

    return updated;
  }

  async softDeleteCatalogRisk(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) return false;

    await this.updateForTenant(tenantId, id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<CustomerRiskCatalog, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'CustomerRiskCatalog',
      existing,
      userId,
      tenantId,
    );

    this.eventEmitter.emit('customer-risk-catalog.deleted', {
      id,
      tenantId,
      userId,
    });

    return true;
  }

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<CustomerRiskCatalog | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findWithFilters(
    tenantId: string,
    filterDto: CustomerRiskCatalogFilterDto,
  ): Promise<PaginatedResponse<CustomerRiskCatalog>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      status,
      category,
      severity,
      signalType,
      source,
      search,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('cr');
    qb.where('cr.tenantId = :tenantId', { tenantId });
    qb.andWhere('cr.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      qb.andWhere('cr.status = :status', { status });
    }
    if (category) {
      qb.andWhere('cr.category = :category', { category });
    }
    if (severity) {
      qb.andWhere('cr.severity = :severity', { severity });
    }
    if (signalType) {
      qb.andWhere('cr.signalType = :signalType', { signalType });
    }
    if (source) {
      qb.andWhere('cr.source = :source', { source });
    }
    if (search) {
      qb.andWhere(
        '(cr.title ILIKE :search OR cr.description ILIKE :search OR cr.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = CUSTOMER_RISK_CATALOG_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`cr.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async createBinding(
    tenantId: string,
    userId: string,
    catalogRiskId: string,
    data: {
      targetType: string;
      targetId: string;
      scopeMode?: string;
      enabled?: boolean;
      notes?: string;
    },
  ): Promise<CustomerRiskBinding> {
    const catalogRisk = await this.findOneActiveForTenant(
      tenantId,
      catalogRiskId,
    );
    if (!catalogRisk) {
      throw new ConflictException(
        `Catalog risk ${catalogRiskId} not found in tenant`,
      );
    }

    const existing = await this.bindingRepository.findOne({
      where: {
        tenantId,
        catalogRiskId,
        targetType: data.targetType,
        targetId: data.targetId,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Binding already exists for risk ${catalogRiskId} → ${data.targetType}:${data.targetId}`,
      );
    }

    const binding = this.bindingRepository.create({
      tenantId,
      catalogRiskId,
      targetType: data.targetType,
      targetId: data.targetId,
      scopeMode: data.scopeMode ?? 'DIRECT',
      enabled: data.enabled ?? true,
      notes: data.notes ?? null,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.bindingRepository.save(binding);

    this.eventEmitter.emit('customer-risk-binding.created', {
      id: saved.id,
      tenantId,
      catalogRiskId,
      targetType: data.targetType,
      targetId: data.targetId,
    });

    return saved;
  }

  async findBindingsForRisk(
    tenantId: string,
    catalogRiskId: string,
    filterDto: CustomerRiskBindingFilterDto,
  ): Promise<PaginatedResponse<CustomerRiskBinding>> {
    const {
      page = 1,
      pageSize = 20,
      targetType,
      targetId,
      enabled,
    } = filterDto;

    const qb = this.bindingRepository.createQueryBuilder('b');
    qb.where('b.tenantId = :tenantId', { tenantId });
    qb.andWhere('b.catalogRiskId = :catalogRiskId', { catalogRiskId });
    qb.andWhere('b.isDeleted = :isDeleted', { isDeleted: false });

    if (targetType) {
      qb.andWhere('b.targetType = :targetType', { targetType });
    }
    if (targetId) {
      qb.andWhere('b.targetId = :targetId', { targetId });
    }
    if (enabled !== undefined) {
      qb.andWhere('b.enabled = :enabled', { enabled });
    }

    const total = await qb.getCount();
    qb.orderBy('b.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async deleteBinding(
    tenantId: string,
    catalogRiskId: string,
    bindingId: string,
  ): Promise<boolean> {
    const binding = await this.bindingRepository.findOne({
      where: { id: bindingId, tenantId, catalogRiskId, isDeleted: false },
    });
    if (!binding) return false;

    binding.isDeleted = true;
    await this.bindingRepository.save(binding);
    return true;
  }

  async findObservations(
    tenantId: string,
    filterDto: CustomerRiskObservationFilterDto,
  ): Promise<PaginatedResponse<CustomerRiskObservation>> {
    const {
      page = 1,
      pageSize = 20,
      catalogRiskId,
      status,
      targetType,
      targetId,
      evidenceType,
    } = filterDto;

    const qb = this.observationRepository.createQueryBuilder('o');
    qb.where('o.tenantId = :tenantId', { tenantId });
    qb.andWhere('o.isDeleted = :isDeleted', { isDeleted: false });

    if (catalogRiskId) {
      qb.andWhere('o.catalogRiskId = :catalogRiskId', { catalogRiskId });
    }
    if (status) {
      qb.andWhere('o.status = :status', { status });
    }
    if (targetType) {
      qb.andWhere('o.targetType = :targetType', { targetType });
    }
    if (targetId) {
      qb.andWhere('o.targetId = :targetId', { targetId });
    }
    if (evidenceType) {
      qb.andWhere('o.evidenceType = :evidenceType', { evidenceType });
    }

    const total = await qb.getCount();
    qb.orderBy('o.observedAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findBindingsForTarget(
    tenantId: string,
    targetType: string,
    targetId: string,
  ): Promise<CustomerRiskBinding[]> {
    return this.bindingRepository.find({
      where: {
        tenantId,
        targetType,
        targetId,
        enabled: true,
        isDeleted: false,
      },
      relations: ['catalogRisk'],
    });
  }
}
