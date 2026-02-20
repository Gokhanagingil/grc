import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItsmApproval, ApprovalState } from './itsm-approval.entity';
import {
  ItsmChange,
  ChangeState,
  ChangeApprovalStatus,
} from '../change.entity';
import { RiskAssessment } from '../risk/risk-assessment.entity';
import { PolicyService, PolicyEvaluationSummary } from '../risk/policy.service';
import {
  ConflictDetectionService,
  ConflictResult,
} from '../calendar/conflict-detection.service';
import { EventBusService } from '../../../event-bus/event-bus.service';

export interface ApprovalGateResult {
  allowed: boolean;
  reason?: string;
  reasonCode?: string;
}

@Injectable()
export class ApprovalService {
  constructor(
    @InjectRepository(ItsmApproval)
    private readonly approvalRepo: Repository<ItsmApproval>,
    @InjectRepository(ItsmChange)
    private readonly changeRepo: Repository<ItsmChange>,
    @InjectRepository(RiskAssessment)
    private readonly riskRepo: Repository<RiskAssessment>,
    private readonly policyService: PolicyService,
    private readonly conflictDetectionService: ConflictDetectionService,
    private readonly eventBusService: EventBusService,
  ) {}

  async requestApproval(
    tenantId: string,
    userId: string,
    changeId: string,
    comment?: string,
  ): Promise<{ approvals: ItsmApproval[]; change: ItsmChange }> {
    const change = await this.changeRepo.findOne({
      where: { id: changeId, tenantId, isDeleted: false },
    });
    if (!change) {
      throw new NotFoundException(`Change ${changeId} not found`);
    }

    if (change.approvalStatus === ChangeApprovalStatus.APPROVED) {
      throw new ConflictException('Change is already approved');
    }

    if (
      change.state !== ChangeState.ASSESS &&
      change.state !== ChangeState.AUTHORIZE
    ) {
      throw new BadRequestException(
        `Cannot request approval in state ${change.state}. Change must be in ASSESS or AUTHORIZE state.`,
      );
    }

    const blockCheck = await this.checkFreezeAndConflictBlocks(
      tenantId,
      change,
    );
    if (!blockCheck.allowed) {
      throw new ConflictException({
        statusCode: 409,
        reasonCode: blockCheck.reasonCode,
        message: blockCheck.reason,
      });
    }

    await this.approvalRepo.update(
      {
        recordTable: 'itsm_changes',
        recordId: changeId,
        tenantId,
        state: ApprovalState.REQUESTED,
      },
      { state: ApprovalState.CANCELLED, updatedBy: userId },
    );

    const approvalRoles = await this.determineApproverRoles(tenantId, change);
    if (approvalRoles.length === 0) {
      throw new BadRequestException(
        'Policy does not require CAB approval for this change',
      );
    }

    const approvals: ItsmApproval[] = [];
    for (const role of approvalRoles) {
      const approval = this.approvalRepo.create({
        tenantId,
        recordTable: 'itsm_changes',
        recordId: changeId,
        state: ApprovalState.REQUESTED,
        approverRole: role,
        approverUserId: null,
        requestedBy: userId,
        comment: comment || null,
        createdBy: userId,
        isDeleted: false,
      });
      approvals.push(await this.approvalRepo.save(approval));
    }

    change.approvalStatus = ChangeApprovalStatus.REQUESTED;
    change.state = ChangeState.AUTHORIZE;
    change.updatedBy = userId;
    await this.changeRepo.save(change);

    await this.eventBusService.emit({
      tenantId,
      source: 'approval-service',
      eventName: 'itsm.change.approval_requested',
      tableName: 'itsm_changes',
      recordId: changeId,
      actorId: userId,
      payload: {
        change_number: change.number,
        change_title: change.title,
        risk_level: change.risk,
        planned_start_at: change.plannedStartAt
          ? change.plannedStartAt.toISOString()
          : null,
        planned_end_at: change.plannedEndAt
          ? change.plannedEndAt.toISOString()
          : null,
        requester_id: change.requesterId,
        assignee_id: change.assigneeId,
        approver_roles: approvalRoles,
        approvals_requested: approvals.length,
      },
    });

    return { approvals, change };
  }

