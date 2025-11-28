/**
 * @deprecated This service is legacy and should not be used in new code.
 * Use GovernanceService instead, which provides tenant-safe policy operations.
 * 
 * This service has been hardened with tenant filtering for security,
 * but the long-term goal is to fully migrate to GovernanceService.
 * 
 * @see GovernanceService for the recommended implementation
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, FindOptionsWhere } from 'typeorm';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { QueryPolicyDto } from './dto/query-policy.dto';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { randomUUID } from 'crypto';

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(PolicyEntity) private readonly repo: Repository<PolicyEntity>,
  ) {}

  /**
   * @deprecated Use GovernanceService.list() instead
   * Lists policies with tenant filtering
   * @param q Query parameters
   * @param tenantId Tenant ID (required for tenant isolation)
   */
  async findAll(q: QueryPolicyDto, tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const page = Math.max(parseInt(q.page ?? '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(q.limit ?? '20', 10), 1), 200);
    const where: FindOptionsWhere<PolicyEntity> = {
      ...tenantWhere(tenantId),
    };

    if (q.status) where.status = q.status;
    if (q.search) {
      where.title = ILike(`%${q.search}%`) as any;
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  /**
   * @deprecated Use GovernanceService.getOne() instead
   * Gets a single policy by ID with tenant filtering
   * @param id Policy ID
   * @param tenantId Tenant ID (required for tenant isolation)
   */
  async findOne(id: string, tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const row = await this.repo.findOne({ 
      where: { 
        id, 
        ...tenantWhere(tenantId) 
      } 
    });
    if (!row) throw new NotFoundException(`Policy ${id} not found`);
    return row;
  }

  /**
   * @deprecated Use GovernanceService.create() instead
   * Creates a new policy with tenant ID
   * @param dto Policy creation data
   * @param tenantId Tenant ID (required for tenant isolation)
   */
  async create(dto: CreatePolicyDto, tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Map legacy DTO fields to PolicyEntity fields
    // Legacy DTO uses: effectiveDate, reviewDate, owner, description
    // PolicyEntity uses: effective_date, review_date, owner_first_name/owner_last_name, content
    const ownerParts = dto.owner ? dto.owner.split(' ') : [];
    const ownerFirstName = ownerParts.length > 0 ? ownerParts[0] : undefined;
    const ownerLastName = ownerParts.length > 1 ? ownerParts.slice(1).join(' ') : undefined;

    const row = this.repo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      code: dto.code,
      title: dto.title,
      status: dto.status || 'draft',
      owner_first_name: ownerFirstName,
      owner_last_name: ownerLastName,
      effective_date: dto.effectiveDate,
      review_date: dto.reviewDate,
      content: dto.description, // Map description to content
    });
    return this.repo.save(row);
  }

  /**
   * @deprecated Use GovernanceService.update() instead
   * Updates a policy with tenant filtering
   * @param id Policy ID
   * @param dto Policy update data
   * @param tenantId Tenant ID (required for tenant isolation)
   */
  async update(id: string, dto: UpdatePolicyDto, tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const row = await this.findOne(id, tenantId);
    
    // Map legacy DTO fields to PolicyEntity fields
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.code !== undefined) row.code = dto.code;
    if (dto.status !== undefined) row.status = dto.status as string;
    if (dto.effectiveDate !== undefined) row.effective_date = dto.effectiveDate;
    if (dto.reviewDate !== undefined) row.review_date = dto.reviewDate;
    if (dto.description !== undefined) row.content = dto.description;
    
    // Handle owner field (split into first_name/last_name)
    if (dto.owner !== undefined) {
      const ownerParts = dto.owner ? dto.owner.split(' ') : [];
      row.owner_first_name = ownerParts.length > 0 ? ownerParts[0] : undefined;
      row.owner_last_name = ownerParts.length > 1 ? ownerParts.slice(1).join(' ') : undefined;
    }
    
    return this.repo.save(row);
  }

  /**
   * @deprecated Use GovernanceService.remove() instead
   * Removes a policy with tenant filtering
   * @param id Policy ID
   * @param tenantId Tenant ID (required for tenant isolation)
   */
  async remove(id: string, tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    await this.findOne(id, tenantId);
    await this.repo.delete({ id, ...tenantWhere(tenantId) });
    return { success: true };
  }
}
