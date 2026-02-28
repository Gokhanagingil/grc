import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../common/multi-tenant-service.base';
import { CoreCompany } from './core-company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import {
  CompanyFilterDto,
  COMPANY_SORTABLE_FIELDS,
} from './dto/company-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../grc/dto/pagination.dto';

/**
 * Core Company Service
 *
 * Multi-tenant service for managing companies.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 * Implements soft delete - deleted records are marked with isDeleted=true.
 */
@Injectable()
export class CoreCompanyService extends MultiTenantServiceBase<CoreCompany> {
  constructor(
    @InjectRepository(CoreCompany)
    repository: Repository<CoreCompany>,
  ) {
    super(repository);
  }

  /**
   * Create a new company
   * Validates code uniqueness per tenant if code is provided.
   */
  async createCompany(
    tenantId: string,
    userId: string,
    dto: CreateCompanyDto,
  ): Promise<CoreCompany> {
    if (dto.code !== undefined && dto.code !== null) {
      if (dto.code === '') {
        dto.code = undefined; // treat empty string as "no code"
      } else {
        await this.assertCodeUnique(tenantId, dto.code);
      }
    }

    return this.createForTenant(tenantId, {
      ...dto,
      createdBy: userId,
      isDeleted: false,
    });
  }

  /**
   * Update an existing company
   * Validates code uniqueness per tenant if code is being changed.
   */
  async updateCompany(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCompanyDto,
  ): Promise<CoreCompany | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    if (
      dto.code !== undefined &&
      dto.code !== null &&
      dto.code !== existing.code
    ) {
      if (dto.code === '') {
        dto.code = null as unknown as undefined; // treat empty string as "clear code"
      } else {
        await this.assertCodeUnique(tenantId, dto.code, id);
      }
    }

    return this.updateForTenant(tenantId, id, {
      ...dto,
      updatedBy: userId,
    });
  }

  /**
   * Soft delete a company
   */
  async softDeleteCompany(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return false;
    }

    await this.updateForTenant(tenantId, id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<CoreCompany, 'id' | 'tenantId'>>);

    return true;
  }

  /**
   * Find one active (non-deleted) company for a tenant
   */
  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<CoreCompany | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find companies with pagination, sorting, and filtering
   * Returns LIST-CONTRACT format: { items, total, page, pageSize, totalPages }
   */
  async findWithFilters(
    tenantId: string,
    filterDto: CompanyFilterDto,
  ): Promise<PaginatedResponse<CoreCompany>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search,
      type,
      status,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('company');

    qb.where('company.tenantId = :tenantId', { tenantId });
    qb.andWhere('company.isDeleted = :isDeleted', { isDeleted: false });

    if (type) {
      qb.andWhere('company.type = :type', { type });
    }

    if (status) {
      qb.andWhere('company.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(company.name ILIKE :search OR company.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = COMPANY_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`company.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Assert that a code is unique within a tenant
   * @param excludeId - Optionally exclude an entity ID (for updates)
   */
  private async assertCodeUnique(
    tenantId: string,
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.repository.createQueryBuilder('company');
    qb.where('company.tenantId = :tenantId', { tenantId });
    qb.andWhere('company.code = :code', { code });
    qb.andWhere('company.isDeleted = :isDeleted', { isDeleted: false });

    if (excludeId) {
      qb.andWhere('company.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException(
        `A company with code "${code}" already exists in this tenant`,
      );
    }
  }
}