  async approve(
    tenantId: string,
    userId: string,
    userRole: string,
    approvalId: string,
    comment?: string,
  ): Promise<{ approval: ItsmApproval; change: ItsmChange }> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, tenantId, isDeleted: false },
    });
    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }
    if (approval.state !== ApprovalState.REQUESTED) {
      throw new BadRequestException(`Approval is already ${approval.state}`);
    }

    this.assertCanDecideApproval(userRole, approval.approverRole || null);

    approval.state = ApprovalState.APPROVED;
    approval.approverUserId = userId;
    approval.decidedAt = new Date();
    approval.comment = comment || approval.comment;
    approval.updatedBy = userId;
    await this.approvalRepo.save(approval);

    const change = await this.updateChangeApprovalStatus(
      tenantId,
      userId,
      approval.recordId,
    );

    await this.eventBusService.emit({
      tenantId,
      source: 'approval-service',
      eventName: 'itsm.change.approved',
      tableName: 'itsm_changes',
      recordId: approval.recordId,
      actorId: userId,
      payload: {
        change_number: change.number,
        change_title: change.title,
        approval_id: approval.id,
        approver_role: userRole,
        approver_user_id: userId,
        requester_id: change.requesterId,
        assignee_id: change.assigneeId,
        comment: comment || null,
      },
    });

    return { approval, change };
  }

  async reject(
    tenantId: string,
    userId: string,
    userRole: string,
    approvalId: string,
    comment?: string,
  ): Promise<{ approval: ItsmApproval; change: ItsmChange }> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, tenantId, isDeleted: false },
    });
    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }
    if (approval.state !== ApprovalState.REQUESTED) {
      throw new BadRequestException(`Approval is already ${approval.state}`);
    }

    this.assertCanDecideApproval(userRole, approval.approverRole || null);

    approval.state = ApprovalState.REJECTED;
    approval.approverUserId = userId;
    approval.decidedAt = new Date();
    approval.comment = comment || approval.comment;
    approval.updatedBy = userId;
    await this.approvalRepo.save(approval);

    const change = await this.changeRepo.findOne({
      where: { id: approval.recordId, tenantId, isDeleted: false },
    });
    if (!change) {
      throw new NotFoundException('Change not found');
    }

    change.approvalStatus = ChangeApprovalStatus.REJECTED;
    change.state = ChangeState.ASSESS;
    change.updatedBy = userId;
    await this.changeRepo.save(change);

    await this.eventBusService.emit({
      tenantId,
      source: 'approval-service',
      eventName: 'itsm.change.rejected',
      tableName: 'itsm_changes',
      recordId: approval.recordId,
      actorId: userId,
      payload: {
        change_number: change.number,
        change_title: change.title,
        approval_id: approval.id,
        approver_role: userRole,
        approver_user_id: userId,
        requester_id: change.requesterId,
        assignee_id: change.assigneeId,
        comment: comment || null,
      },
    });

    return { approval, change };
  }

  async listApprovals(
    tenantId: string,
    changeId: string,
  ): Promise<ItsmApproval[]> {
    return this.approvalRepo.find({
      where: {
        tenantId,
        recordTable: 'itsm_changes',
        recordId: changeId,
        isDeleted: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async checkTransitionGate(
    tenantId: string,
    changeId: string,
    targetState: ChangeState,
  ): Promise<ApprovalGateResult> {
    if (targetState !== ChangeState.IMPLEMENT) {
      return { allowed: true };
    }

    const change = await this.changeRepo.findOne({
      where: { id: changeId, tenantId, isDeleted: false },
    });
    if (!change) {
      return {
        allowed: false,
        reason: 'Change not found',
        reasonCode: 'NOT_FOUND',
      };
    }

    const freezeCheck = await this.checkFreezeAndConflictBlocks(
      tenantId,
      change,
    );
    if (!freezeCheck.allowed) {
      return freezeCheck;
    }

    const policyResult = await this.evaluatePolicy(tenantId, change);
    const conflicts = await this.previewConflictsForChange(tenantId, change);
    const requireCab =
      policyResult.requireCABApproval ||
      this.hasSignificantConflicts(conflicts);

    if (requireCab && change.approvalStatus !== ChangeApprovalStatus.APPROVED) {
      return {
        allowed: false,
        reason:
          'CAB approval required before implementation. Current status: ' +
          change.approvalStatus,
        reasonCode: 'APPROVAL_REQUIRED',
      };
    }

    return { allowed: true };
  }

  private assertCanDecideApproval(
    userRole: string,
    requiredApproverRole: string | null,
  ): void {
    const allowedRoles = ['admin', 'manager'];
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        'Only admin or manager can approve/reject changes',
      );
    }

    if (
      requiredApproverRole &&
      userRole !== 'admin' &&
      userRole !== requiredApproverRole
    ) {
      throw new ForbiddenException(
        `Only users with role ${requiredApproverRole} (or admin) can decide this approval`,
      );
    }
  }

  private async checkFreezeAndConflictBlocks(
    tenantId: string,
    change: ItsmChange,
  ): Promise<ApprovalGateResult> {
    if (!change.plannedStartAt || !change.plannedEndAt) {
      return { allowed: true };
    }

    const policyResult = await this.evaluatePolicy(tenantId, change);
    if (!policyResult.blockDuringFreeze) {
      return { allowed: true };
    }

    const conflicts = await this.previewConflictsForChange(tenantId, change);
    const freezeConflict = conflicts.find(
      (c) => c.conflictType === 'FREEZE_WINDOW',
    );

    if (!freezeConflict) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: this.formatFreezeConflictReason(freezeConflict),
      reasonCode: 'FREEZE_WINDOW_BLOCK',
    };
  }

  private async evaluatePolicy(
    tenantId: string,
    change: ItsmChange,
  ): Promise<PolicyEvaluationSummary> {
    const assessment = await this.riskRepo.findOne({
      where: { tenantId, changeId: change.id, isDeleted: false },
      order: { computedAt: 'DESC' },
    });

    return this.policyService.evaluatePolicies(tenantId, change, assessment);
  }

  private async previewConflictsForChange(
    tenantId: string,
    change: ItsmChange,
  ): Promise<ConflictResult[]> {
    if (!change.plannedStartAt || !change.plannedEndAt) {
      return [];
    }

    return this.conflictDetectionService.previewConflicts(
      tenantId,
      change.plannedStartAt,
      change.plannedEndAt,
      change.id,
      change.serviceId || undefined,
    );
  }

  private hasSignificantConflicts(conflicts: ConflictResult[]): boolean {
    return conflicts.some(
      (c) => c.conflictType === 'OVERLAP' || c.conflictType === 'FREEZE_WINDOW',
    );
  }

  private formatFreezeConflictReason(conflict: ConflictResult): string {
    const freezeName =
      typeof conflict.details?.['freezeName'] === 'string'
        ? conflict.details['freezeName']
        : 'freeze window';

    const freezeStart =
      typeof conflict.details?.['freezeStart'] === 'string'
        ? conflict.details['freezeStart']
        : null;

    const freezeEnd =
      typeof conflict.details?.['freezeEnd'] === 'string'
        ? conflict.details['freezeEnd']
        : null;

    if (freezeStart && freezeEnd) {
      return `Change is blocked: planned window overlaps with freeze window "${freezeName}" (${freezeStart} - ${freezeEnd})`;
    }

    return `Change is blocked: planned window overlaps with freeze window "${freezeName}"`;
  }

  private async determineApproverRoles(
    tenantId: string,
    change: ItsmChange,
  ): Promise<string[]> {
    const policyResult = await this.evaluatePolicy(tenantId, change);
    const conflicts = await this.previewConflictsForChange(tenantId, change);

    const requireCab =
      policyResult.requireCABApproval ||
      this.hasSignificantConflicts(conflicts);

    return requireCab ? ['manager'] : [];
  }

  private async updateChangeApprovalStatus(
    tenantId: string,
    userId: string,
    changeId: string,
  ): Promise<ItsmChange> {
    const pendingCount = await this.approvalRepo.count({
      where: {
        tenantId,
        recordTable: 'itsm_changes',
        recordId: changeId,
        state: ApprovalState.REQUESTED,
        isDeleted: false,
      },
    });

    const change = await this.changeRepo.findOne({
      where: { id: changeId, tenantId, isDeleted: false },
    });
    if (!change) {
      throw new NotFoundException('Change not found');
    }

    if (pendingCount === 0) {
      const rejectedCount = await this.approvalRepo.count({
        where: {
          tenantId,
          recordTable: 'itsm_changes',
          recordId: changeId,
          state: ApprovalState.REJECTED,
          isDeleted: false,
        },
      });

      if (rejectedCount > 0) {
        change.approvalStatus = ChangeApprovalStatus.REJECTED;
        change.state = ChangeState.ASSESS;
      } else {
        change.approvalStatus = ChangeApprovalStatus.APPROVED;
      }
    }

    change.updatedBy = userId;
    return this.changeRepo.save(change);
  }
}
