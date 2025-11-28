import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  ILike,
  FindOptionsWhere,
  In,
  SelectQueryBuilder,
} from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { CreateRiskCatalogDto, UpdateRiskCatalogDto } from './dto/create-risk-catalog.dto';
import { CreateClauseDto } from './dto/create-clause.dto';
import { QueryRiskCatalogDto } from './dto/query-risk-catalog.dto';
import { parseQuery } from '../../common/search/query-parser';
import { parsePagination, parseSort } from '../../common/search/pagination.dto';
import {
  StandardEntity,
  StandardClauseEntity,
  StandardMappingEntity,
  ControlLibraryEntity,
  ControlToClauseEntity,
  ControlToPolicyEntity,
  ControlToCapEntity,
  RiskCatalogEntity,
  RiskCategoryEntity,
  PolicyEntity,
  RiskToControlEntity,
  AuditFindingEntity,
  CorrectiveActionEntity,
} from '../../entities/app';
import { MappingRelation } from '../../entities/app/standard-mapping.entity';
import { tenantWhere } from '../../common/tenant/tenant-query.util';

@Injectable()
export class DataFoundationService {
  private readonly logger = new Logger(DataFoundationService.name);

  constructor(
    @InjectRepository(StandardEntity)
    private readonly standardRepo: Repository<StandardEntity>,
    @InjectRepository(StandardClauseEntity)
    private readonly clauseRepo: Repository<StandardClauseEntity>,
    @InjectRepository(StandardMappingEntity)
    private readonly mappingRepo: Repository<StandardMappingEntity>,
    @InjectRepository(ControlLibraryEntity)
    private readonly controlRepo: Repository<ControlLibraryEntity>,
    @InjectRepository(ControlToClauseEntity)
    private readonly controlToClauseRepo: Repository<ControlToClauseEntity>,
    @InjectRepository(ControlToPolicyEntity)
    private readonly controlToPolicyRepo: Repository<ControlToPolicyEntity>,
    @InjectRepository(ControlToCapEntity)
    private readonly controlToCapRepo: Repository<ControlToCapEntity>,
    @InjectRepository(RiskCatalogEntity)
    private readonly riskCatalogRepo: Repository<RiskCatalogEntity>,
    @InjectRepository(RiskCategoryEntity)
    private readonly categoryRepo: Repository<RiskCategoryEntity>,
    @InjectRepository(PolicyEntity)
    private readonly policyRepo: Repository<PolicyEntity>,
    @InjectRepository(RiskToControlEntity)
    private readonly riskToControlRepo: Repository<RiskToControlEntity>,
    @InjectRepository(AuditFindingEntity)
    private readonly auditFindingRepo: Repository<AuditFindingEntity>,
    @InjectRepository(CorrectiveActionEntity)
    private readonly capRepo: Repository<CorrectiveActionEntity>,
    private readonly config: ConfigService,
  ) {}

  async findStandards(tenantId: string, code?: string) {
    const where: FindOptionsWhere<StandardEntity> = {
      ...tenantWhere(tenantId),
    };
    if (code) where.code = code;

    return this.standardRepo.find({ where, order: { code: 'ASC' } });
  }

  async findStandardClauses(
    tenantId: string,
    standardCode: string,
    includeSynthetic?: boolean,
  ) {
    const standard = await this.standardRepo.findOne({
      where: { code: standardCode, ...tenantWhere(tenantId) },
    });

    if (!standard) {
      throw new NotFoundException(`Standard ${standardCode} not found`);
    }

    // Default: hide synthetic in production, show in development
    const defaultIncludeSynthetic =
      includeSynthetic !== undefined
        ? includeSynthetic
        : this.config.get<string>('NODE_ENV') !== 'production';

    const whereClause: FindOptionsWhere<StandardClauseEntity> = {
      standard_id: standard.id,
      ...tenantWhere(tenantId),
    };

    if (!defaultIncludeSynthetic) {
      whereClause.synthetic = false;
    }

    const clauses = await this.clauseRepo.find({
      where: whereClause,
      relations: ['parent'],
      order: { clause_code: 'ASC' },
    });

    // Build hierarchical tree
    const clauseMap = new Map<
      string,
      StandardClauseEntity & { children?: StandardClauseEntity[] }
    >();
    const rootClauses: (StandardClauseEntity & {
      children?: StandardClauseEntity[];
    })[] = [];

    clauses.forEach((clause) => {
      clauseMap.set(clause.id, { ...clause, children: [] });
    });

    clauses.forEach((clause) => {
      const node = clauseMap.get(clause.id)!;
      if (clause.parent_id && clauseMap.has(clause.parent_id)) {
        const parent = clauseMap.get(clause.parent_id)!;
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        rootClauses.push(node);
      }
    });

    return rootClauses;
  }

