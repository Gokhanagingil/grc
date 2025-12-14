import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { Standard } from '../entities/standard.entity';
import { StandardClause } from '../entities/standard-clause.entity';
import {
  AuditScopeStandard,
  ScopeType,
} from '../entities/audit-scope-standard.entity';
import {
  AuditScopeClause,
  ClauseScopeStatus,
} from '../entities/audit-scope-clause.entity';
import { GrcIssueClause } from '../entities/grc-issue-clause.entity';

export interface ClauseTreeNode {
  id: string;
  code: string;
  title: string;
  description: string | null;
  level: number;
  sortOrder: number;
  path: string | null;
  isAuditable: boolean;
  children: ClauseTreeNode[];
}

export interface StandardWithClauses extends Standard {
  clauseTree: ClauseTreeNode[];
}

@Injectable()
export class StandardsService extends MultiTenantServiceBase<Standard> {
  constructor(
    @InjectRepository(Standard)
    repository: Repository<Standard>,
    @InjectRepository(StandardClause)
    private readonly clauseRepository: Repository<StandardClause>,
    @InjectRepository(AuditScopeStandard)
    private readonly auditScopeStandardRepository: Repository<AuditScopeStandard>,
    @InjectRepository(AuditScopeClause)
    private readonly auditScopeClauseRepository: Repository<AuditScopeClause>,
    @InjectRepository(GrcIssueClause)
    private readonly issueClauseRepository: Repository<GrcIssueClause>,
  ) {
    super(repository);
  }

