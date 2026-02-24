import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItsmChangeTask, ChangeTaskStatus } from './change-task.entity';
import { ItsmChangeTaskDependency } from './change-task-dependency.entity';
import { ItsmChange } from '../change.entity';
import {
  ChangeTaskFilterDto,
  CHANGE_TASK_SORTABLE_FIELDS,
} from './dto/change-task-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';

/** Statuses that count as "completed" for predecessor readiness checks */
const COMPLETED_STATUSES: ChangeTaskStatus[] = [
  ChangeTaskStatus.COMPLETED,
  ChangeTaskStatus.SKIPPED,
];

/** Statuses that represent a terminal state (no further transitions) */
const TERMINAL_STATUSES: ChangeTaskStatus[] = [
  ChangeTaskStatus.COMPLETED,
  ChangeTaskStatus.FAILED,
  ChangeTaskStatus.SKIPPED,
  ChangeTaskStatus.CANCELLED,
];

/** Valid status transitions map */
const VALID_TRANSITIONS: Record<ChangeTaskStatus, ChangeTaskStatus[]> = {
  [ChangeTaskStatus.DRAFT]: [ChangeTaskStatus.OPEN, ChangeTaskStatus.CANCELLED],
  [ChangeTaskStatus.OPEN]: [
    ChangeTaskStatus.IN_PROGRESS,
    ChangeTaskStatus.SKIPPED,
    ChangeTaskStatus.CANCELLED,
  ],
  [ChangeTaskStatus.IN_PROGRESS]: [
    ChangeTaskStatus.COMPLETED,
    ChangeTaskStatus.FAILED,
    ChangeTaskStatus.PENDING,
    ChangeTaskStatus.CANCELLED,
  ],
  [ChangeTaskStatus.PENDING]: [
    ChangeTaskStatus.IN_PROGRESS,
    ChangeTaskStatus.CANCELLED,
  ],
  [ChangeTaskStatus.COMPLETED]: [],
  [ChangeTaskStatus.FAILED]: [ChangeTaskStatus.OPEN, ChangeTaskStatus.CANCELLED],
  [ChangeTaskStatus.SKIPPED]: [],
  [ChangeTaskStatus.CANCELLED]: [],
};

export interface TaskReadiness {
  taskId: string;
  isReady: boolean;
  blockingPredecessors: string[];
  completedPredecessors: string[];
  totalPredecessors: number;
}

export interface ChangeTaskSummary {
  total: number;
  draft: number;
  open: number;
  inProgress: number;
  pending: number;
  completed: number;
  failed: number;
  skipped: number;
  cancelled: number;
  ready: number;
  blocked: number;
}

@Injectable()
export class ChangeTaskService {
  constructor(
    @InjectRepository(ItsmChangeTask)
    private readonly taskRepo: Repository<ItsmChangeTask>,
    @InjectRepository(ItsmChangeTaskDependency)
    private readonly depRepo: Repository<ItsmChangeTaskDependency>,
    @InjectRepository(ItsmChange)
    private readonly changeRepo: Repository<ItsmChange>,
  ) {}

  // ── Number generation ────────────────────────────────────────────

  private async generateTaskNumber(
    tenantId: string,
    changeId: string,
  ): Promise<string> {
    const count = await this.taskRepo.count({
      where: { tenantId, changeId },
    });
    return `CTASK${String(count + 1).padStart(5, '0')}`;
  }

  // ── Dependency validation ────────────────────────────────────────

  /**
   * Validate that no self-dependency exists.
   */
  private assertNoSelfDependency(
    predecessorId: string,
    successorId: string,
  ): void {
    if (predecessorId === successorId) {
      throw new BadRequestException('A task cannot depend on itself');
    }
  }

