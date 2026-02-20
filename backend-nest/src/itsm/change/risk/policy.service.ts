import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangePolicy, PolicyConditions, PolicyActions } from './change-policy.entity';
import { ItsmChange, ChangeType } from '../change.entity';
import { RiskAssessment, RiskLevel } from './risk-assessment.entity';
import {
  PolicyFilterDto,
  POLICY_SORTABLE_FIELDS,
} from './dto/policy-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';

export interface PolicyEvaluationResult {
  policyId: string;
  policyName: string;
  matched: boolean;
  actionsTriggered: PolicyActions;
}

export interface PolicyEvaluationSummary {
  requireCABApproval: boolean;
  blockDuringFreeze: boolean;
  minLeadTimeHours: number | null;
  autoApproveIfRiskBelow: number | null;
  matchedPolicies: PolicyEvaluationResult[];
}

@Injectable()
export class PolicyService {
  constructor(
    @Optional()
    @InjectRepository(ChangePolicy)
    private readonly policyRepo?: Repository<ChangePolicy>,
  ) {}

  async findAll(
    tenantId: string,
    filterDto: PolicyFilterDto,
  ): Promise<PaginatedResponse<ChangePolicy>> {
    if (!this.policyRepo) {
      return createPaginatedResponse([], 0, 1, 20);
    }

    const {
      page = 1,
      pageSize = 20,
      sortBy = 'priority',
      sortOrder = 'ASC',
      isActive,
      search,
      q,
    } = filterDto;

    const qb = this.policyRepo.createQueryBuilder('policy');
    qb.where('policy.tenantId = :tenantId', { tenantId });
    qb.andWhere('policy.isDeleted = :isDeleted', { isDeleted: false });

    if (isActive !== undefined) {
      qb.andWhere('policy.isActive = :isActive', { isActive });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere(
        '(policy.name ILIKE :search OR policy.description ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = POLICY_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'priority';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`policy.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findOne(
    tenantId: string,
    id: string,
  ): Promise<ChangePolicy | null> {
    if (!this.policyRepo) return null;
    return this.policyRepo.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async create(
    tenantId: string,
    userId: string,
    data: Partial<Omit<ChangePolicy, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'>>,
  ): Promise<ChangePolicy | null> {
    if (!this.policyRepo) return null;
    const policy = this.policyRepo.create({
      ...data,
      tenantId,
      createdBy: userId,
      isDeleted: false,
    });
    return this.policyRepo.save(policy);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<ChangePolicy, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<ChangePolicy | null> {
    if (!this.policyRepo) return null;
    const existing = await this.findOne(tenantId, id);
    if (!existing) return null;

    Object.assign(existing, { ...data, updatedBy: userId });
    return this.policyRepo.save(existing);
  }

  async softDelete(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    if (!this.policyRepo) return false;
    const existing = await this.findOne(tenantId, id);
    if (!existing) return false;

    existing.isDeleted = true;
    existing.updatedBy = userId;
    await this.policyRepo.save(existing);
    return true;
  }

  async evaluatePolicies(
    tenantId: string,
    change: ItsmChange,
    assessment: RiskAssessment | null,
  ): Promise<PolicyEvaluationSummary> {
    const summary: PolicyEvaluationSummary = {
      requireCABApproval: false,
      blockDuringFreeze: false,
      minLeadTimeHours: null,
      autoApproveIfRiskBelow: null,
      matchedPolicies: [],
    };

    if (!this.policyRepo) return summary;

    const policies = await this.policyRepo.find({
      where: { tenantId, isActive: true, isDeleted: false },
      order: { priority: 'ASC' },
    });

    for (const policy of policies) {
      const matched = this.matchConditions(policy.conditions, change, assessment);

      if (matched) {
        const result: PolicyEvaluationResult = {
          policyId: policy.id,
          policyName: policy.name,
          matched: true,
          actionsTriggered: policy.actions,
        };
        summary.matchedPolicies.push(result);

        if (policy.actions.requireCABApproval) {
          summary.requireCABApproval = true;
        }
        if (policy.actions.blockDuringFreeze) {
          summary.blockDuringFreeze = true;
        }
        if (
          policy.actions.minLeadTimeHours !== undefined &&
          (summary.minLeadTimeHours === null ||
            policy.actions.minLeadTimeHours > summary.minLeadTimeHours)
        ) {
          summary.minLeadTimeHours = policy.actions.minLeadTimeHours;
        }
        if (
          policy.actions.autoApproveIfRiskBelow !== undefined &&
          (summary.autoApproveIfRiskBelow === null ||
            policy.actions.autoApproveIfRiskBelow < summary.autoApproveIfRiskBelow)
        ) {
          summary.autoApproveIfRiskBelow = policy.actions.autoApproveIfRiskBelow;
        }
      }
    }

    return summary;
  }

  private matchConditions(
    conditions: PolicyConditions,
    change: ItsmChange,
    assessment: RiskAssessment | null,
  ): boolean {
    if (
      conditions.changeType &&
      conditions.changeType.length > 0 &&
      !conditions.changeType.includes(change.type)
    ) {
      return false;
    }

    if (conditions.riskLevelMin && assessment) {
      const levelOrder: Record<string, number> = {
        LOW: 0,
        MEDIUM: 1,
        HIGH: 2,
        CRITICAL: 3,
      };
      const minLevel = levelOrder[conditions.riskLevelMin] ?? 0;
      const currentLevel = levelOrder[assessment.riskLevel] ?? 0;
      if (currentLevel < minLevel) return false;
    }

    if (conditions.hasFreezeConflict !== undefined && assessment) {
      if (conditions.hasFreezeConflict !== assessment.hasFreezeConflict) {
        return false;
      }
    }

    if (conditions.riskScoreMin !== undefined && assessment) {
      if (assessment.riskScore < conditions.riskScoreMin) return false;
    }

    if (conditions.riskScoreMax !== undefined && assessment) {
      if (assessment.riskScore > conditions.riskScoreMax) return false;
    }

    if (conditions.minLeadTimeHours !== undefined && change.plannedStartAt && change.createdAt) {
      const leadTimeMs =
        new Date(change.plannedStartAt).getTime() -
        new Date(change.createdAt).getTime();
      const leadTimeHours = leadTimeMs / (1000 * 60 * 60);
      if (leadTimeHours >= conditions.minLeadTimeHours) return false;
    }

    return true;
  }
}
