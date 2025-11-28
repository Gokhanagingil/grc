import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  ILike,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { CreateGovernancePolicyDto } from './dto/create-policy.dto';
import { UpdateGovernancePolicyDto } from './dto/update-policy.dto';
import { QueryPolicyDto } from './dto/query-policy.dto';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { parseTrDateToIso } from './utils/date-parser.util';
import { randomUUID } from 'crypto';
import { parseSort } from '../../common/http/listing.util';

@Injectable()
export class GovernanceService {
  private readonly logger = new Logger(GovernanceService.name);

  constructor(
    @InjectRepository(PolicyEntity)
    private readonly policyRepo: Repository<PolicyEntity>,
  ) {}

  async list(query: QueryPolicyDto, tenantId: string) {
    try {
      const page = Math.max(parseInt(query.page ?? '1', 10), 1);
      const limit = Math.min(
        Math.max(parseInt(query.limit ?? query.pageSize ?? '20', 10), 1),
        200,
      );

      // Build where clause with tenant and filters
      const whereBase: any = {
        ...tenantWhere(tenantId),
      };

      // Status filter
      if (query.status) {
        whereBase.status = query.status;
      }

      // Text search (q or search parameter)
      const searchTerm = query.q || query.search;
      if (searchTerm) {
        whereBase.title = ILike(`%${searchTerm}%`) as any;
      }

      // Date range filters (if provided, parse from TR format)
      if (query.from) {
        const fromDate = parseTrDateToIso(query.from);
        if (fromDate) {
          whereBase.effective_date = MoreThanOrEqual(fromDate) as any;
        }
      }

      if (query.to) {
        const toDate = parseTrDateToIso(query.to);
        if (toDate) {
          whereBase.effective_date = LessThanOrEqual(toDate) as any;
        }
      }

      // Parse sort (whitelist: created_at, title, updated_at, effective_date)
      const { column, direction } = parseSort(
        query.sort,
        ['created_at', 'title', 'updated_at', 'effective_date'],
        'created_at',
        'DESC',
      );

      const [items, total] = await this.policyRepo.findAndCount({
        where: whereBase,
        order: { [column]: direction },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items,
        total,
        page,
        limit,
        pageSize: limit,
      };
    } catch (error: any) {
      this.logger.warn('Error listing policies:', error?.message || error);
      // Return empty list on error (defensive)
      return {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        pageSize: 20,
      };
    }
  }

  async getOne(id: string, tenantId: string) {
    try {
      const policy = await this.policyRepo.findOne({
        where: {
          id,
          ...tenantWhere(tenantId),
        },
      });

      if (!policy) {
        throw new NotFoundException(`Policy ${id} not found`);
      }

      return policy;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error getting policy:', error?.message || error);
      throw new NotFoundException(`Policy ${id} not found`);
    }
  }

  async create(dto: CreateGovernancePolicyDto, tenantId: string) {
    try {
      // Validate tenantId
      if (!tenantId || !tenantId.trim()) {
        this.logger.error('Tenant ID is missing in create request');
        throw new BadRequestException('Tenant ID is required');
      }

      // Validate required fields
      if (!dto.code || !dto.code.trim()) {
        throw new BadRequestException('Policy code is required');
      }
      if (!dto.title || !dto.title.trim()) {
        throw new BadRequestException('Policy title is required');
      }

      // Check for duplicate code within tenant
      const existing = await this.policyRepo.findOne({
        where: {
          code: dto.code.trim(),
          ...tenantWhere(tenantId),
        },
      });

      if (existing) {
        throw new ConflictException(
          `Policy with code ${dto.code} already exists`,
        );
      }

      // Parse dates from TR format
      const effectiveDate = dto.effective_date
        ? parseTrDateToIso(dto.effective_date)
        : undefined;
      const reviewDate = dto.review_date
        ? parseTrDateToIso(dto.review_date)
        : undefined;

      const titleValue = dto.title.trim();
      const policy = this.policyRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: dto.code.trim(),
        title: titleValue, // Maps to 'title' column (standardized)
        status: dto.status || 'draft', // Default to 'draft' if not provided
        // TODO: Implement status transition validation (e.g., via UI policy engine)
        // TODO: Consider code generator for status dictionaries to avoid duplication across modules
        owner_first_name: dto.owner_first_name?.trim() || undefined,
        owner_last_name: dto.owner_last_name?.trim() || undefined,
        effective_date: effectiveDate || undefined,
        review_date: reviewDate || undefined,
        content: dto.content?.trim() || undefined,
        // created_by and updated_by are nullable, can be set later from auth context
        created_by: undefined,
        updated_by: undefined,
      });

      this.logger.debug(`Creating policy with data:`, {
        id: policy.id,
        tenant_id: policy.tenant_id,
        code: policy.code,
        title: policy.title,
        status: policy.status,
      });

      const saved = await this.policyRepo.save(policy);

      this.logger.log(`Policy created successfully: ${saved.id} (${saved.code})`);
      return saved;
    } catch (error: any) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error creating policy:', error?.message || error);
      this.logger.error('Error name:', error?.name);
      this.logger.error('Error code:', error?.code);
      this.logger.error('Stack trace:', error?.stack);
      if (error?.sql) {
        this.logger.error('SQL:', error.sql);
      }
      if (error?.parameters) {
        this.logger.error('SQL Parameters:', error.parameters);
      }
      // Re-throw as InternalServerError to get 500 status
      throw new InternalServerErrorException(
        `Failed to create policy: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async update(id: string, dto: UpdateGovernancePolicyDto, tenantId: string) {
    try {
      const policy = await this.getOne(id, tenantId);

      // Check code uniqueness if code is being updated
      if (dto.code && dto.code !== policy.code) {
        const existing = await this.policyRepo.findOne({
          where: {
            code: dto.code,
            ...tenantWhere(tenantId),
          },
        });

        if (existing) {
          throw new ConflictException(
            `Policy with code ${dto.code} already exists`,
          );
        }
      }

      // Parse dates if provided
      if (dto.effective_date) {
        policy.effective_date = parseTrDateToIso(dto.effective_date);
      }
      if (dto.review_date) {
        policy.review_date = parseTrDateToIso(dto.review_date);
      }

      // Update other fields
      if (dto.title) {
        const titleValue = dto.title.trim();
        policy.title = titleValue; // Maps to 'title' column (standardized)
      }
      if (dto.status) policy.status = dto.status;
      if (dto.owner_first_name !== undefined)
        policy.owner_first_name = dto.owner_first_name;
      if (dto.owner_last_name !== undefined)
        policy.owner_last_name = dto.owner_last_name;
      if (dto.content !== undefined) policy.content = dto.content;

      const updated = await this.policyRepo.save(policy);

      return updated;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error('Error updating policy:', error?.message || error);
      throw new Error(
        `Failed to update policy: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async remove(id: string, tenantId: string) {
    try {
      const policy = await this.getOne(id, tenantId);
      await this.policyRepo.remove(policy);
      return { success: true, id };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error removing policy:', error?.message || error);
      throw new Error(
        `Failed to remove policy: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  // Policy-Standard Mapping (temporarily disabled - requires PolicyStandardEntity table)
  async getPolicyStandards(policyId: string, tenantId: string) {
    this.logger.warn('Standard mapping feature not available - returning empty list');
    return [];
  }

  async addPolicyStandard(
    policyId: string,
    standardId: string,
    tenantId: string,
  ) {
    throw new BadRequestException('Standard mapping feature is not available. Please ensure policy_standards table exists.');
  }

  async removePolicyStandard(
    policyId: string,
    standardId: string,
    tenantId: string,
  ) {
    throw new BadRequestException('Standard mapping feature is not available. Please ensure policy_standards table exists.');
  }
}
