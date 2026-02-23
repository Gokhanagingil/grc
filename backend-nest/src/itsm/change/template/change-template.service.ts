import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItsmChangeTemplate } from './change-template.entity';
import { ItsmChangeTemplateTask } from './change-template-task.entity';
import { ItsmChangeTemplateDependency } from './change-template-dependency.entity';
import { ItsmChangeTask, ChangeTaskStatus } from '../task/change-task.entity';
import { ItsmChangeTaskDependency } from '../task/change-task-dependency.entity';
import { ItsmChange } from '../change.entity';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import {
  TemplateTaskDefinitionDto,
  TemplateDependencyDefinitionDto,
} from './dto/create-change-template.dto';

export interface TemplateApplyResult {
  templateId: string;
  templateName: string;
  changeId: string;
  tasksCreated: number;
  dependenciesCreated: number;
  skipped: string[];
  conflicts: string[];
}

@Injectable()
export class ChangeTemplateService {
  constructor(
    @InjectRepository(ItsmChangeTemplate)
    private readonly templateRepo: Repository<ItsmChangeTemplate>,
    @InjectRepository(ItsmChangeTemplateTask)
    private readonly templateTaskRepo: Repository<ItsmChangeTemplateTask>,
    @InjectRepository(ItsmChangeTemplateDependency)
    private readonly templateDepRepo: Repository<ItsmChangeTemplateDependency>,
    @InjectRepository(ItsmChangeTask)
    private readonly taskRepo: Repository<ItsmChangeTask>,
    @InjectRepository(ItsmChangeTaskDependency)
    private readonly taskDepRepo: Repository<ItsmChangeTaskDependency>,
    @InjectRepository(ItsmChange)
    private readonly changeRepo: Repository<ItsmChange>,
  ) {}

  // ── Template CRUD ────────────────────────────────────────────────

  async createTemplate(
    tenantId: string,
    userId: string,
    data: {
      name: string;
      code: string;
      description?: string;
      isActive?: boolean;
      isGlobal?: boolean;
      tasks?: TemplateTaskDefinitionDto[];
      dependencies?: TemplateDependencyDefinitionDto[];
    },
  ): Promise<ItsmChangeTemplate & { tasks: ItsmChangeTemplateTask[]; dependencies: ItsmChangeTemplateDependency[] }> {
    // Check code uniqueness
    const existing = await this.templateRepo.findOne({
      where: { tenantId, code: data.code, isDeleted: false },
    });
    if (existing) {
      throw new ConflictException(
        `Template with code "${data.code}" already exists`,
      );
    }

    const template = this.templateRepo.create({
      tenantId,
      name: data.name,
      code: data.code,
      description: data.description || null,
      isActive: data.isActive ?? true,
      isGlobal: data.isGlobal ?? false,
      createdBy: userId,
      isDeleted: false,
    });

    const savedTemplate = await this.templateRepo.save(template);

    // Save template tasks
    let savedTasks: ItsmChangeTemplateTask[] = [];
    if (data.tasks && data.tasks.length > 0) {
      // Validate unique task keys
      const keys = data.tasks.map((t) => t.taskKey);
      if (new Set(keys).size !== keys.length) {
        throw new BadRequestException('Template task keys must be unique');
      }

      const taskEntities: ItsmChangeTemplateTask[] = [];
      for (let idx = 0; idx < data.tasks.length; idx++) {
        const t = data.tasks[idx];
        const entity = this.templateTaskRepo.create({
          tenantId,
          templateId: savedTemplate.id,
          taskKey: t.taskKey,
          title: t.title,
          description: t.description || null,
          taskType: t.taskType || 'OTHER',
          defaultAssignmentGroupId: t.defaultAssignmentGroupId || null,
          defaultAssigneeId: t.defaultAssigneeId || null,
          defaultStatus: t.defaultStatus || ChangeTaskStatus.OPEN,
          defaultPriority: t.defaultPriority || 'MEDIUM',
          estimatedDurationMinutes: t.estimatedDurationMinutes ?? null,
          sequenceOrder: t.sequenceOrder ?? idx,
          isBlocking: t.isBlocking ?? true,
          sortOrder: t.sortOrder ?? idx,
          stageLabel: t.stageLabel || null,
          createdBy: userId,
          isDeleted: false,
        } as Partial<ItsmChangeTemplateTask>);
        taskEntities.push(entity);
      }
      savedTasks = await this.templateTaskRepo.save(taskEntities);
    }

    // Save template dependencies
    let savedDeps: ItsmChangeTemplateDependency[] = [];
    if (data.dependencies && data.dependencies.length > 0) {
      const taskKeySet = new Set(
        (data.tasks || []).map((t) => t.taskKey),
      );

      for (const dep of data.dependencies) {
        if (!taskKeySet.has(dep.predecessorTaskKey)) {
          throw new BadRequestException(
            `Dependency predecessor key "${dep.predecessorTaskKey}" not found in template tasks`,
          );
        }
        if (!taskKeySet.has(dep.successorTaskKey)) {
          throw new BadRequestException(
            `Dependency successor key "${dep.successorTaskKey}" not found in template tasks`,
          );
        }
        if (dep.predecessorTaskKey === dep.successorTaskKey) {
          throw new BadRequestException(
            `Self-dependency not allowed: "${dep.predecessorTaskKey}"`,
          );
        }
      }

      // Validate no cycles in template dependencies
      this.validateTemplateDependencyCycles(
        data.dependencies,
        (data.tasks || []).map((t) => t.taskKey),
      );

      const depEntities = data.dependencies.map((d) =>
        this.templateDepRepo.create({
          tenantId,
          templateId: savedTemplate.id,
          predecessorTaskKey: d.predecessorTaskKey,
          successorTaskKey: d.successorTaskKey,
        }),
      );
      savedDeps = await this.templateDepRepo.save(depEntities);
    }

    return {
      ...savedTemplate,
      tasks: savedTasks,
      dependencies: savedDeps,
    };
  }

