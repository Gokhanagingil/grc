import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { GrcCapa, GrcCapaTask, GrcIssue, GrcStatusHistory } from '../entities';
import { CapaStatus, IssueStatus, CAPATaskStatus } from '../enums';
import {
  UpdateCapaStatusDto,
  UpdateIssueStatusDto,
} from '../dto/closure-loop.dto';

/**
 * Closure Loop Service
 *
 * Handles status transitions for CAPAs and Issues with cascade logic.
 * When all CAPA tasks are terminal (COMPLETED/CANCELLED), the CAPA is auto-closed.
 * When all CAPAs for an Issue are closed, the Issue is auto-closed.
 */
@Injectable()
export class ClosureLoopService {
  private readonly capaValidTransitions: Map<CapaStatus, CapaStatus[]> =
    new Map([
      [CapaStatus.PLANNED, [CapaStatus.IN_PROGRESS, CapaStatus.REJECTED]],
      [
        CapaStatus.IN_PROGRESS,
        [CapaStatus.IMPLEMENTED, CapaStatus.PLANNED, CapaStatus.REJECTED],
      ],
      [CapaStatus.IMPLEMENTED, [CapaStatus.VERIFIED, CapaStatus.IN_PROGRESS]],
      [CapaStatus.VERIFIED, [CapaStatus.CLOSED, CapaStatus.IMPLEMENTED]],
      [CapaStatus.CLOSED, [CapaStatus.IN_PROGRESS]],
      [CapaStatus.REJECTED, [CapaStatus.PLANNED]],
    ]);