  async findAllActiveForTenant(
    tenantId: string,
    options?: {
      where?: FindOptionsWhere<Standard>;
      order?: Record<string, 'ASC' | 'DESC'>;
      relations?: string[];
    },
  ): Promise<Standard[]> {
    return this.repository.find({
      where: {
        ...(options?.where || {}),
        tenantId,
        isDeleted: false,
      },
      order: options?.order || { name: 'ASC' },
      relations: options?.relations,
    });
  }

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<Standard | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async createStandard(
    tenantId: string,
    userId: string,
    data: Omit<
      Partial<Standard>,
      'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
  ): Promise<Standard> {
    return this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
    });
  }

  async updateStandard(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<Standard, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<Standard | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    return this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });
  }

  async softDeleteStandard(
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
    } as Partial<Omit<Standard, 'id' | 'tenantId'>>);

    return true;
  }

  async getClausesFlat(
    tenantId: string,
    standardId: string,
  ): Promise<StandardClause[]> {
    const standard = await this.findOneActiveForTenant(tenantId, standardId);
    if (!standard) {
      throw new NotFoundException(`Standard with ID ${standardId} not found`);
    }

    return this.clauseRepository.find({
      where: { tenantId, standardId, isDeleted: false },
      order: { sortOrder: 'ASC', code: 'ASC' },
    });
  }

  async getClausesTree(
    tenantId: string,
    standardId: string,
  ): Promise<ClauseTreeNode[]> {
    const clauses = await this.getClausesFlat(tenantId, standardId);
    return this.buildClauseTree(clauses);
  }

  private buildClauseTree(clauses: StandardClause[]): ClauseTreeNode[] {
    const clauseMap = new Map<string, ClauseTreeNode>();
    const rootNodes: ClauseTreeNode[] = [];

    for (const clause of clauses) {
      clauseMap.set(clause.id, {
        id: clause.id,
        code: clause.code,
        title: clause.title,
        description: clause.description,
        level: clause.level,
        sortOrder: clause.sortOrder,
        path: clause.path,
        isAuditable: clause.isAuditable,
        children: [],
      });
    }

    for (const clause of clauses) {
      const node = clauseMap.get(clause.id)!;
      if (clause.parentId && clauseMap.has(clause.parentId)) {
        clauseMap.get(clause.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  async getClause(
    tenantId: string,
    clauseId: string,
  ): Promise<StandardClause | null> {
    return this.clauseRepository.findOne({
      where: { id: clauseId, tenantId, isDeleted: false },
      relations: ['standard'],
    });
  }

  async createClause(
    tenantId: string,
    userId: string,
    standardId: string,
    data: Omit<
      Partial<StandardClause>,
      'id' | 'tenantId' | 'standardId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
  ): Promise<StandardClause> {
    const standard = await this.findOneActiveForTenant(tenantId, standardId);
    if (!standard) {
      throw new NotFoundException(`Standard with ID ${standardId} not found`);
    }

    const clause = this.clauseRepository.create({
      ...data,
      tenantId,
      standardId,
      createdBy: userId,
      isDeleted: false,
    });

    return this.clauseRepository.save(clause);
  }

  async updateClause(
    tenantId: string,
    userId: string,
    clauseId: string,
    data: Partial<Omit<StandardClause, 'id' | 'tenantId' | 'standardId' | 'isDeleted'>>,
  ): Promise<StandardClause | null> {
    const existing = await this.clauseRepository.findOne({
      where: { id: clauseId, tenantId, isDeleted: false },
    });
    if (!existing) {
      return null;
    }

    const updated = this.clauseRepository.merge(existing, {
      ...data,
      updatedBy: userId,
    });
    return this.clauseRepository.save(updated);
  }

  async getAuditScope(
    tenantId: string,
    auditId: string,
  ): Promise<{
    standards: AuditScopeStandard[];
    clauses: AuditScopeClause[];
    isLocked: boolean;
  }> {
    const standards = await this.auditScopeStandardRepository.find({
      where: { tenantId, auditId },
      relations: ['standard'],
      order: { createdAt: 'ASC' },
    });

    const clauses = await this.auditScopeClauseRepository.find({
      where: { tenantId, auditId },
      relations: ['clause', 'clause.standard'],
      order: { createdAt: 'ASC' },
    });

    const isLocked = standards.some((s) => s.isLocked);

    return { standards, clauses, isLocked };
  }

  async setAuditScope(
    tenantId: string,
    userId: string,
    auditId: string,
    standardIds: string[],
    clauseIds?: string[],
  ): Promise<{
    standards: AuditScopeStandard[];
    clauses: AuditScopeClause[];
  }> {
    const existingScope = await this.getAuditScope(tenantId, auditId);
    if (existingScope.isLocked) {
      throw new Error('Audit scope is locked and cannot be modified');
    }

    await this.auditScopeStandardRepository.delete({ tenantId, auditId });
    await this.auditScopeClauseRepository.delete({ tenantId, auditId });

    const standards: AuditScopeStandard[] = [];
    for (const standardId of standardIds) {
      const standard = await this.findOneActiveForTenant(tenantId, standardId);
      if (!standard) {
        throw new NotFoundException(`Standard with ID ${standardId} not found`);
      }

      const scopeType =
        clauseIds && clauseIds.length > 0 ? ScopeType.PARTIAL : ScopeType.FULL;

      const scopeStandard = this.auditScopeStandardRepository.create({
        tenantId,
        auditId,
        standardId,
        scopeType,
        isLocked: false,
      });
      standards.push(await this.auditScopeStandardRepository.save(scopeStandard));
    }

    const clauses: AuditScopeClause[] = [];
    if (clauseIds && clauseIds.length > 0) {
      for (const clauseId of clauseIds) {
        const clause = await this.getClause(tenantId, clauseId);
        if (!clause) {
          throw new NotFoundException(`Clause with ID ${clauseId} not found`);
        }

        const scopeClause = this.auditScopeClauseRepository.create({
          tenantId,
          auditId,
          clauseId,
          status: ClauseScopeStatus.NOT_STARTED,
          isLocked: false,
        });
        clauses.push(await this.auditScopeClauseRepository.save(scopeClause));
      }
    }

    return { standards, clauses };
  }

  async lockAuditScope(
    tenantId: string,
    userId: string,
    auditId: string,
  ): Promise<boolean> {
    const now = new Date();

    await this.auditScopeStandardRepository.update(
      { tenantId, auditId },
      { isLocked: true, lockedAt: now, lockedBy: userId },
    );

    await this.auditScopeClauseRepository.update(
      { tenantId, auditId },
      { isLocked: true },
    );

    return true;
  }

  async getClauseFindings(
    tenantId: string,
    auditId: string,
    clauseId: string,
  ): Promise<GrcIssueClause[]> {
    return this.issueClauseRepository.find({
      where: { tenantId, clauseId },
      relations: ['issue', 'issue.owner'],
    });
  }

  async linkFindingToClause(
    tenantId: string,
    issueId: string,
    clauseId: string,
    notes?: string,
  ): Promise<GrcIssueClause> {
    const clause = await this.getClause(tenantId, clauseId);
    if (!clause) {
      throw new NotFoundException(`Clause with ID ${clauseId} not found`);
    }

    const existing = await this.issueClauseRepository.findOne({
      where: { tenantId, issueId, clauseId },
    });
    if (existing) {
      return existing;
    }

    const issueClause = this.issueClauseRepository.create({
      tenantId,
      issueId,
      clauseId,
      notes,
    });

    return this.issueClauseRepository.save(issueClause);
  }

  async unlinkFindingFromClause(
    tenantId: string,
    issueId: string,
    clauseId: string,
  ): Promise<boolean> {
    const result = await this.issueClauseRepository.delete({
      tenantId,
      issueId,
      clauseId,
    });
    return (result.affected ?? 0) > 0;
  }

  async getStandardWithClauseTree(
    tenantId: string,
    standardId: string,
  ): Promise<StandardWithClauses | null> {
    const standard = await this.findOneActiveForTenant(tenantId, standardId);
    if (!standard) {
      return null;
    }

    const clauseTree = await this.getClausesTree(tenantId, standardId);

    return {
      ...standard,
      clauseTree,
    };
  }

  async getSummary(tenantId: string): Promise<{
    totalStandards: number;
    totalClauses: number;
    byDomain: Record<string, number>;
    activeStandards: number;
  }> {
    const standards = await this.findAllActiveForTenant(tenantId);

    const totalClauses = await this.clauseRepository.count({
      where: { tenantId, isDeleted: false },
    });

    const byDomain: Record<string, number> = {};
    let activeStandards = 0;

    for (const standard of standards) {
      if (standard.domain) {
        byDomain[standard.domain] = (byDomain[standard.domain] || 0) + 1;
      }
      if (standard.isActive) {
        activeStandards++;
      }
    }

    return {
      totalStandards: standards.length,
      totalClauses,
      byDomain,
      activeStandards,
    };
  }
}