  private validateTemplateDependencyCycles(
    deps: TemplateDependencyDefinitionDto[],
    taskKeys: string[],
  ): void {
    // Build adjacency list
    const adj = new Map<string, string[]>();
    for (const key of taskKeys) {
      adj.set(key, []);
    }
    for (const dep of deps) {
      const list = adj.get(dep.predecessorTaskKey) || [];
      list.push(dep.successorTaskKey);
      adj.set(dep.predecessorTaskKey, list);
    }

    // Topological sort / cycle detection using DFS
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const key of taskKeys) {
      color.set(key, WHITE);
    }

    const hasCycle = (node: string): boolean => {
      color.set(node, GRAY);
      for (const neighbor of adj.get(node) || []) {
        if (color.get(neighbor) === GRAY) return true;
        if (color.get(neighbor) === WHITE && hasCycle(neighbor)) return true;
      }
      color.set(node, BLACK);
      return false;
    };

    for (const key of taskKeys) {
      if (color.get(key) === WHITE && hasCycle(key)) {
        throw new BadRequestException(
          'Template dependencies contain a cycle',
        );
      }
    }
  }

  async findTemplates(
    tenantId: string,
    page = 1,
    pageSize = 20,
    search?: string,
    isActive?: boolean,
  ): Promise<PaginatedResponse<ItsmChangeTemplate>> {
    const qb = this.templateRepo.createQueryBuilder('tmpl');
    qb.where('tmpl.tenantId = :tenantId', { tenantId });
    qb.andWhere('tmpl.isDeleted = false');

    if (isActive !== undefined) {
      qb.andWhere('tmpl.isActive = :isActive', { isActive });
    }

    if (search) {
      qb.andWhere(
        '(tmpl.name ILIKE :search OR tmpl.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();
    qb.orderBy('tmpl.name', 'ASC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findTemplateById(
    tenantId: string,
    id: string,
  ): Promise<
    | (ItsmChangeTemplate & {
        tasks: ItsmChangeTemplateTask[];
        dependencies: ItsmChangeTemplateDependency[];
      })
    | null
  > {
    const template = await this.templateRepo.findOne({
      where: { id, tenantId, isDeleted: false },
    });
    if (!template) return null;

    const tasks = await this.templateTaskRepo.find({
      where: { tenantId, templateId: id, isDeleted: false },
      order: { sortOrder: 'ASC', sequenceOrder: 'ASC' },
    });

    const dependencies = await this.templateDepRepo.find({
      where: { tenantId, templateId: id },
    });

    return { ...template, tasks, dependencies };
  }

  async updateTemplate(
    tenantId: string,
    userId: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      isGlobal?: boolean;
      tasks?: TemplateTaskDefinitionDto[];
      dependencies?: TemplateDependencyDefinitionDto[];
    },
  ): Promise<ItsmChangeTemplate | null> {
    const existing = await this.templateRepo.findOne({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) return null;

    // Update header fields
    if (data.name !== undefined) existing.name = data.name;
    if (data.description !== undefined) existing.description = data.description;
    if (data.isActive !== undefined) existing.isActive = data.isActive;
    if (data.isGlobal !== undefined) existing.isGlobal = data.isGlobal;
    existing.updatedBy = userId;
    existing.version = existing.version + 1;

    const saved = await this.templateRepo.save(existing);

    // Replace tasks if provided
    if (data.tasks !== undefined) {
      // Remove old tasks
      await this.templateTaskRepo
        .createQueryBuilder()
        .delete()
        .where('templateId = :templateId', { templateId: id })
        .andWhere('tenantId = :tenantId', { tenantId })
        .execute();

      if (data.tasks.length > 0) {
        const keys = data.tasks.map((t) => t.taskKey);
        if (new Set(keys).size !== keys.length) {
          throw new BadRequestException('Template task keys must be unique');
        }

        const taskEntities: ItsmChangeTemplateTask[] = [];
        for (let idx = 0; idx < data.tasks.length; idx++) {
          const t = data.tasks[idx];
          const entity = this.templateTaskRepo.create({
            tenantId,
            templateId: id,
            taskKey: t.taskKey,
            title: t.title,
            description: t.description || null,
            taskType: t.taskType || 'OTHER',
            defaultAssignmentGroupId: t.defaultAssignmentGroupId || null,
            defaultAssigneeId: t.defaultAssigneeId || null,
            defaultStatus: t.defaultStatus || ChangeTaskStatus.OPEN,
            defaultPriority: t.defaultPriority || 'MEDIUM',
            estimatedDurationMinutes: t.estimatedDurationMinutes ?? null,
            sequenceOrder: t.sequenceOrder ?? idx,
            isBlocking: t.isBlocking ?? true,
            sortOrder: t.sortOrder ?? idx,
            stageLabel: t.stageLabel || null,
            createdBy: userId,
            isDeleted: false,
          } as Partial<ItsmChangeTemplateTask>);
          taskEntities.push(entity);
        }
        await this.templateTaskRepo.save(taskEntities);
      }
    }

    // Replace dependencies if provided
    if (data.dependencies !== undefined) {
      await this.templateDepRepo
        .createQueryBuilder()
        .delete()
        .where('templateId = :templateId', { templateId: id })
        .andWhere('tenantId = :tenantId', { tenantId })
        .execute();

      if (data.dependencies.length > 0) {
        const taskKeySet = new Set(
          (data.tasks || []).map((t) => t.taskKey),
        );

        for (const dep of data.dependencies) {
          if (dep.predecessorTaskKey === dep.successorTaskKey) {
            throw new BadRequestException(
              `Self-dependency not allowed: "${dep.predecessorTaskKey}"`,
            );
          }
        }

        if (data.tasks) {
          this.validateTemplateDependencyCycles(
            data.dependencies,
            data.tasks.map((t) => t.taskKey),
          );
        }

        const depEntities = data.dependencies.map((d) =>
          this.templateDepRepo.create({
            tenantId,
            templateId: id,
            predecessorTaskKey: d.predecessorTaskKey,
            successorTaskKey: d.successorTaskKey,
          }),
        );
        await this.templateDepRepo.save(depEntities);
      }
    }

    return saved;
  }

  async softDeleteTemplate(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.templateRepo.findOne({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) return false;

    existing.isDeleted = true;
    existing.updatedBy = userId;
    await this.templateRepo.save(existing);
    return true;
  }

  // ── Template Application ─────────────────────────────────────────

  async applyTemplateToChange(
    tenantId: string,
    userId: string,
    changeId: string,
    templateId: string,
    force = false,
  ): Promise<TemplateApplyResult> {
    // Validate change
    const change = await this.changeRepo.findOne({
      where: { id: changeId, tenantId, isDeleted: false },
    });
    if (!change) {
      throw new NotFoundException(`Change ${changeId} not found`);
    }

    // Validate template
    const template = await this.findTemplateById(tenantId, templateId);
    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }
    if (!template.isActive) {
      throw new BadRequestException('Template is not active');
    }

    // Check for duplicate application
    if (!force) {
      const existingTasks = await this.taskRepo.find({
        where: {
          tenantId,
          changeId,
          sourceTemplateId: templateId,
          isDeleted: false,
        },
      });
      if (existingTasks.length > 0) {
        throw new ConflictException({
          statusCode: 409,
          message: `Template "${template.name}" has already been applied to this change. Use force=true to re-apply.`,
          existingTaskCount: existingTasks.length,
        });
      }
    }

    // Generate tasks from template
    const taskKeyToIdMap = new Map<string, string>();
    const skipped: string[] = [];
    const conflicts: string[] = [];
    let tasksCreated = 0;

    // Get current task count for numbering
    const currentCount = await this.taskRepo.count({
      where: { tenantId, changeId },
    });

    for (let i = 0; i < template.tasks.length; i++) {
      const tmplTask = template.tasks[i];

      // If force re-apply, check for existing task with same template key
      if (force) {
        const existingByKey = await this.taskRepo.findOne({
          where: {
            tenantId,
            changeId,
            sourceTemplateId: templateId,
            templateTaskKey: tmplTask.taskKey,
            isDeleted: false,
          },
        });
        if (existingByKey) {
          taskKeyToIdMap.set(tmplTask.taskKey, existingByKey.id);
          skipped.push(tmplTask.taskKey);
          continue;
        }
      }

      const number = `CTASK${String(currentCount + tasksCreated + 1).padStart(5, '0')}`;

      const task = this.taskRepo.create({
        tenantId,
        changeId,
        number,
        title: tmplTask.title,
        description: tmplTask.description || null,
        status: tmplTask.defaultStatus || ChangeTaskStatus.OPEN,
        taskType: tmplTask.taskType || 'OTHER',
        assignmentGroupId: tmplTask.defaultAssignmentGroupId || null,
        assigneeId: tmplTask.defaultAssigneeId || null,
        priority: tmplTask.defaultPriority || 'MEDIUM',
        sequenceOrder: tmplTask.sequenceOrder ?? i,
        isBlocking: tmplTask.isBlocking ?? true,
        autoGenerated: true,
        sourceTemplateId: templateId,
        templateTaskKey: tmplTask.taskKey,
        sortOrder: tmplTask.sortOrder ?? i,
        stageLabel: tmplTask.stageLabel || null,
        estimatedDurationMinutes: tmplTask.estimatedDurationMinutes ?? null,
        createdBy: userId,
        isDeleted: false,
      });

      const savedTask = await this.taskRepo.save(task);
      taskKeyToIdMap.set(tmplTask.taskKey, savedTask.id);
      tasksCreated++;
    }

    // Create dependencies
    let depsCreated = 0;
    for (const tmplDep of template.dependencies) {
      const predId = taskKeyToIdMap.get(tmplDep.predecessorTaskKey);
      const succId = taskKeyToIdMap.get(tmplDep.successorTaskKey);

      if (!predId || !succId) {
        conflicts.push(
          `Dependency ${tmplDep.predecessorTaskKey} -> ${tmplDep.successorTaskKey}: task(s) not found`,
        );
        continue;
      }

      // Check duplicate
      const existingDep = await this.taskDepRepo.findOne({
        where: {
          tenantId,
          predecessorTaskId: predId,
          successorTaskId: succId,
        },
      });
      if (existingDep) {
        continue; // already exists, skip silently
      }

      const dep = this.taskDepRepo.create({
        tenantId,
        changeId,
        predecessorTaskId: predId,
        successorTaskId: succId,
      });
      await this.taskDepRepo.save(dep);
      depsCreated++;
    }

    return {
      templateId,
      templateName: template.name,
      changeId,
      tasksCreated,
      dependenciesCreated: depsCreated,
      skipped,
      conflicts,
    };
  }
}
