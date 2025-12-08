import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { GrcRisk } from '../entities/grc-risk.entity';
import { GrcPolicy } from '../entities/grc-policy.entity';
import { GrcRequirement } from '../entities/grc-requirement.entity';
import { QueryDSLService, QueryDSL } from './query-dsl.service';
import { SearchEngine } from '../enums';

/**
 * Search query DTO
 */
export interface SearchQueryDto {
  query?: string;
  dsl?: QueryDSL;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  searchFields?: string[];
}

/**
 * Search result DTO
 */
export interface SearchResultDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Supported searchable entities
 */
export type SearchableEntity = 'risk' | 'policy' | 'requirement';

/**
 * Search Service
 *
 * Provides a unified search abstraction layer that supports multiple engines.
 * Currently implements PostgreSQL search with ILIKE and optional full-text search.
 * Designed to be extended with Elasticsearch support in the future.
 */
@Injectable()
export class SearchService {
  private readonly engine: SearchEngine = SearchEngine.POSTGRES;

  constructor(
    @InjectRepository(GrcRisk)
    private readonly riskRepository: Repository<GrcRisk>,
    @InjectRepository(GrcPolicy)
    private readonly policyRepository: Repository<GrcPolicy>,
    @InjectRepository(GrcRequirement)
    private readonly requirementRepository: Repository<GrcRequirement>,
    private readonly queryDSLService: QueryDSLService,
  ) {}

  /**
   * Search across an entity type
   */
  async search<T>(
    tenantId: string,
    entity: SearchableEntity,
    query: SearchQueryDto,
  ): Promise<SearchResultDto<T>> {
    if (this.engine === SearchEngine.ELASTICSEARCH) {
      return this.searchElasticsearch(tenantId, entity, query);
    }

    switch (entity) {
      case 'risk':
        return this.searchRisksInternal(tenantId, query) as Promise<SearchResultDto<T>>;
      case 'policy':
        return this.searchPoliciesInternal(tenantId, query) as Promise<SearchResultDto<T>>;
      case 'requirement':
        return this.searchRequirementsInternal(tenantId, query) as Promise<SearchResultDto<T>>;
      default:
        throw new BadRequestException(`Unknown entity type: ${entity}`);
    }
  }

  /**
   * Internal search implementation for risks
   */
  private async searchRisksInternal(
    tenantId: string,
    query: SearchQueryDto,
  ): Promise<SearchResultDto<GrcRisk>> {
    const {
      query: searchQuery,
      dsl,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      searchFields = ['title', 'description', 'category'],
    } = query;

    const qb = this.riskRepository.createQueryBuilder('risk');

    qb.where('risk.tenantId = :tenantId', { tenantId });
    qb.andWhere('risk.isDeleted = :isDeleted', { isDeleted: false });

    if (searchQuery) {
      this.applyTextSearch(qb, 'risk', searchQuery, searchFields);
    }

    if (dsl) {
      this.queryDSLService.applyDSL(qb, dsl, 'risk');
    }

    const total = await qb.getCount();

    qb.orderBy(`risk.${sortBy}`, sortOrder);
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Internal search implementation for policies
   */
  private async searchPoliciesInternal(
    tenantId: string,
    query: SearchQueryDto,
  ): Promise<SearchResultDto<GrcPolicy>> {
    const {
      query: searchQuery,
      dsl,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      searchFields = ['name', 'summary', 'category', 'code'],
    } = query;

    const qb = this.policyRepository.createQueryBuilder('policy');

    qb.where('policy.tenantId = :tenantId', { tenantId });
    qb.andWhere('policy.isDeleted = :isDeleted', { isDeleted: false });

    if (searchQuery) {
      this.applyTextSearch(qb, 'policy', searchQuery, searchFields);
    }

    if (dsl) {
      this.queryDSLService.applyDSL(qb, dsl, 'policy');
    }

    const total = await qb.getCount();

    qb.orderBy(`policy.${sortBy}`, sortOrder);
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Internal search implementation for requirements
   */
  private async searchRequirementsInternal(
    tenantId: string,
    query: SearchQueryDto,
  ): Promise<SearchResultDto<GrcRequirement>> {
    const {
      query: searchQuery,
      dsl,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      searchFields = ['title', 'description', 'framework'],
    } = query;

    const qb = this.requirementRepository.createQueryBuilder('requirement');

    qb.where('requirement.tenantId = :tenantId', { tenantId });
    qb.andWhere('requirement.isDeleted = :isDeleted', { isDeleted: false });

    if (searchQuery) {
      this.applyTextSearch(qb, 'requirement', searchQuery, searchFields);
    }

    if (dsl) {
      this.queryDSLService.applyDSL(qb, dsl, 'requirement');
    }

    const total = await qb.getCount();

    qb.orderBy(`requirement.${sortBy}`, sortOrder);
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Elasticsearch search implementation (stub for future)
   */
  private async searchElasticsearch<T>(
    tenantId: string,
    entity: SearchableEntity,
    query: SearchQueryDto,
  ): Promise<SearchResultDto<T>> {
    throw new BadRequestException(
      'Elasticsearch search is not yet implemented. Please use PostgreSQL search.',
    );
  }

  /**
   * Apply text search using ILIKE
   */
  private applyTextSearch<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    searchQuery: string,
    fields: string[],
  ): void {
    if (fields.length === 0) {
      return;
    }

    const conditions = fields.map(
      (field, index) => `${alias}.${field} ILIKE :search_${index}`,
    );

    const params: Record<string, string> = {};
    fields.forEach((_, index) => {
      params[`search_${index}`] = `%${searchQuery}%`;
    });

    qb.andWhere(`(${conditions.join(' OR ')})`, params);
  }

  /**
   * Search risks
   */
  async searchRisks(
    tenantId: string,
    query: SearchQueryDto,
  ): Promise<SearchResultDto<GrcRisk>> {
    return this.searchRisksInternal(tenantId, query);
  }

  /**
   * Search policies
   */
  async searchPolicies(
    tenantId: string,
    query: SearchQueryDto,
  ): Promise<SearchResultDto<GrcPolicy>> {
    return this.searchPoliciesInternal(tenantId, query);
  }

  /**
   * Search requirements
   */
  async searchRequirements(
    tenantId: string,
    query: SearchQueryDto,
  ): Promise<SearchResultDto<GrcRequirement>> {
    return this.searchRequirementsInternal(tenantId, query);
  }

  /**
   * Get current search engine
   */
  getEngine(): SearchEngine {
    return this.engine;
  }

  /**
   * Check if full-text search is available
   */
  isFullTextSearchAvailable(): boolean {
    return this.engine === SearchEngine.ELASTICSEARCH;
  }
}