  /**
   * Validate both tasks belong to the same change and tenant.
   */
  private async assertSameChangeAndTenant(
    tenantId: string,
    changeId: string,
    taskId: string,
    label: string,
  ): Promise<void> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, tenantId, changeId, isDeleted: false },
    });
    if (!task) {
      throw new NotFoundException(
        `${label} task ${taskId} not found in this change`,
      );
    }
  }

  /**
   * Detect cycles in the dependency graph using DFS.
   * Returns true if adding predecessorId -> successorId would create a cycle.
   */
  async wouldCreateCycle(
    tenantId: string,
    changeId: string,
    predecessorId: string,
    successorId: string,
  ): Promise<boolean> {
    // If successor can reach predecessor via existing edges, adding
    // predecessor -> successor would create a cycle.
    const visited = new Set<string>();
    const stack = [predecessorId];

    // Walk backwards from predecessor through existing edges
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === successorId) {
        return true; // cycle detected
      }
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all predecessors of current node
      const deps = await this.depRepo.find({
        where: { tenantId, changeId, successorTaskId: current },
      });
      for (const dep of deps) {
        stack.push(dep.predecessorTaskId);
      }
    }
    return false;
  }

  /**
   * Validate a dependency edge before creation.
   */
  async validateDependency(
    tenantId: string,
    changeId: string,
    predecessorId: string,
    successorId: string,
  ): Promise<void> {
    this.assertNoSelfDependency(predecessorId, successorId);

    await this.assertSameChangeAndTenant(
      tenantId,
      changeId,
      predecessorId,
      'Predecessor',
    );
    await this.assertSameChangeAndTenant(
      tenantId,
      changeId,
      successorId,
      'Successor',
    );

    // Check for duplicate
    const existing = await this.depRepo.findOne({
      where: { tenantId, predecessorTaskId: predecessorId, successorTaskId: successorId },
    });
    if (existing) {
      throw new ConflictException('This dependency already exists');
    }

    // Check for cycle
    const cycleDetected = await this.wouldCreateCycle(
      tenantId,
      changeId,
      predecessorId,
      successorId,
    );
    if (cycleDetected) {
      throw new BadRequestException(
        'Adding this dependency would create a cycle in the task graph',
      );
    }
  }

  // ── Readiness calculation ────────────────────────────────────────

  /**
   * Calculate readiness for a single task.
   */
  async calculateReadiness(
    tenantId: string,
    changeId: string,
    taskId: string,
  ): Promise<TaskReadiness> {
    const deps = await this.depRepo.find({
      where: { tenantId, changeId, successorTaskId: taskId },
    });

    if (deps.length === 0) {
      return {
        taskId,
        isReady: true,
        blockingPredecessors: [],
        completedPredecessors: [],
        totalPredecessors: 0,
      };
    }

    const predecessorIds = deps.map((d) => d.predecessorTaskId);
    const predecessors = await this.taskRepo
      .createQueryBuilder('t')
      .where('t.id IN (:...ids)', { ids: predecessorIds })
      .andWhere('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.isDeleted = false')
      .getMany();

    const blocking: string[] = [];
    const completed: string[] = [];

    for (const pred of predecessors) {
      if (COMPLETED_STATUSES.includes(pred.status)) {
        completed.push(pred.id);
      } else {
        blocking.push(pred.id);
      }
    }

    return {
      taskId,
      isReady: blocking.length === 0,
      blockingPredecessors: blocking,
      completedPredecessors: completed,
      totalPredecessors: predecessorIds.length,
    };
  }

  /**
   * Calculate readiness for all tasks in a change.
   */
  async calculateAllReadiness(
    tenantId: string,
    changeId: string,
  ): Promise<Map<string, TaskReadiness>> {
    const tasks = await this.taskRepo.find({
      where: { tenantId, changeId, isDeleted: false },
    });

    const allDeps = await this.depRepo.find({
      where: { tenantId, changeId },
    });

    // Build predecessor map: successorId -> predecessorIds
    const predMap = new Map<string, string[]>();
    for (const dep of allDeps) {
      const list = predMap.get(dep.successorTaskId) || [];
      list.push(dep.predecessorTaskId);
      predMap.set(dep.successorTaskId, list);
    }

    // Build task status map
    const statusMap = new Map<string, ChangeTaskStatus>();
    for (const t of tasks) {
      statusMap.set(t.id, t.status);
    }

    const result = new Map<string, TaskReadiness>();
    for (const task of tasks) {
      const predecessorIds = predMap.get(task.id) || [];
      const blocking: string[] = [];
      const completed: string[] = [];

      for (const pId of predecessorIds) {
        const pStatus = statusMap.get(pId);
        if (pStatus && COMPLETED_STATUSES.includes(pStatus)) {
          completed.push(pId);
        } else {
          blocking.push(pId);
        }
      }

      result.set(task.id, {
        taskId: task.id,
        isReady: blocking.length === 0,
        blockingPredecessors: blocking,
        completedPredecessors: completed,
        totalPredecessors: predecessorIds.length,
      });
    }

    return result;
  }

  // ── Status transition validation ─────────────────────────────────

  assertValidStatusTransition(
    current: ChangeTaskStatus,
    target: ChangeTaskStatus,
  ): void {
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed || !allowed.includes(target)) {
      throw new BadRequestException(
        `Invalid task status transition from ${current} to ${target}`,
      );
    }
  }

  // ── CRUD operations ──────────────────────────────────────────────

  async createTask(
    tenantId: string,
    userId: string,
    changeId: string,
    data: Partial<Omit<ItsmChangeTask, 'id' | 'tenantId' | 'changeId' | 'number'>>,
  ): Promise<ItsmChangeTask> {
    // Verify change exists
    const change = await this.changeRepo.findOne({
      where: { id: changeId, tenantId, isDeleted: false },
    });
    if (!change) {
      throw new NotFoundException(`Change ${changeId} not found`);
    }

    const number = await this.generateTaskNumber(tenantId, changeId);

    const task = this.taskRepo.create({
      ...data,
      tenantId,
      changeId,
      number,
      createdBy: userId,
      isDeleted: false,
    });

    return this.taskRepo.save(task);
  }

  async findTasksForChange(
    tenantId: string,
    changeId: string,
    filterDto: ChangeTaskFilterDto,
  ): Promise<PaginatedResponse<ItsmChangeTask & { readiness?: TaskReadiness }>> {
    const {
      page = 1,
      pageSize = 50,
      sortBy = 'sortOrder',
      sortOrder = 'ASC',
      status,
      taskType,
      assigneeId,
      assignmentGroupId,
      search,
    } = filterDto;

    const qb = this.taskRepo.createQueryBuilder('task');
    qb.where('task.tenantId = :tenantId', { tenantId });
    qb.andWhere('task.changeId = :changeId', { changeId });
    qb.andWhere('task.isDeleted = false');

    if (status) {
      qb.andWhere('task.status = :status', { status });
    }
    if (taskType) {
      qb.andWhere('task.taskType = :taskType', { taskType });
    }
    if (assigneeId) {
      qb.andWhere('task.assigneeId = :assigneeId', { assigneeId });
    }
    if (assignmentGroupId) {
      qb.andWhere('task.assignmentGroupId = :assignmentGroupId', {
        assignmentGroupId,
      });
    }
    if (search) {
      qb.andWhere(
        '(task.number ILIKE :search OR task.title ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = CHANGE_TASK_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'sortOrder';
    const validSortOrder =
      sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    qb.orderBy(`task.${validSortBy}`, validSortOrder);
    qb.addOrderBy('task.sequenceOrder', 'ASC', 'NULLS LAST');

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    // Enrich with readiness data
    const readinessMap = await this.calculateAllReadiness(tenantId, changeId);
    const enriched = items.map((item) => ({
      ...item,
      readiness: readinessMap.get(item.id) || {
        taskId: item.id,
        isReady: true,
        blockingPredecessors: [],
        completedPredecessors: [],
        totalPredecessors: 0,
      },
    }));

    return createPaginatedResponse(enriched, total, page, pageSize);
  }

  async findOneTask(
    tenantId: string,
    changeId: string,
    taskId: string,
  ): Promise<ItsmChangeTask | null> {
    return this.taskRepo.findOne({
      where: { id: taskId, tenantId, changeId, isDeleted: false },
    });
  }

  async updateTask(
    tenantId: string,
    userId: string,
    changeId: string,
    taskId: string,
    data: Partial<Omit<ItsmChangeTask, 'id' | 'tenantId' | 'changeId' | 'number'>>,
  ): Promise<ItsmChangeTask | null> {
    const existing = await this.findOneTask(tenantId, changeId, taskId);
    if (!existing) {
      return null;
    }

    // Validate status transition if status is being changed
    if (data.status && data.status !== existing.status) {
      this.assertValidStatusTransition(existing.status, data.status);

      // Check readiness for activating transitions
      if (
        data.status === ChangeTaskStatus.IN_PROGRESS &&
        existing.status === ChangeTaskStatus.OPEN
      ) {
        const readiness = await this.calculateReadiness(
          tenantId,
          changeId,
          taskId,
        );
        if (!readiness.isReady) {
          throw new ConflictException({
            statusCode: 409,
            message: `Task cannot start: ${readiness.blockingPredecessors.length} predecessor(s) not completed`,
            blockingPredecessors: readiness.blockingPredecessors,
          });
        }
      }

      // Auto-set timestamps
      if (data.status === ChangeTaskStatus.IN_PROGRESS && !existing.actualStartAt) {
        data.actualStartAt = new Date();
      }
      if (TERMINAL_STATUSES.includes(data.status) && !existing.actualEndAt) {
        data.actualEndAt = new Date();
      }
    }

    const updated = this.taskRepo.merge(existing, {
      ...data,
      updatedBy: userId,
    } as Partial<ItsmChangeTask>);

    return this.taskRepo.save(updated);
  }

  async softDeleteTask(
    tenantId: string,
    userId: string,
    changeId: string,
    taskId: string,
  ): Promise<boolean> {
    const existing = await this.findOneTask(tenantId, changeId, taskId);
    if (!existing) {
      return false;
    }

    // Remove dependencies involving this task
    await this.depRepo
      .createQueryBuilder()
      .delete()
      .where('tenantId = :tenantId', { tenantId })
      .andWhere(
        '(predecessorTaskId = :taskId OR successorTaskId = :taskId)',
        { taskId },
      )
      .execute();

    existing.isDeleted = true;
    existing.updatedBy = userId;
    await this.taskRepo.save(existing);
    return true;
  }

  // ── Dependency CRUD ──────────────────────────────────────────────

  async addDependency(
    tenantId: string,
    changeId: string,
    predecessorId: string,
    successorId: string,
  ): Promise<ItsmChangeTaskDependency> {
    await this.validateDependency(tenantId, changeId, predecessorId, successorId);

    const dep = this.depRepo.create({
      tenantId,
      changeId,
      predecessorTaskId: predecessorId,
      successorTaskId: successorId,
    });

    return this.depRepo.save(dep);
  }

  async removeDependency(
    tenantId: string,
    changeId: string,
    predecessorId: string,
    successorId: string,
  ): Promise<boolean> {
    const dep = await this.depRepo.findOne({
      where: {
        tenantId,
        changeId,
        predecessorTaskId: predecessorId,
        successorTaskId: successorId,
      },
    });
    if (!dep) {
      return false;
    }

    await this.depRepo.remove(dep);
    return true;
  }

  async getDependencies(
    tenantId: string,
    changeId: string,
  ): Promise<ItsmChangeTaskDependency[]> {
    return this.depRepo.find({
      where: { tenantId, changeId },
    });
  }

  // ── Summary ──────────────────────────────────────────────────────

  async getTaskSummary(
    tenantId: string,
    changeId: string,
  ): Promise<ChangeTaskSummary> {
    const tasks = await this.taskRepo.find({
      where: { tenantId, changeId, isDeleted: false },
    });

    const readinessMap = await this.calculateAllReadiness(tenantId, changeId);

    let ready = 0;
    let blocked = 0;
    for (const task of tasks) {
      const r = readinessMap.get(task.id);
      if (
        r &&
        !r.isReady &&
        !TERMINAL_STATUSES.includes(task.status) &&
        task.status !== ChangeTaskStatus.IN_PROGRESS
      ) {
        blocked++;
      } else if (
        r?.isReady &&
        (task.status === ChangeTaskStatus.OPEN ||
          task.status === ChangeTaskStatus.DRAFT)
      ) {
        ready++;
      }
    }

    return {
      total: tasks.length,
      draft: tasks.filter((t) => t.status === ChangeTaskStatus.DRAFT).length,
      open: tasks.filter((t) => t.status === ChangeTaskStatus.OPEN).length,
      inProgress: tasks.filter((t) => t.status === ChangeTaskStatus.IN_PROGRESS).length,
      pending: tasks.filter((t) => t.status === ChangeTaskStatus.PENDING).length,
      completed: tasks.filter((t) => t.status === ChangeTaskStatus.COMPLETED).length,
      failed: tasks.filter((t) => t.status === ChangeTaskStatus.FAILED).length,
      skipped: tasks.filter((t) => t.status === ChangeTaskStatus.SKIPPED).length,
      cancelled: tasks.filter((t) => t.status === ChangeTaskStatus.CANCELLED).length,
      ready,
      blocked,
    };
  }
}