  private readonly issueValidTransitions: Map<IssueStatus, IssueStatus[]> =
    new Map([
      [IssueStatus.OPEN, [IssueStatus.IN_PROGRESS, IssueStatus.REJECTED]],
      [
        IssueStatus.IN_PROGRESS,
        [IssueStatus.RESOLVED, IssueStatus.OPEN, IssueStatus.REJECTED],
      ],
      [IssueStatus.RESOLVED, [IssueStatus.CLOSED, IssueStatus.IN_PROGRESS]],
      [IssueStatus.CLOSED, [IssueStatus.IN_PROGRESS]],
      [IssueStatus.REJECTED, [IssueStatus.OPEN]],
    ]);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GrcCapa)
    private readonly capaRepository: Repository<GrcCapa>,
    @InjectRepository(GrcCapaTask)
    private readonly capaTaskRepository: Repository<GrcCapaTask>,
    @InjectRepository(GrcIssue)
    private readonly issueRepository: Repository<GrcIssue>,
    @InjectRepository(GrcStatusHistory)
    private readonly statusHistoryRepository: Repository<GrcStatusHistory>,
  ) {}

  /**
   * Update CAPA status with validation and history tracking
   *
   * Closure Loop Rules:
   * - CAPA cannot transition to CLOSED unless:
   *   1. All tasks are in terminal state (COMPLETED or CANCELLED)
   *   2. Verification fields are set (verifiedByUserId, verifiedAt)
   */
  async updateCapaStatus(
    tenantId: string,
    capaId: string,
    dto: UpdateCapaStatusDto,
    userId: string,
  ): Promise<GrcCapa> {
    const capa = await this.capaRepository.findOne({
      where: { id: capaId, tenantId, isDeleted: false },
      relations: ['issue', 'tasks'],
    });

    if (!capa) {
      throw new NotFoundException(`CAPA with ID ${capaId} not found`);
    }

    const previousStatus = capa.status;

    if (previousStatus === dto.status) {
      return capa;
    }

    this.validateCapaTransition(previousStatus, dto.status);

    // Closure Loop Rule: Validate CAPA closure requirements
    if (dto.status === CapaStatus.CLOSED) {
      await this.validateCapaClosureRequirements(tenantId, capaId, capa);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      capa.status = dto.status;
      capa.updatedBy = userId;

      if (dto.status === CapaStatus.CLOSED) {
        capa.closedAt = new Date();
        capa.closedByUserId = userId;
      }

      if (
        dto.status === CapaStatus.IN_PROGRESS &&
        previousStatus === CapaStatus.CLOSED
      ) {
        capa.closedAt = null;
        capa.closedByUserId = null;
      }

      await queryRunner.manager.save(capa);

      await this.createStatusHistory(
        queryRunner,
        tenantId,
        'CAPA',
        capaId,
        previousStatus,
        dto.status,
        userId,
        dto.reason ?? 'Manual status change',
        { source: 'MANUAL' },
      );

      if (dto.status === CapaStatus.CLOSED && capa.issueId) {
        await this.checkAndCascadeIssueClose(
          queryRunner,
          tenantId,
          capa.issueId,
          userId,
        );
      }

      await queryRunner.commitTransaction();

      return this.capaRepository.findOne({
        where: { id: capaId, tenantId },
        relations: ['owner', 'verifiedBy', 'closedBy', 'issue', 'tasks'],
      }) as Promise<GrcCapa>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update Issue status with validation and history tracking
   *
   * Closure Loop Rules:
   * - Issue cannot transition to CLOSED unless:
   *   1. All linked CAPAs are CLOSED, OR
   *   2. Explicit override with reason is provided (audit trail)
   */
  async updateIssueStatus(
    tenantId: string,
    issueId: string,
    dto: UpdateIssueStatusDto,
    userId: string,
  ): Promise<GrcIssue> {
    const issue = await this.issueRepository.findOne({
      where: { id: issueId, tenantId, isDeleted: false },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    const previousStatus = issue.status;

    if (previousStatus === dto.status) {
      return issue;
    }

    this.validateIssueTransition(previousStatus, dto.status);

    // Closure Loop Rule: Validate Issue closure requirements
    if (dto.status === IssueStatus.CLOSED) {
      await this.validateIssueClosureRequirements(
        tenantId,
        issueId,
        dto.overrideReason,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      issue.status = dto.status;
      issue.updatedBy = userId;

      if (dto.status === IssueStatus.CLOSED) {
        issue.closedAt = new Date();
        issue.closedByUserId = userId;
      }

      if (dto.status === IssueStatus.RESOLVED) {
        issue.resolvedDate = new Date();
      }

      if (
        dto.status === IssueStatus.IN_PROGRESS &&
        previousStatus === IssueStatus.CLOSED
      ) {
        issue.closedAt = null;
        issue.closedByUserId = null;
        issue.reopenedCount = (issue.reopenedCount || 0) + 1;
        issue.lastReopenedAt = new Date();
      }

      await queryRunner.manager.save(issue);

      await this.createStatusHistory(
        queryRunner,
        tenantId,
        'ISSUE',
        issueId,
        previousStatus,
        dto.status,
        userId,
        dto.reason ?? 'Manual status change',
        { source: 'MANUAL' },
      );

      await queryRunner.commitTransaction();

      return this.issueRepository.findOne({
        where: { id: issueId, tenantId },
        relations: [
          'owner',
          'raisedBy',
          'closedBy',
          'control',
          'risk',
          'audit',
          'capas',
        ],
      }) as Promise<GrcIssue>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Check if all CAPA tasks are terminal and cascade to CAPA if needed
   * Called after a CAPA task status change
   */
  async checkAndCascadeCapaClose(
    tenantId: string,
    capaId: string,
    userId: string,
  ): Promise<GrcCapa | null> {
    const tasks = await this.capaTaskRepository.find({
      where: { capaId, tenantId, isDeleted: false },
    });

    if (tasks.length === 0) {
      return null;
    }

    const allTerminal = tasks.every(
      (task) =>
        task.status === CAPATaskStatus.COMPLETED ||
        task.status === CAPATaskStatus.CANCELLED,
    );

    if (!allTerminal) {
      return null;
    }

    const capa = await this.capaRepository.findOne({
      where: { id: capaId, tenantId, isDeleted: false },
    });

    if (!capa || capa.status === CapaStatus.CLOSED) {
      return null;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const previousStatus = capa.status;
      capa.status = CapaStatus.CLOSED;
      capa.closedAt = new Date();
      capa.closedByUserId = userId;
      capa.updatedBy = userId;

      await queryRunner.manager.save(capa);

      await this.createStatusHistory(
        queryRunner,
        tenantId,
        'CAPA',
        capaId,
        previousStatus,
        CapaStatus.CLOSED,
        userId,
        'Auto-closed: all tasks completed',
        { source: 'SYSTEM' },
      );

      if (capa.issueId) {
        await this.checkAndCascadeIssueClose(
          queryRunner,
          tenantId,
          capa.issueId,
          userId,
        );
      }

      await queryRunner.commitTransaction();

      return this.capaRepository.findOne({
        where: { id: capaId, tenantId },
        relations: ['owner', 'verifiedBy', 'closedBy', 'issue', 'tasks'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Check if all CAPAs for an issue are closed and cascade to Issue if needed
   */
  private async checkAndCascadeIssueClose(
    queryRunner: import('typeorm').QueryRunner,
    tenantId: string,
    issueId: string,
    userId: string,
  ): Promise<void> {
    const capas = await queryRunner.manager.find(GrcCapa, {
      where: { issueId, tenantId, isDeleted: false },
    });

    if (capas.length === 0) {
      return;
    }

    const allClosed = capas.every((capa) => capa.status === CapaStatus.CLOSED);

    if (!allClosed) {
      return;
    }

    const issue = await queryRunner.manager.findOne(GrcIssue, {
      where: { id: issueId, tenantId, isDeleted: false },
    });

    if (!issue || issue.status === IssueStatus.CLOSED) {
      return;
    }

    const previousStatus = issue.status;
    issue.status = IssueStatus.CLOSED;
    issue.closedAt = new Date();
    issue.closedByUserId = userId;
    issue.updatedBy = userId;

    await queryRunner.manager.save(issue);

    await this.createStatusHistory(
      queryRunner,
      tenantId,
      'ISSUE',
      issueId,
      previousStatus,
      IssueStatus.CLOSED,
      userId,
      'Auto-closed: all CAPAs completed',
      { source: 'SYSTEM' },
    );
  }

  /**
   * Validate CAPA closure requirements
   *
   * Closure Loop Rule: CAPA cannot be closed unless:
   * 1. All tasks are in terminal state (COMPLETED or CANCELLED)
   * 2. Verification fields are set (verifiedByUserId, verifiedAt)
   */
  private async validateCapaClosureRequirements(
    tenantId: string,
    capaId: string,
    capa: GrcCapa,
  ): Promise<void> {
    const errors: string[] = [];

    // Check verification fields
    if (!capa.verifiedByUserId || !capa.verifiedAt) {
      errors.push(
        'CAPA must be verified before closing. Please set verification fields (verifiedBy, verifiedAt).',
      );
    }

    // Check all tasks are in terminal state
    const tasks = await this.capaTaskRepository.find({
      where: { capaId, tenantId, isDeleted: false },
    });

    if (tasks.length > 0) {
      const nonTerminalTasks = tasks.filter(
        (task) =>
          task.status !== CAPATaskStatus.COMPLETED &&
          task.status !== CAPATaskStatus.CANCELLED,
      );

      if (nonTerminalTasks.length > 0) {
        const taskTitles = nonTerminalTasks
          .map((t) => `"${t.title}" (${t.status})`)
          .join(', ');
        errors.push(
          `All CAPA tasks must be completed or cancelled before closing. ` +
            `Incomplete tasks: ${taskTitles}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Cannot close CAPA: closure requirements not met. ${errors.join(' ')}`,
      );
    }
  }

  /**
   * Validate Issue closure requirements
   *
   * Closure Loop Rule: Issue cannot be closed unless:
   * 1. All linked CAPAs are CLOSED, OR
   * 2. Explicit override with reason is provided
   */
  private async validateIssueClosureRequirements(
    tenantId: string,
    issueId: string,
    overrideReason?: string,
  ): Promise<void> {
    const capas = await this.capaRepository.find({
      where: { issueId, tenantId, isDeleted: false },
    });

    // If no CAPAs linked, allow closure
    if (capas.length === 0) {
      return;
    }

    const openCapas = capas.filter((capa) => capa.status !== CapaStatus.CLOSED);

    if (openCapas.length > 0) {
      // Check if override is provided
      if (overrideReason && overrideReason.trim().length > 0) {
        // Override allowed - will be recorded in audit trail
        return;
      }

      const capaList = openCapas
        .map((c) => `"${c.title}" (${c.status})`)
        .join(', ');
      throw new BadRequestException(
        `Cannot close Issue: not all CAPAs are closed. The following CAPAs are not closed: ${capaList}. Either close all CAPAs first, or provide an override reason.`,
      );
    }
  }

  private validateCapaTransition(
    currentStatus: CapaStatus,
    newStatus: CapaStatus,
  ): void {
    const allowedTransitions =
      this.capaValidTransitions.get(currentStatus) || [];

    if (!allowedTransitions.includes(newStatus)) {
      const allowedList =
        allowedTransitions.length > 0
          ? `[${allowedTransitions.join(', ')}]`
          : '[]';
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
          `Allowed next statuses from ${currentStatus}: ${allowedList}`,
      );
    }
  }

  private validateIssueTransition(
    currentStatus: IssueStatus,
    newStatus: IssueStatus,
  ): void {
    const allowedTransitions =
      this.issueValidTransitions.get(currentStatus) || [];

    if (!allowedTransitions.includes(newStatus)) {
      const allowedList =
        allowedTransitions.length > 0
          ? `[${allowedTransitions.join(', ')}]`
          : '[]';
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
          `Allowed next statuses from ${currentStatus}: ${allowedList}`,
      );
    }
  }

  private async createStatusHistory(
    queryRunner: import('typeorm').QueryRunner,
    tenantId: string,
    entityType: string,
    entityId: string,
    previousStatus: string | null,
    newStatus: string,
    userId: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const history = queryRunner.manager.create(GrcStatusHistory, {
      tenantId,
      entityType,
      entityId,
      previousStatus,
      newStatus,
      changedByUserId: userId,
      changeReason: reason,
      metadata,
    });

    await queryRunner.manager.save(history);
  }

  /**
   * Get valid transitions for CAPA status
   */
  getCapaValidTransitions(currentStatus: CapaStatus): CapaStatus[] {
    return this.capaValidTransitions.get(currentStatus) || [];
  }

  /**
   * Get valid transitions for Issue status
   */
  getIssueValidTransitions(currentStatus: IssueStatus): IssueStatus[] {
    return this.issueValidTransitions.get(currentStatus) || [];
  }
}
