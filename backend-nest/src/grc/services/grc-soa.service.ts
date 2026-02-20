import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GrcSoaProfile } from '../entities/grc-soa-profile.entity';
import { GrcSoaItem } from '../entities/grc-soa-item.entity';
import { GrcSoaItemControl } from '../entities/grc-soa-item-control.entity';
import { GrcSoaItemEvidence } from '../entities/grc-soa-item-evidence.entity';
import { StandardClause } from '../entities/standard-clause.entity';
import { Standard } from '../entities/standard.entity';
import { GrcControl } from '../entities/grc-control.entity';
import { GrcEvidence } from '../entities/grc-evidence.entity';
import {
  SoaProfileStatus,
  SoaApplicability,
  SoaImplementationStatus,
} from '../enums';
import {
  CreateSoaProfileDto,
  UpdateSoaProfileDto,
  FilterSoaProfileDto,
  UpdateSoaItemDto,
  FilterSoaItemDto,
  SOA_PROFILE_SORTABLE_FIELDS,
  SOA_ITEM_SORTABLE_FIELDS,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';

/**
 * GRC SOA Service
 *
 * Service for managing Statement of Applicability (SOA) profiles and items.
 * Provides CRUD operations, item initialization, linking, and CSV export.
 *
 * Key features:
 * - Multi-tenant isolation via tenantId
 * - Soft delete pattern
 * - Batch item initialization from standard clauses
 * - Control and evidence linking
 * - CSV export for auditors
 */
@Injectable()
export class GrcSoaService {
  constructor(
    @InjectRepository(GrcSoaProfile)
    private readonly profileRepository: Repository<GrcSoaProfile>,
    @InjectRepository(GrcSoaItem)
    private readonly itemRepository: Repository<GrcSoaItem>,
    @InjectRepository(GrcSoaItemControl)
    private readonly itemControlRepository: Repository<GrcSoaItemControl>,
    @InjectRepository(GrcSoaItemEvidence)
    private readonly itemEvidenceRepository: Repository<GrcSoaItemEvidence>,
    @InjectRepository(StandardClause)
    private readonly clauseRepository: Repository<StandardClause>,
    @InjectRepository(Standard)
    private readonly standardRepository: Repository<Standard>,
    @InjectRepository(GrcControl)
    private readonly controlRepository: Repository<GrcControl>,
    @InjectRepository(GrcEvidence)
    private readonly evidenceRepository: Repository<GrcEvidence>,
    private readonly dataSource: DataSource,
  ) {}

  // ============================================================================
  // Profile Operations
  // ============================================================================

  /**
   * List SOA profiles with pagination and filtering
   *
   * By default, returns ALL non-deleted profiles for the tenant regardless of status.
   * Only filters by status if the 'status' query parameter is explicitly provided.
   *
   * This ensures that:
   * - DRAFT profiles are visible in the list (e.g., after seeding)
   * - Users can see all their profiles unless they explicitly filter
   * - Status filtering is opt-in, not opt-out
   *
   * @param tenantId - Tenant ID for multi-tenant isolation (required)
   * @param filter - Filter DTO with optional status, search, standardId, pagination, etc.
   * @returns Paginated response with SOA profiles
   */
  async listProfiles(
    tenantId: string,
    filter: FilterSoaProfileDto,
  ): Promise<PaginatedResponse<GrcSoaProfile>> {
    const {
      page = 1,
      pageSize = 20,
      limit,
      search,
      q,
      standardId,
      status,
      sort,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filter;

    const effectivePageSize = limit ?? pageSize;
    const qb = this.profileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.standard', 'standard')
      .where('profile.tenantId = :tenantId', { tenantId })
      .andWhere('profile.isDeleted = :isDeleted', { isDeleted: false });

    // Apply search filter
    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere(
        '(profile.name ILIKE :search OR profile.description ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    // Apply standardId filter
    if (standardId) {
      qb.andWhere('profile.standardId = :standardId', { standardId });
    }

    // Apply status filter ONLY if explicitly provided
    // By default, return all statuses (DRAFT, PUBLISHED, ARCHIVED)
    if (status) {
      qb.andWhere('profile.status = :status', { status });
    }

    // Get total count
    const total = await qb.getCount();

    // Apply sorting
    let effectiveSortBy = sortBy;
    let effectiveSortOrder: 'ASC' | 'DESC' = sortOrder;

    if (sort) {
      const [field, direction] = sort.split(':');
      if (field && SOA_PROFILE_SORTABLE_FIELDS.includes(field)) {
        effectiveSortBy = field;
        effectiveSortOrder =
          direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      }
    }

    if (!SOA_PROFILE_SORTABLE_FIELDS.includes(effectiveSortBy)) {
      effectiveSortBy = 'createdAt';
    }

    qb.orderBy(`profile.${effectiveSortBy}`, effectiveSortOrder);

    // Apply pagination
    qb.skip((page - 1) * effectivePageSize);
    qb.take(effectivePageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, effectivePageSize);
  }

  /**
   * Get a single SOA profile by ID
   */
  async getProfile(
    tenantId: string,
    id: string,
  ): Promise<GrcSoaProfile | null> {
    return this.profileRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['standard'],
    });
  }

  /**
   * Create a new SOA profile
   */
  async createProfile(
    tenantId: string,
    userId: string,
    dto: CreateSoaProfileDto,
  ): Promise<GrcSoaProfile> {
    // Verify standard exists and belongs to tenant
    const standard = await this.standardRepository.findOne({
      where: { id: dto.standardId, tenantId, isDeleted: false },
    });

    if (!standard) {
      throw new NotFoundException(
        `Standard with ID ${dto.standardId} not found`,
      );
    }

    const profile = this.profileRepository.create({
      tenantId,
      standardId: dto.standardId,
      name: dto.name,
      description: dto.description ?? null,
      scopeText: dto.scopeText ?? null,
      status: SoaProfileStatus.DRAFT,
      version: 1,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.profileRepository.save(profile);

    // Reload with relations
    return this.profileRepository.findOne({
      where: { id: saved.id },
      relations: ['standard'],
    }) as Promise<GrcSoaProfile>;
  }

  /**
   * Update an SOA profile
   */
  async updateProfile(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateSoaProfileDto,
  ): Promise<GrcSoaProfile | null> {
    const profile = await this.profileRepository.findOne({
      where: { id, tenantId, isDeleted: false },
    });

    if (!profile) {
      return null;
    }

    // Don't allow status changes via this method (use publish instead)
    if (dto.status && dto.status !== profile.status) {
      throw new BadRequestException(
        'Use the publish endpoint to change profile status',
      );
    }

    if (dto.name !== undefined) profile.name = dto.name;
    if (dto.description !== undefined) profile.description = dto.description;
    if (dto.scopeText !== undefined) profile.scopeText = dto.scopeText;
    profile.updatedBy = userId;

    await this.profileRepository.save(profile);

    return this.profileRepository.findOne({
      where: { id },
      relations: ['standard'],
    });
  }

  /**
   * Soft delete an SOA profile
   */
  async deleteProfile(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const profile = await this.profileRepository.findOne({
      where: { id, tenantId, isDeleted: false },
    });

    if (!profile) {
      return false;
    }

    profile.isDeleted = true;
    profile.updatedBy = userId;
    await this.profileRepository.save(profile);

    return true;
  }

  /**
   * Publish an SOA profile
   * Sets status to PUBLISHED and records publishedAt timestamp
   */
  async publishProfile(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<GrcSoaProfile | null> {
    const profile = await this.profileRepository.findOne({
      where: { id, tenantId, isDeleted: false },
    });

    if (!profile) {
      return null;
    }

    if (profile.status === SoaProfileStatus.PUBLISHED) {
      // Increment version on re-publish
      profile.version += 1;
    }

    profile.status = SoaProfileStatus.PUBLISHED;
    profile.publishedAt = new Date();
    profile.updatedBy = userId;

    await this.profileRepository.save(profile);

    return this.profileRepository.findOne({
      where: { id },
      relations: ['standard'],
    });
  }

  /**
   * Initialize SOA items for a profile
   * Creates missing GrcSoaItem rows for every clause of the profile's standard
   * Idempotent - skips existing items
   */
  async initializeItems(
    tenantId: string,
    userId: string,
    profileId: string,
  ): Promise<{ created: number; existing: number }> {
    const profile = await this.profileRepository.findOne({
      where: { id: profileId, tenantId, isDeleted: false },
    });

    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }

    // Get all clauses for the standard
    const clauses = await this.clauseRepository.find({
      where: { standardId: profile.standardId, tenantId, isDeleted: false },
      select: ['id'],
    });

    if (clauses.length === 0) {
      return { created: 0, existing: 0 };
    }

    // Get existing items for this profile
    const existingItems = await this.itemRepository.find({
      where: { profileId, tenantId, isDeleted: false },
      select: ['clauseId'],
    });

    const existingClauseIds = new Set(
      existingItems.map((item) => item.clauseId),
    );

    // Filter to only new clauses
    const newClauseIds = clauses
      .map((c) => c.id)
      .filter((id) => !existingClauseIds.has(id));

    if (newClauseIds.length === 0) {
      return { created: 0, existing: existingItems.length };
    }

    // Batch insert new items (in chunks of 100 for large standards)
    const BATCH_SIZE = 100;
    let created = 0;

    for (let i = 0; i < newClauseIds.length; i += BATCH_SIZE) {
      const batch = newClauseIds.slice(i, i + BATCH_SIZE);
      const items = batch.map((clauseId) =>
        this.itemRepository.create({
          tenantId,
          profileId,
          clauseId,
          applicability: SoaApplicability.UNDECIDED,
          implementationStatus: SoaImplementationStatus.NOT_IMPLEMENTED,
          createdBy: userId,
          isDeleted: false,
        }),
      );

      await this.itemRepository.save(items);
      created += items.length;
    }

    return { created, existing: existingItems.length };
  }

  // ============================================================================
  // Item Operations
  // ============================================================================

  /**
   * List SOA items with pagination and filtering
   */
  async listItems(
    tenantId: string,
    filter: FilterSoaItemDto,
  ): Promise<PaginatedResponse<GrcSoaItem>> {
    const {
      profileId,
      page = 1,
      pageSize = 20,
      limit,
      search,
      q,
      clauseId,
      applicability,
      implementationStatus,
      hasEvidence,
      hasControls,
      sort,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filter;

    const effectivePageSize = limit ?? pageSize;

    const qb = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.clause', 'clause')
      .leftJoinAndSelect('item.owner', 'owner')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.profileId = :profileId', { profileId })
      .andWhere('item.isDeleted = :isDeleted', { isDeleted: false });

    // Apply search filter (searches clause code, title, description)
    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere(
        '(clause.code ILIKE :search OR clause.title ILIKE :search OR clause.description ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    // Apply clauseId filter
    if (clauseId) {
      qb.andWhere('item.clauseId = :clauseId', { clauseId });
    }

    // Apply applicability filter
    if (applicability) {
      qb.andWhere('item.applicability = :applicability', { applicability });
    }

    // Apply implementationStatus filter
    if (implementationStatus) {
      qb.andWhere('item.implementationStatus = :implementationStatus', {
        implementationStatus,
      });
    }

    // Apply hasEvidence filter
    if (hasEvidence !== undefined) {
      if (hasEvidence) {
        qb.andWhere(
          `EXISTS (SELECT 1 FROM grc_soa_item_evidence sie WHERE sie.soa_item_id = item.id)`,
        );
      } else {
        qb.andWhere(
          `NOT EXISTS (SELECT 1 FROM grc_soa_item_evidence sie WHERE sie.soa_item_id = item.id)`,
        );
      }
    }

    // Apply hasControls filter
    if (hasControls !== undefined) {
      if (hasControls) {
        qb.andWhere(
          `EXISTS (SELECT 1 FROM grc_soa_item_controls sic WHERE sic.soa_item_id = item.id)`,
        );
      } else {
        qb.andWhere(
          `NOT EXISTS (SELECT 1 FROM grc_soa_item_controls sic WHERE sic.soa_item_id = item.id)`,
        );
      }
    }

    // Get total count
    const total = await qb.getCount();

    // Apply sorting
    let effectiveSortBy = sortBy;
    let effectiveSortOrder: 'ASC' | 'DESC' = sortOrder;

    if (sort) {
      const [field, direction] = sort.split(':');
      if (field && SOA_ITEM_SORTABLE_FIELDS.includes(field)) {
        effectiveSortBy = field;
        effectiveSortOrder =
          direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      }
    }

    if (!SOA_ITEM_SORTABLE_FIELDS.includes(effectiveSortBy)) {
      effectiveSortBy = 'createdAt';
    }

    qb.orderBy(`item.${effectiveSortBy}`, effectiveSortOrder);

    // Apply pagination
    qb.skip((page - 1) * effectivePageSize);
    qb.take(effectivePageSize);

    const items = await qb.getMany();

    // Load counts for controls and evidence
    const itemIds = items.map((i) => i.id);
    if (itemIds.length > 0) {
      const controlCounts = await this.itemControlRepository
        .createQueryBuilder('sic')
        .select('sic.soa_item_id', 'soaItemId')
        .addSelect('COUNT(*)', 'count')
        .where('sic.soa_item_id IN (:...itemIds)', { itemIds })
        .groupBy('sic.soa_item_id')
        .getRawMany<{ soaItemId: string; count: string }>();

      const evidenceCounts = await this.itemEvidenceRepository
        .createQueryBuilder('sie')
        .select('sie.soa_item_id', 'soaItemId')
        .addSelect('COUNT(*)', 'count')
        .where('sie.soa_item_id IN (:...itemIds)', { itemIds })
        .groupBy('sie.soa_item_id')
        .getRawMany<{ soaItemId: string; count: string }>();

      const controlCountMap = new Map<string, number>(
        controlCounts.map((c) => [c.soaItemId, parseInt(c.count, 10)]),
      );
      const evidenceCountMap = new Map<string, number>(
        evidenceCounts.map((e) => [e.soaItemId, parseInt(e.count, 10)]),
      );

      // Attach counts to items (using type assertion for computed properties)
      for (const item of items) {
        (
          item as GrcSoaItem & { controlsCount: number; evidenceCount: number }
        ).controlsCount = controlCountMap.get(item.id) ?? 0;
        (
          item as GrcSoaItem & { controlsCount: number; evidenceCount: number }
        ).evidenceCount = evidenceCountMap.get(item.id) ?? 0;
      }
    }

    return createPaginatedResponse(items, total, page, effectivePageSize);
  }

  /**
   * Get a single SOA item by ID
   */
  async getItem(tenantId: string, id: string): Promise<GrcSoaItem | null> {
    const item = await this.itemRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: [
        'clause',
        'owner',
        'soaItemControls',
        'soaItemControls.control',
        'soaItemEvidence',
        'soaItemEvidence.evidence',
      ],
    });

    if (item) {
      (
        item as GrcSoaItem & { controlsCount: number; evidenceCount: number }
      ).controlsCount = item.soaItemControls?.length ?? 0;
      (
        item as GrcSoaItem & { controlsCount: number; evidenceCount: number }
      ).evidenceCount = item.soaItemEvidence?.length ?? 0;
    }

    return item;
  }

  /**
   * Update an SOA item
   */
  async updateItem(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateSoaItemDto,
  ): Promise<GrcSoaItem | null> {
    const item = await this.itemRepository.findOne({
      where: { id, tenantId, isDeleted: false },
    });

    if (!item) {
      return null;
    }

    if (dto.applicability !== undefined) item.applicability = dto.applicability;
    if (dto.justification !== undefined) item.justification = dto.justification;
    if (dto.implementationStatus !== undefined)
      item.implementationStatus = dto.implementationStatus;
    if (dto.targetDate !== undefined)
      item.targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    if (dto.ownerUserId !== undefined) item.ownerUserId = dto.ownerUserId;
    if (dto.notes !== undefined) item.notes = dto.notes;
    item.updatedBy = userId;

    await this.itemRepository.save(item);

    return this.getItem(tenantId, id);
  }

  // ============================================================================
  // Control Linking
  // ============================================================================

  /**
   * Link a control to an SOA item
   */
  async linkControl(
    tenantId: string,
    soaItemId: string,
    controlId: string,
  ): Promise<GrcSoaItemControl> {
    // Verify SOA item exists
    const item = await this.itemRepository.findOne({
      where: { id: soaItemId, tenantId, isDeleted: false },
    });
    if (!item) {
      throw new NotFoundException(`SOA Item with ID ${soaItemId} not found`);
    }

    // Verify control exists
    const control = await this.controlRepository.findOne({
      where: { id: controlId, tenantId, isDeleted: false },
    });
    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }

    // Check if link already exists
    const existing = await this.itemControlRepository.findOne({
      where: { tenantId, soaItemId, controlId },
    });
    if (existing) {
      throw new ConflictException(
        `Control ${controlId} is already linked to SOA Item ${soaItemId}`,
      );
    }

    const link = this.itemControlRepository.create({
      tenantId,
      soaItemId,
      controlId,
    });

    return this.itemControlRepository.save(link);
  }

  /**
   * Unlink a control from an SOA item
   */
  async unlinkControl(
    tenantId: string,
    soaItemId: string,
    controlId: string,
  ): Promise<boolean> {
    const link = await this.itemControlRepository.findOne({
      where: { tenantId, soaItemId, controlId },
    });

    if (!link) {
      return false;
    }

    await this.itemControlRepository.remove(link);
    return true;
  }

  // ============================================================================
  // Evidence Linking
  // ============================================================================

  /**
   * Link evidence to an SOA item
   */
  async linkEvidence(
    tenantId: string,
    soaItemId: string,
    evidenceId: string,
  ): Promise<GrcSoaItemEvidence> {
    // Verify SOA item exists
    const item = await this.itemRepository.findOne({
      where: { id: soaItemId, tenantId, isDeleted: false },
    });
    if (!item) {
      throw new NotFoundException(`SOA Item with ID ${soaItemId} not found`);
    }

    // Verify evidence exists
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId, tenantId, isDeleted: false },
    });
    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${evidenceId} not found`);
    }

    // Check if link already exists
    const existing = await this.itemEvidenceRepository.findOne({
      where: { tenantId, soaItemId, evidenceId },
    });
    if (existing) {
      throw new ConflictException(
        `Evidence ${evidenceId} is already linked to SOA Item ${soaItemId}`,
      );
    }

    const link = this.itemEvidenceRepository.create({
      tenantId,
      soaItemId,
      evidenceId,
    });

    return this.itemEvidenceRepository.save(link);
  }

  /**
   * Unlink evidence from an SOA item
   */
  async unlinkEvidence(
    tenantId: string,
    soaItemId: string,
    evidenceId: string,
  ): Promise<boolean> {
    const link = await this.itemEvidenceRepository.findOne({
      where: { tenantId, soaItemId, evidenceId },
    });

    if (!link) {
      return false;
    }

    await this.itemEvidenceRepository.remove(link);
    return true;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get statistics for an SOA profile
   * Returns aggregated counts for applicability, implementation status,
   * evidence coverage, and control coverage.
   */
  async getProfileStatistics(
    tenantId: string,
    profileId: string,
  ): Promise<{
    totalItems: number;
    applicabilityCounts: Record<string, number>;
    implementationCounts: Record<string, number>;
    evidenceCoverage: {
      itemsWithEvidence: number;
      itemsWithoutEvidence: number;
    };
    controlCoverage: {
      itemsWithControls: number;
      itemsWithoutControls: number;
    };
    gaps: {
      missingControls: number;
      missingEvidence: number;
      applicableNotImplemented: number;
    };
  }> {
    const profile = await this.profileRepository.findOne({
      where: { id: profileId, tenantId, isDeleted: false },
    });

    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }

    const qb = this.itemRepository
      .createQueryBuilder('item')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.profileId = :profileId', { profileId })
      .andWhere('item.isDeleted = :isDeleted', { isDeleted: false });

    const totalItems = await qb.getCount();

    const applicabilityRaw = await this.itemRepository
      .createQueryBuilder('item')
      .select('item.applicability', 'applicability')
      .addSelect('COUNT(*)', 'count')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.profileId = :profileId', { profileId })
      .andWhere('item.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('item.applicability')
      .getRawMany<{ applicability: string; count: string }>();

    const applicabilityCounts: Record<string, number> = {};
    for (const row of applicabilityRaw) {
      applicabilityCounts[row.applicability] = parseInt(row.count, 10);
    }

    const implementationRaw = await this.itemRepository
      .createQueryBuilder('item')
      .select('item.implementationStatus', 'implementationStatus')
      .addSelect('COUNT(*)', 'count')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.profileId = :profileId', { profileId })
      .andWhere('item.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('item.implementationStatus')
      .getRawMany<{ implementationStatus: string; count: string }>();

    const implementationCounts: Record<string, number> = {};
    for (const row of implementationRaw) {
      implementationCounts[row.implementationStatus] = parseInt(row.count, 10);
    }

    const itemIds = await this.itemRepository
      .createQueryBuilder('item')
      .select('item.id')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.profileId = :profileId', { profileId })
      .andWhere('item.isDeleted = :isDeleted', { isDeleted: false })
      .getRawMany<{ item_id: string }>();

    const ids = itemIds.map((r) => r.item_id);

    let itemsWithEvidence = 0;
    let itemsWithControls = 0;

    if (ids.length > 0) {
      const evidenceCountResult = await this.itemEvidenceRepository
        .createQueryBuilder('sie')
        .select('COUNT(DISTINCT sie.soa_item_id)', 'count')
        .where('sie.soa_item_id IN (:...ids)', { ids })
        .getRawOne<{ count: string }>();
      itemsWithEvidence = parseInt(evidenceCountResult?.count || '0', 10);

      const controlCountResult = await this.itemControlRepository
        .createQueryBuilder('sic')
        .select('COUNT(DISTINCT sic.soa_item_id)', 'count')
        .where('sic.soa_item_id IN (:...ids)', { ids })
        .getRawOne<{ count: string }>();
      itemsWithControls = parseInt(controlCountResult?.count || '0', 10);
    }

    const applicableNotImplementedResult = await this.itemRepository
      .createQueryBuilder('item')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.profileId = :profileId', { profileId })
      .andWhere('item.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('item.applicability = :applicability', {
        applicability: SoaApplicability.APPLICABLE,
      })
      .andWhere('item.implementationStatus = :implementationStatus', {
        implementationStatus: SoaImplementationStatus.NOT_IMPLEMENTED,
      })
      .getCount();

    return {
      totalItems,
      applicabilityCounts,
      implementationCounts,
      evidenceCoverage: {
        itemsWithEvidence,
        itemsWithoutEvidence: totalItems - itemsWithEvidence,
      },
      controlCoverage: {
        itemsWithControls,
        itemsWithoutControls: totalItems - itemsWithControls,
      },
      gaps: {
        missingControls: totalItems - itemsWithControls,
        missingEvidence: totalItems - itemsWithEvidence,
        applicableNotImplemented: applicableNotImplementedResult,
      },
    };
  }

  // ============================================================================
  // Export
  // ============================================================================

  /**
   * Export SOA profile to CSV format
   */
  async exportCsv(tenantId: string, profileId: string): Promise<string> {
    const profile = await this.profileRepository.findOne({
      where: { id: profileId, tenantId, isDeleted: false },
      relations: ['standard'],
    });

    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }

    // Get all items with clause info
    const items = await this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.clause', 'clause')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.profileId = :profileId', { profileId })
      .andWhere('item.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('clause.code', 'ASC')
      .getMany();

    // Get counts for all items
    const itemIds = items.map((i) => i.id);
    let controlCountMap = new Map<string, number>();
    let evidenceCountMap = new Map<string, number>();

    if (itemIds.length > 0) {
      const controlCounts = await this.itemControlRepository
        .createQueryBuilder('sic')
        .select('sic.soa_item_id', 'soaItemId')
        .addSelect('COUNT(*)', 'count')
        .where('sic.soa_item_id IN (:...itemIds)', { itemIds })
        .groupBy('sic.soa_item_id')
        .getRawMany<{ soaItemId: string; count: string }>();

      const evidenceCounts = await this.itemEvidenceRepository
        .createQueryBuilder('sie')
        .select('sie.soa_item_id', 'soaItemId')
        .addSelect('COUNT(*)', 'count')
        .where('sie.soa_item_id IN (:...itemIds)', { itemIds })
        .groupBy('sie.soa_item_id')
        .getRawMany<{ soaItemId: string; count: string }>();

      controlCountMap = new Map<string, number>(
        controlCounts.map((c) => [c.soaItemId, parseInt(c.count, 10)]),
      );
      evidenceCountMap = new Map<string, number>(
        evidenceCounts.map((e) => [e.soaItemId, parseInt(e.count, 10)]),
      );
    }

    // Build CSV
    const headers = [
      'Clause Code',
      'Clause Title',
      'Applicability',
      'Justification',
      'Implementation Status',
      'Target Date',
      'Owner User ID',
      'Controls Count',
      'Evidence Count',
      'Notes',
    ];

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = items.map((item) => [
      escapeCSV(item.clause?.code),
      escapeCSV(item.clause?.title),
      escapeCSV(item.applicability),
      escapeCSV(item.justification),
      escapeCSV(item.implementationStatus),
      escapeCSV(item.targetDate?.toISOString().split('T')[0]),
      escapeCSV(item.ownerUserId),
      String(controlCountMap.get(item.id) ?? 0),
      String(evidenceCountMap.get(item.id) ?? 0),
      escapeCSV(item.notes),
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n',
    );

    return csv;
  }
}