  async findControls(tenantId: string, family?: string, search?: string) {
    const where: FindOptionsWhere<ControlLibraryEntity> = {
      ...tenantWhere(tenantId),
    };
    if (family) where.family = family;
    if (search) {
      where.code = ILike(`%${search}%`);
    }

    const [items, total] = await this.controlRepo.findAndCount({
      where,
      order: { code: 'ASC' },
      take: 1000,
    });

    // If search provided, also search in name
    if (search && items.length < total) {
      const nameResults = await this.controlRepo.find({
        where: {
          ...tenantWhere(tenantId),
          name: ILike(`%${search}%`),
        },
        take: 1000,
      });

      const existingCodes = new Set(items.map((i) => i.code));
      const additional = nameResults.filter((r) => !existingCodes.has(r.code));
      items.push(...additional);
    }

    return { items, total: items.length };
  }

  async getOneControl(id: string, tenantId: string) {
    const control = await this.controlRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
      relations: ['clause', 'clause.standard'],
    });

    if (!control) {
      throw new NotFoundException(`Control ${id} not found`);
    }

    // Load related clauses via join table
    const controlToClauses = await this.controlToClauseRepo.find({
      where: { control_id: control.id, tenant_id: tenantId },
      relations: ['clause', 'clause.standard'],
    });

    // Load related policies
    const controlToPolicies = await this.controlToPolicyRepo.find({
      where: { control_id: control.id, tenant_id: tenantId },
      relations: ['policy'],
    });

    // Load related risks via risk-to-control join table
    const riskToControls = await this.riskToControlRepo.find({
      where: { control_id: control.id, tenant_id: tenantId },
      relations: ['risk'],
    });

    // Load related audit findings
    const findings = await this.auditFindingRepo.find({
      where: { control_id: control.id, ...tenantWhere(tenantId) },
      take: 10,
    });

    // Load related CAPs via join table
    const controlToCaps = await this.controlToCapRepo.find({
      where: { control_id: control.id, tenant_id: tenantId },
      relations: ['cap'],
    });

    // Build response with relationships
    return {
      ...control,
      linkedClauses: controlToClauses.map((ctc) => ({
        id: ctc.clause?.id,
        code: ctc.clause?.clause_code,
        title: ctc.clause?.title,
        standard: ctc.clause?.standard
          ? {
              id: ctc.clause.standard.id,
              code: ctc.clause.standard.code,
              name: ctc.clause.standard.name,
            }
          : null,
      })),
      linkedPolicies: controlToPolicies.map((ctp) => ({
        id: ctp.policy?.id,
        code: ctp.policy?.code,
        title: ctp.policy?.title,
        status: ctp.policy?.status,
      })),
      linkedRisks: riskToControls.map((rtc) => ({
        id: rtc.risk?.id,
        code: rtc.risk?.code,
        name: rtc.risk?.name,
        defaultLikelihood: rtc.risk?.default_likelihood,
        defaultImpact: rtc.risk?.default_impact,
      })),
      linkedFindings: findings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        status: f.status,
      })),
      linkedCaps: controlToCaps.map((ctc) => ({
        id: ctc.cap?.id,
        code: ctc.cap?.code,
        title: ctc.cap?.title,
        status: ctc.cap?.status,
        dueDate: ctc.cap?.due_date,
      })),
    };
  }

  async findRiskCatalog(tenantId: string, query: QueryRiskCatalogDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { code: 'ASC' };

      // Build query builder for flexible filtering
      const qb = this.riskCatalogRepo
        .createQueryBuilder('risk')
        .leftJoinAndSelect('risk.category', 'category')
        .where('risk.tenant_id = :tenantId', { tenantId });

      // KQL query parsing
      if (query.q) {
        const ast = parseQuery(query.q);
        if (ast) {
          const fieldMapping: Record<string, string> = {
            name: 'risk.name',
            code: 'risk.code',
            category: 'category.code',
            likelihood: 'risk.default_likelihood',
            impact: 'risk.default_impact',
            description: 'risk.description',
          };

          // Apply KQL conditions
          ast.conditions.forEach((cond, idx) => {
            const dbField = fieldMapping[cond.field] || `risk.${cond.field}`;
            const paramName = `kql_${idx}`;
            let condition: string;
            const value: any = cond.value;

            switch (cond.operator) {
              case '=':
                if (cond.field === 'category') {
                  qb.andWhere(`${dbField} = :${paramName}`, {
                    [paramName]: value,
                  });
                } else {
                  qb.andWhere(`${dbField} = :${paramName}`, {
                    [paramName]: value,
                  });
                }
                break;
              case '!=':
                qb.andWhere(`${dbField} != :${paramName}`, {
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
              case 'startswith':
                qb.andWhere(`${dbField} ILIKE :${paramName}`, {
                  [paramName]: `${value}%`,
                });
                break;
              case 'endswith':
                qb.andWhere(`${dbField} ILIKE :${paramName}`, {
                  [paramName]: `%${value}`,
                });
                break;
            }
          });
        }
      }

      // Column filters (applied after KQL if both present, combined with AND)
      if (query.code) {
        qb.andWhere('risk.code ILIKE :codeFilter', {
          codeFilter: `%${query.code}%`,
        });
      }

      if (query.name) {
        qb.andWhere('risk.name ILIKE :nameFilter', {
          nameFilter: `%${query.name}%`,
        });
      }

      if (query.category) {
        const categoryEntity = await this.categoryRepo.findOne({
          where: { code: query.category, ...tenantWhere(tenantId) },
        });
        if (categoryEntity) {
          qb.andWhere('risk.category_id = :categoryId', {
            categoryId: categoryEntity.id,
          });
        }
      }

      if (query.tags) {
        const tagArray = query.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        if (tagArray.length > 0) {
          qb.andWhere('risk.tags::text ILIKE ANY(:tags)', {
            tags: tagArray.map((tag) => `%${tag}%`),
          });
        }
      }

      if (query.likelihoodOp && query.likelihoodVal) {
        const op = query.likelihoodOp === '=' ? '=' : query.likelihoodOp;
        const val = parseInt(query.likelihoodVal, 10);
        if (!isNaN(val) && val >= 1 && val <= 5) {
          qb.andWhere(`risk.default_likelihood ${op} :likelihoodVal`, {
            likelihoodVal: val,
          });
        }
      }

      if (query.impactOp && query.impactVal) {
        const op = query.impactOp === '=' ? '=' : query.impactOp;
        const val = parseInt(query.impactVal, 10);
        if (!isNaN(val) && val >= 1 && val <= 5) {
          qb.andWhere(`risk.default_impact ${op} :impactVal`, {
            impactVal: val,
          });
        }
      }

      // Legacy search support (only if no KQL and no column filters)
      if (query.search && !query.q && !query.code && !query.name) {
        qb.andWhere('(risk.code ILIKE :search OR risk.name ILIKE :search)', {
          search: `%${query.search}%`,
        });
      }

      // Apply sorting
      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`risk.${field}`, dir);
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
      this.logger.warn('Error finding risk catalog:', error?.message || error);
      // Return empty list on error (defensive)
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  /**
   * Parse clause input string into standard code and clause path
   * @param input Clause string (e.g., "ISO20000:8.4" or "iso20000:8.4")
   * @returns Parsed result with ok flag
   */
  parseClause(
    input: string,
  ):
    | { ok: true; stdCode: string; clausePath: string }
    | { ok: false; reason: string } {
    if (!input || typeof input !== 'string') {
      return { ok: false, reason: 'invalid_format' };
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return { ok: false, reason: 'invalid_format' };
    }

    const parts = trimmed.split(':');
    if (parts.length < 2 || parts.length > 3) {
      return { ok: false, reason: 'invalid_format' };
    }

    const stdCodeRaw = parts[0];
    if (!stdCodeRaw) {
      return { ok: false, reason: 'invalid_format' };
    }
    const stdCode = stdCodeRaw.toUpperCase();
    const clausePath = parts.slice(1).join(':');

    if (!stdCode || !clausePath) {
      return { ok: false, reason: 'invalid_format' };
    }

    // Validate format: STD:PATH (PATH can contain dots and colons)
    if (!/^[A-Z0-9]+$/.test(stdCode) || !/^[0-9.]+$/.test(clausePath)) {
      return { ok: false, reason: 'invalid_format' };
    }

    return { ok: true, stdCode, clausePath };
  }

  async findCrossImpact(
    tenantId: string,
    clauseCode: string,
    includeSynthetic?: boolean,
  ) {
    try {
      // Parse clause code
      const parsed = this.parseClause(clauseCode);
      if (!parsed.ok) {
        return {
          clause: clauseCode,
          matches: [],
          note: 'invalid_clause_format',
        };
      }

      const { stdCode, clausePath } = parsed;

      // Find standard
      const standard = await this.standardRepo.findOne({
        where: { code: stdCode, ...tenantWhere(tenantId) },
      });

      if (!standard) {
        return {
          clause: clauseCode,
          matches: [],
          note: 'standard_not_found',
        };
      }

      // Find source clause - try clause_code first, then path as fallback
      let clause = await this.clauseRepo.findOne({
        where: {
          standard_id: standard.id,
          clause_code: clausePath,
          ...tenantWhere(tenantId),
        },
      });

      if (!clause) {
        // Fallback: try path field (format: STD:PATH or just PATH)
        clause = await this.clauseRepo.findOne({
          where: {
            standard_id: standard.id,
            path: `${stdCode}:${clausePath}`,
            ...tenantWhere(tenantId),
          },
        });

        if (!clause) {
          // Try just PATH without STD prefix
          clause = await this.clauseRepo.findOne({
            where: {
              standard_id: standard.id,
              path: clausePath,
              ...tenantWhere(tenantId),
            },
          });
        }
      }

      if (!clause) {
        return {
          clause: clauseCode,
          matches: [],
          note: 'clause_not_found',
        };
      }

      // Default: hide synthetic in production, show in development
      const defaultIncludeSynthetic =
        includeSynthetic !== undefined
          ? includeSynthetic
          : this.config.get<string>('NODE_ENV') !== 'production';

      // Build mapping query using QueryBuilder for OR condition
      const queryBuilder = this.mappingRepo
        .createQueryBuilder('mapping')
        .leftJoinAndSelect('mapping.from_clause', 'from_clause')
        .leftJoinAndSelect('mapping.to_clause', 'to_clause')
        .leftJoinAndSelect('from_clause.standard', 'from_standard')
        .leftJoinAndSelect('to_clause.standard', 'to_standard')
        .where('mapping.tenant_id = :tenantId', { tenantId })
        .andWhere(
          '(mapping.from_clause_id = :clauseId OR mapping.to_clause_id = :clauseId)',
          {
            clauseId: clause.id,
          },
        );

      // Apply synthetic filter if needed
      if (!defaultIncludeSynthetic) {
        queryBuilder.andWhere('mapping.synthetic = :synthetic', {
          synthetic: false,
        });
      }

      const mappings = await queryBuilder.getMany();

      // Build matches array
      const matches = mappings
        .map((m) => {
          const relatedClause =
            m.from_clause_id === clause.id ? m.to_clause : m.from_clause;
          if (!relatedClause || !relatedClause.standard) return null;

          return {
            stdCode: relatedClause.standard.code,
            clauseCode: relatedClause.clause_code,
            relation: m.relation,
            title: relatedClause.title,
          };
        })
        .filter((m) => m !== null);

      return {
        clause: clauseCode,
        matches,
      };
    } catch (error: any) {
      const errorId = randomUUID();
      this.logger.warn({
        scope: 'crossImpact',
        errorId,
        message: error?.message || String(error),
        stack: error?.stack,
        tenantId,
        clauseCode,
      });

      return {
        clause: clauseCode,
        matches: [],
        note: 'internal_error',
        ...(this.config.get<string>('NODE_ENV') !== 'production'
          ? { errorId }
          : {}),
      };
    }
  }

  async createFinding(
    tenantId: string,
    dto: {
      title: string;
      description?: string;
      relatedClauseCodes: string[];
      severity: string;
    },
  ) {
    // Parse clause codes
    const clauseCodes = dto.relatedClauseCodes.map((code) => {
      const parts = code.split(':');
      if (parts.length !== 2) {
        throw new NotFoundException(`Invalid clause code format: ${code}`);
      }
      return {
        standardCode: parts[0],
        clauseNumber: parts[1],
        originalCode: code,
      };
    });

    // Find all related standards
    const standardCodes = [...new Set(clauseCodes.map((c) => c.standardCode))];
    const standards = await this.standardRepo.find({
      where: {
        code: In(standardCodes),
        ...tenantWhere(tenantId),
      },
    });

    if (standards.length !== standardCodes.length) {
      throw new NotFoundException('One or more standards not found');
    }

    const standardMap = new Map(standards.map((s) => [s.code, s]));

    // Find all clauses
    const clauses: StandardClauseEntity[] = [];
    for (const cc of clauseCodes) {
      const standardCode = cc.standardCode;
      if (!standardCode) {
        continue;
      }
      const standard = standardMap.get(standardCode);
      if (!standard) continue;

      const clause = await this.clauseRepo.findOne({
        where: {
          standard_id: standard.id,
          clause_code: cc.clauseNumber,
          ...tenantWhere(tenantId),
        },
        relations: ['standard'],
      });

      if (!clause) {
        throw new NotFoundException(`Clause ${cc.originalCode} not found`);
      }
      clauses.push(clause);
    }

    // Get cross-impact for all related clauses
    const allCrossImpacts: any[] = [];

    for (const clause of clauses) {
      const mappings = await this.mappingRepo.find({
        where: [
          { from_clause_id: clause.id, ...tenantWhere(tenantId) },
          { to_clause_id: clause.id, ...tenantWhere(tenantId) },
        ],
        relations: [
          'from_clause',
          'to_clause',
          'from_clause.standard',
          'to_clause.standard',
        ],
      });

      for (const m of mappings) {
        const relatedClause =
          m.from_clause_id === clause.id ? m.to_clause : m.from_clause;
        if (!relatedClause || !relatedClause.standard) continue;

        const existing = allCrossImpacts.find(
          (ci) =>
            ci.clauseCode ===
            `${relatedClause.standard!.code}:${relatedClause.clause_code}`,
        );
        if (!existing) {
          allCrossImpacts.push({
            clauseCode: `${relatedClause.standard.code}:${relatedClause.clause_code}`,
            title: relatedClause.title,
            standard: relatedClause.standard.name,
            relation: m.relation,
          });
        }
      }
    }

    // Return finding with cross-impact
    return {
      id: `finding-${Date.now()}`,
      title: dto.title,
      description: dto.description,
      severity: dto.severity,
      relatedClauses: clauses.map((c, idx) => ({
        code: dto.relatedClauseCodes[idx],
        title: c.title,
      })),
      crossImpact: allCrossImpacts,
    };
  }

  async createRiskCatalog(tenantId: string, dto: CreateRiskCatalogDto) {
    try {
      // Check for duplicate code within tenant
      const existing = await this.riskCatalogRepo.findOne({
        where: {
          code: dto.code,
          ...tenantWhere(tenantId),
        },
      });

      if (existing) {
        throw new ConflictException({
          message: `Risk with code ${dto.code} already exists`,
          error: 'duplicate_code',
        });
      }

      // Resolve category if provided
      let categoryId: string | undefined;
      if (dto.categoryCode) {
        const category = await this.categoryRepo.findOne({
          where: {
            code: dto.categoryCode,
            ...tenantWhere(tenantId),
          },
        });

        if (!category) {
          throw new NotFoundException(
            `Risk category with code ${dto.categoryCode} not found`,
          );
        }
        categoryId = category.id;
      }

      // Calculate default inherent score
      const inherentLikelihood = dto.default_inherent_likelihood ?? dto.default_likelihood ?? 3;
      const inherentImpact = dto.default_inherent_impact ?? dto.default_impact ?? 3;
      const inherentScore = inherentLikelihood * inherentImpact;

      // Prepare risk data with all new fields
      const riskData: any = {
        id: randomUUID(),
        tenant_id: tenantId,
        code: dto.code,
        title: dto.title || dto.name || '',
        name: dto.name || dto.title || '', // Backward compatibility
        description: dto.description,
        risk_statement: dto.risk_statement,
        root_cause: dto.root_cause,
        category_id: categoryId,
        impact_areas: dto.impact_areas || [],
        default_inherent_likelihood: inherentLikelihood,
        default_inherent_impact: inherentImpact,
        default_inherent_score: inherentScore,
        // Backward compatibility fields
        default_likelihood: inherentLikelihood,
        default_impact: inherentImpact,
        tags: dto.tags || [],
        control_refs: dto.control_refs || [],
        owner_role: dto.owner_role,
        entity_type: dto.entity_type,
        entity_filter: dto.entity_filter,
        schema_version: 1,
      };

      const risk = this.riskCatalogRepo.create(riskData);
      const saveResult = await this.riskCatalogRepo.save(risk);
      const saved = Array.isArray(saveResult) ? saveResult[0] : saveResult;

      if (!saved) {
        throw new Error('Failed to save risk catalog entity');
      }

      // Handle legacy control_refs if provided (link to junction table)
      if (dto.control_refs && dto.control_refs.length > 0) {
        for (const controlId of dto.control_refs) {
          // Verify control exists
          const control = await this.controlRepo.findOne({
            where: { id: controlId, ...tenantWhere(tenantId) },
          });
          if (control) {
            // Check if link already exists
            const existingLink = await this.riskToControlRepo.findOne({
              where: {
                risk_id: saved.id,
                control_id: controlId,
                tenant_id: tenantId,
              },
            });
            if (!existingLink) {
              await this.riskToControlRepo.save({
                risk_id: saved.id,
                control_id: controlId,
                tenant_id: tenantId,
              });
            }
          }
        }
      }

      // Load relations
      const withRelations = await this.riskCatalogRepo.findOne({
        where: { id: saved.id },
        relations: ['category'],
      });

      return withRelations || saved;
    } catch (error: any) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        'Error creating risk catalog:',
        error?.message || error,
      );
      throw new Error(
        `Failed to create risk: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async getOneRiskCatalog(id: string, tenantId: string) {
    try {
      const catalog = await this.riskCatalogRepo.findOne({
        where: { id, ...tenantWhere(tenantId) },
        relations: ['category'],
      });

      if (!catalog) {
        throw new NotFoundException(`Risk catalog ${id} not found`);
      }

      return catalog;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        'Error getting risk catalog:',
        error?.message || error,
      );
      throw new NotFoundException(`Risk catalog ${id} not found`);
    }
  }

  async updateRiskCatalog(id: string, tenantId: string, dto: UpdateRiskCatalogDto) {
    try {
      const catalog = await this.getOneRiskCatalog(id, tenantId);

      // Update fields
      if (dto.code !== undefined) {
        // Check for duplicate if code changed
        if (dto.code !== catalog.code) {
          const existing = await this.riskCatalogRepo.findOne({
            where: {
              code: dto.code,
              ...tenantWhere(tenantId),
            },
          });
          if (existing && existing.id !== id) {
            throw new ConflictException(`Risk with code ${dto.code} already exists`);
          }
        }
        catalog.code = dto.code;
      }

      if (dto.title !== undefined) {
        catalog.title = dto.title;
        // Update name for backward compatibility
        catalog.name = dto.name ?? dto.title;
      } else if (dto.name !== undefined) {
        catalog.name = dto.name;
        // Update title if not set
        if (!catalog.title) {
          catalog.title = dto.name;
        }
      }

      if (dto.risk_statement !== undefined) {
        catalog.risk_statement = dto.risk_statement;
      }

      if (dto.root_cause !== undefined) {
        catalog.root_cause = dto.root_cause;
      }

      if (dto.description !== undefined) {
        catalog.description = dto.description;
      }

      if (dto.categoryCode !== undefined) {
        if (dto.categoryCode) {
          const category = await this.categoryRepo.findOne({
            where: {
              code: dto.categoryCode,
              ...tenantWhere(tenantId),
            },
          });
          if (!category) {
            throw new NotFoundException(`Risk category ${dto.categoryCode} not found`);
          }
          catalog.category_id = category.id;
        } else {
          catalog.category_id = undefined;
        }
      }

      if (dto.impact_areas !== undefined) {
        catalog.impact_areas = dto.impact_areas;
      }

      // Update inherent scores
      let shouldRecalcInherent = false;
      if (dto.default_inherent_likelihood !== undefined) {
        catalog.default_inherent_likelihood = dto.default_inherent_likelihood;
        shouldRecalcInherent = true;
      }

      if (dto.default_inherent_impact !== undefined) {
        catalog.default_inherent_impact = dto.default_inherent_impact;
        shouldRecalcInherent = true;
      }

      if (shouldRecalcInherent) {
        catalog.default_inherent_score =
          catalog.default_inherent_likelihood * catalog.default_inherent_impact;
        // Update backward compatibility fields
        catalog.default_likelihood = catalog.default_inherent_likelihood;
        catalog.default_impact = catalog.default_inherent_impact;
      }

      if (dto.tags !== undefined) {
        catalog.tags = dto.tags;
      }

      if (dto.owner_role !== undefined) {
        catalog.owner_role = dto.owner_role;
      }

      if (dto.entity_type !== undefined) {
        catalog.entity_type = dto.entity_type;
      }

      if (dto.entity_filter !== undefined) {
        catalog.entity_filter = dto.entity_filter;
      }

      const saved = (await this.riskCatalogRepo.save(catalog)) as RiskCatalogEntity;

      // Load with relations
      const withRelations = await this.riskCatalogRepo.findOne({
        where: { id: saved.id },
        relations: ['category'],
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
        'Error updating risk catalog:',
        error?.message || error,
      );
      throw new Error(
        `Failed to update risk catalog: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async createClause(
    tenantId: string,
    standardCode: string,
    dto: CreateClauseDto,
  ) {
    try {
      // Find standard
      const standard = await this.standardRepo.findOne({
        where: {
          code: standardCode,
          ...tenantWhere(tenantId),
        },
      });

      if (!standard) {
        throw new NotFoundException(`Standard ${standardCode} not found`);
      }

      // Check for duplicate clause_code within standard+tenant
      const existing = await this.clauseRepo.findOne({
        where: {
          standard_id: standard.id,
          clause_code: dto.clause_code,
          ...tenantWhere(tenantId),
        },
      });

      if (existing) {
        throw new ConflictException(
          `Clause with code ${dto.clause_code} already exists in standard ${standardCode}`,
        );
      }

      // Resolve parent clause if parent_clause_code provided
      let parentId: string | undefined;
      if (dto.parent_clause_code) {
        const parent = await this.clauseRepo.findOne({
          where: {
            standard_id: standard.id,
            clause_code: dto.parent_clause_code,
            ...tenantWhere(tenantId),
          },
        });

        if (!parent) {
          throw new NotFoundException(
            `Parent clause with code ${dto.parent_clause_code} not found`,
          );
        }

        parentId = parent.id;
      }

      const clause = this.clauseRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        standard_id: standard.id,
        clause_code: dto.clause_code,
        title: dto.title,
        text: dto.text,
        parent_id: parentId,
        synthetic: dto.synthetic !== undefined ? dto.synthetic : true,
        path: `${standardCode}:${dto.clause_code}`,
      });

      const saved = await this.clauseRepo.save(clause);

      return saved;
    } catch (error: any) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error('Error creating clause:', error?.message || error);
      throw new Error(
        `Failed to create clause: ${error?.message || 'Unknown error'}`,
      );
    }
  }
}
