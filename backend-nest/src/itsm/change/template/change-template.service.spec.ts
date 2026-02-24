import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ChangeTemplateService } from './change-template.service';
import { ItsmChangeTemplate } from './change-template.entity';
import { ItsmChangeTemplateTask } from './change-template-task.entity';
import { ItsmChangeTemplateDependency } from './change-template-dependency.entity';
import { ItsmChangeTask, ChangeTaskStatus, ChangeTaskType } from '../task/change-task.entity';
import { ItsmChangeTaskDependency } from '../task/change-task-dependency.entity';
import { ItsmChange } from '../change.entity';

describe('ChangeTemplateService', () => {
  let service: ChangeTemplateService;
  let templateRepo: jest.Mocked<Repository<ItsmChangeTemplate>>;
  let templateTaskRepo: jest.Mocked<Repository<ItsmChangeTemplateTask>>;
  let templateDepRepo: jest.Mocked<Repository<ItsmChangeTemplateDependency>>;
  let taskRepo: jest.Mocked<Repository<ItsmChangeTask>>;
  let taskDepRepo: jest.Mocked<Repository<ItsmChangeTaskDependency>>;
  let changeRepo: jest.Mocked<Repository<ItsmChange>>;

  const TENANT = '00000000-0000-0000-0000-000000000001';
  const USER = '00000000-0000-0000-0000-000000000002';
  const TEMPLATE_ID = '00000000-0000-0000-0000-000000000030';
  const CHANGE_ID = '00000000-0000-0000-0000-000000000010';

  const makeTemplate = (overrides: Partial<ItsmChangeTemplate> = {}): ItsmChangeTemplate =>
    ({
      id: TEMPLATE_ID,
      tenantId: TENANT,
      name: 'Standard Deploy',
      code: 'STD_DEPLOY',
      description: 'Standard deployment template',
      isActive: true,
      isGlobal: false,
      version: 1,
      isDeleted: false,
      createdBy: USER,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as ItsmChangeTemplate;

  const makeTemplateTask = (key: string, title: string, overrides = {}): ItsmChangeTemplateTask =>
    ({
      id: `tt-${key}`,
      tenantId: TENANT,
      templateId: TEMPLATE_ID,
      taskKey: key,
      title,
      description: null,
      taskType: ChangeTaskType.OTHER,
      defaultAssignmentGroupId: null,
      defaultAssigneeId: null,
      defaultStatus: ChangeTaskStatus.OPEN,
      defaultPriority: 'MEDIUM',
      estimatedDurationMinutes: null,
      sequenceOrder: 0,
      isBlocking: true,
      sortOrder: 0,
      stageLabel: null,
      isDeleted: false,
      createdAt: new Date(),
      ...overrides,
    }) as ItsmChangeTemplateTask;

  const makeTemplateDep = (pred: string, succ: string): ItsmChangeTemplateDependency =>
    ({
      id: `td-${pred}-${succ}`,
      tenantId: TENANT,
      templateId: TEMPLATE_ID,
      predecessorTaskKey: pred,
      successorTaskKey: succ,
    }) as ItsmChangeTemplateDependency;

  beforeEach(async () => {
    const mockTemplateRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const mockTemplateTaskRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const mockTemplateDepRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const mockTaskRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    };
    const mockTaskDepRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };
    const mockChangeRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeTemplateService,
        { provide: getRepositoryToken(ItsmChangeTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(ItsmChangeTemplateTask), useValue: mockTemplateTaskRepo },
        { provide: getRepositoryToken(ItsmChangeTemplateDependency), useValue: mockTemplateDepRepo },
        { provide: getRepositoryToken(ItsmChangeTask), useValue: mockTaskRepo },
        { provide: getRepositoryToken(ItsmChangeTaskDependency), useValue: mockTaskDepRepo },
        { provide: getRepositoryToken(ItsmChange), useValue: mockChangeRepo },
      ],
    }).compile();

    service = module.get<ChangeTemplateService>(ChangeTemplateService);
    templateRepo = module.get(getRepositoryToken(ItsmChangeTemplate));
    templateTaskRepo = module.get(getRepositoryToken(ItsmChangeTemplateTask));
    templateDepRepo = module.get(getRepositoryToken(ItsmChangeTemplateDependency));
    taskRepo = module.get(getRepositoryToken(ItsmChangeTask));
    taskDepRepo = module.get(getRepositoryToken(ItsmChangeTaskDependency));
    changeRepo = module.get(getRepositoryToken(ItsmChange));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---- TEMPLATE CRUD ----
  describe('createTemplate', () => {
    it('should create a template with tasks and dependencies', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      templateRepo.create.mockImplementation((d) => d as ItsmChangeTemplate);
      templateRepo.save.mockImplementation(async (e) => ({ ...e, id: TEMPLATE_ID }) as ItsmChangeTemplate);
      templateTaskRepo.create.mockImplementation((d) => d as ItsmChangeTemplateTask);
      templateTaskRepo.save.mockImplementation(async (arr: any) => arr);
      templateDepRepo.create.mockImplementation((d) => d as ItsmChangeTemplateDependency);
      templateDepRepo.save.mockImplementation(async (arr: any) => arr);

      const result = await service.createTemplate(TENANT, USER, {
        name: 'Standard Deploy',
        code: 'STD_DEPLOY',
        tasks: [
          { taskKey: 'pre_check', title: 'Pre-Check', taskType: ChangeTaskType.PRE_CHECK },
          { taskKey: 'implement', title: 'Implement', taskType: ChangeTaskType.IMPLEMENTATION },
        ],
        dependencies: [
          { predecessorTaskKey: 'pre_check', successorTaskKey: 'implement' },
        ],
      });

      expect(result).toBeDefined();
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT, name: 'Standard Deploy', code: 'STD_DEPLOY' }),
      );
      expect(templateTaskRepo.save).toHaveBeenCalled();
      expect(templateDepRepo.save).toHaveBeenCalled();
    });

    it('should reject duplicate template code', async () => {
      templateRepo.findOne.mockResolvedValue(makeTemplate());

      await expect(
        service.createTemplate(TENANT, USER, { name: 'Another', code: 'STD_DEPLOY' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject duplicate task keys', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      templateRepo.create.mockImplementation((d) => d as ItsmChangeTemplate);
      templateRepo.save.mockImplementation(async (e) => ({ ...e, id: TEMPLATE_ID }) as ItsmChangeTemplate);

      await expect(
        service.createTemplate(TENANT, USER, {
          name: 'Bad',
          code: 'BAD',
          tasks: [
            { taskKey: 'dup', title: 'Task 1' },
            { taskKey: 'dup', title: 'Task 2' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject self-dependency in template', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      templateRepo.create.mockImplementation((d) => d as ItsmChangeTemplate);
      templateRepo.save.mockImplementation(async (e) => ({ ...e, id: TEMPLATE_ID }) as ItsmChangeTemplate);
      templateTaskRepo.create.mockImplementation((d) => d as ItsmChangeTemplateTask);
      templateTaskRepo.save.mockImplementation(async (arr: any) => arr);

      await expect(
        service.createTemplate(TENANT, USER, {
          name: 'Self Dep',
          code: 'SELF_DEP',
          tasks: [{ taskKey: 'a', title: 'Task A' }],
          dependencies: [{ predecessorTaskKey: 'a', successorTaskKey: 'a' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject dependency cycle in template (A->B->C->A)', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      templateRepo.create.mockImplementation((d) => d as ItsmChangeTemplate);
      templateRepo.save.mockImplementation(async (e) => ({ ...e, id: TEMPLATE_ID }) as ItsmChangeTemplate);
      templateTaskRepo.create.mockImplementation((d) => d as ItsmChangeTemplateTask);
      templateTaskRepo.save.mockImplementation(async (arr: any) => arr);

      await expect(
        service.createTemplate(TENANT, USER, {
          name: 'Cycle',
          code: 'CYCLE',
          tasks: [
            { taskKey: 'a', title: 'A' },
            { taskKey: 'b', title: 'B' },
            { taskKey: 'c', title: 'C' },
          ],
          dependencies: [
            { predecessorTaskKey: 'a', successorTaskKey: 'b' },
            { predecessorTaskKey: 'b', successorTaskKey: 'c' },
            { predecessorTaskKey: 'c', successorTaskKey: 'a' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject dependency referencing unknown task key', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      templateRepo.create.mockImplementation((d) => d as ItsmChangeTemplate);
      templateRepo.save.mockImplementation(async (e) => ({ ...e, id: TEMPLATE_ID }) as ItsmChangeTemplate);
      templateTaskRepo.create.mockImplementation((d) => d as ItsmChangeTemplateTask);
      templateTaskRepo.save.mockImplementation(async (arr: any) => arr);

      await expect(
        service.createTemplate(TENANT, USER, {
          name: 'Bad Ref',
          code: 'BAD_REF',
          tasks: [{ taskKey: 'a', title: 'A' }],
          dependencies: [{ predecessorTaskKey: 'a', successorTaskKey: 'nonexistent' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findTemplateById', () => {
    it('should return template with tasks and dependencies', async () => {
      templateRepo.findOne.mockResolvedValue(makeTemplate());
      const tasks = [makeTemplateTask('pre_check', 'Pre-Check'), makeTemplateTask('implement', 'Implement')];
      templateTaskRepo.find.mockResolvedValue(tasks);
      const deps = [makeTemplateDep('pre_check', 'implement')];
      templateDepRepo.find.mockResolvedValue(deps);

      const result = await service.findTemplateById(TENANT, TEMPLATE_ID);

      expect(result).toBeDefined();
      expect(result!.tasks).toHaveLength(2);
      expect(result!.dependencies).toHaveLength(1);
    });

    it('should return null when template not found', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      const result = await service.findTemplateById(TENANT, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('findTemplates', () => {
    it('should return paginated templates', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([makeTemplate()]),
      };
      templateRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      const result = await service.findTemplates(TENANT, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by isActive', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };
      templateRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      await service.findTemplates(TENANT, 1, 20, undefined, true);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tmpl.isActive = :isActive',
        { isActive: true },
      );
    });
  });

  describe('updateTemplate', () => {
    it('should update template header fields and increment version', async () => {
      const existing = makeTemplate({ version: 1 });
      templateRepo.findOne.mockResolvedValue(existing);
      templateRepo.save.mockImplementation(async (e) => e as ItsmChangeTemplate);

      const result = await service.updateTemplate(TENANT, USER, TEMPLATE_ID, {
        name: 'Updated Name',
        description: 'Updated desc',
      });

      expect(result).toBeDefined();
      expect(result!.name).toBe('Updated Name');
      expect(result!.version).toBe(2);
      expect(result!.updatedBy).toBe(USER);
    });

    it('should return null when template not found', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      const result = await service.updateTemplate(TENANT, USER, 'non-existent', { name: 'X' });
      expect(result).toBeNull();
    });
  });

  describe('softDeleteTemplate', () => {
    it('should soft delete template', async () => {
      const existing = makeTemplate();
      templateRepo.findOne.mockResolvedValue(existing);
      templateRepo.save.mockImplementation(async (e) => e as ItsmChangeTemplate);

      const result = await service.softDeleteTemplate(TENANT, USER, TEMPLATE_ID);

      expect(result).toBe(true);
      expect(existing.isDeleted).toBe(true);
    });

    it('should return false when template not found', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      const result = await service.softDeleteTemplate(TENANT, USER, 'non-existent');
      expect(result).toBe(false);
    });
  });

  // ---- TEMPLATE APPLICATION ----
  describe('applyTemplateToChange', () => {
    const setupApplyMocks = () => {
      changeRepo.findOne.mockResolvedValue({ id: CHANGE_ID, tenantId: TENANT, isDeleted: false } as ItsmChange);
      templateRepo.findOne.mockResolvedValue(makeTemplate());
      templateTaskRepo.find.mockResolvedValue([
        makeTemplateTask('pre_check', 'Pre-Check', { taskType: ChangeTaskType.PRE_CHECK, sortOrder: 0, sequenceOrder: 0 }),
        makeTemplateTask('implement', 'Implement', { taskType: ChangeTaskType.IMPLEMENTATION, sortOrder: 1, sequenceOrder: 1 }),
        makeTemplateTask('validate', 'Validate', { taskType: ChangeTaskType.VALIDATION, sortOrder: 2, sequenceOrder: 2 }),
      ]);
      templateDepRepo.find.mockResolvedValue([
        makeTemplateDep('pre_check', 'implement'),
        makeTemplateDep('implement', 'validate'),
      ]);
      taskRepo.find.mockResolvedValue([]);
      taskRepo.count.mockResolvedValue(0);
      let taskCounter = 0;
      taskRepo.create.mockImplementation((d) => d as ItsmChangeTask);
      taskRepo.save.mockImplementation(async (e) => {
        taskCounter++;
        return { ...e, id: `created-task-${taskCounter}` } as ItsmChangeTask;
      });
      taskDepRepo.findOne.mockResolvedValue(null);
      taskDepRepo.create.mockImplementation((d) => d as ItsmChangeTaskDependency);
      taskDepRepo.save.mockImplementation(async (d) => d as ItsmChangeTaskDependency);
    };

    it('should create expected number of tasks and dependencies', async () => {
      setupApplyMocks();

      const result = await service.applyTemplateToChange(TENANT, USER, CHANGE_ID, TEMPLATE_ID);

      expect(result.tasksCreated).toBe(3);
      expect(result.dependenciesCreated).toBe(2);
      expect(result.skipped).toEqual([]);
      expect(result.conflicts).toEqual([]);
      expect(result.templateId).toBe(TEMPLATE_ID);
      expect(result.changeId).toBe(CHANGE_ID);
    });

    it('should populate traceability fields (autoGenerated, sourceTemplateId, templateTaskKey)', async () => {
      setupApplyMocks();

      await service.applyTemplateToChange(TENANT, USER, CHANGE_ID, TEMPLATE_ID);

      const createCalls = taskRepo.create.mock.calls;
      expect(createCalls.length).toBe(3);
      for (const [taskData] of createCalls) {
        expect(taskData).toMatchObject({
          autoGenerated: true,
          sourceTemplateId: TEMPLATE_ID,
        });
        expect(taskData.templateTaskKey).toBeDefined();
      }
      expect(createCalls[0][0].templateTaskKey).toBe('pre_check');
      expect(createCalls[1][0].templateTaskKey).toBe('implement');
      expect(createCalls[2][0].templateTaskKey).toBe('validate');
    });

    it('should generate correct task numbers', async () => {
      setupApplyMocks();

      await service.applyTemplateToChange(TENANT, USER, CHANGE_ID, TEMPLATE_ID);

      const createCalls = taskRepo.create.mock.calls;
      expect(createCalls[0][0].number).toBe('CTASK00001');
      expect(createCalls[1][0].number).toBe('CTASK00002');
      expect(createCalls[2][0].number).toBe('CTASK00003');
    });

    it('should reject when change not found', async () => {
      changeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyTemplateToChange(TENANT, USER, 'non-existent', TEMPLATE_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when template not found', async () => {
      changeRepo.findOne.mockResolvedValue({ id: CHANGE_ID, tenantId: TENANT, isDeleted: false } as ItsmChange);
      templateRepo.findOne.mockResolvedValue(null);
      templateTaskRepo.find.mockResolvedValue([]);
      templateDepRepo.find.mockResolvedValue([]);

      await expect(
        service.applyTemplateToChange(TENANT, USER, CHANGE_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when template is inactive', async () => {
      changeRepo.findOne.mockResolvedValue({ id: CHANGE_ID, tenantId: TENANT, isDeleted: false } as ItsmChange);
      templateRepo.findOne.mockResolvedValue(makeTemplate({ isActive: false }));
      templateTaskRepo.find.mockResolvedValue([]);
      templateDepRepo.find.mockResolvedValue([]);

      await expect(
        service.applyTemplateToChange(TENANT, USER, CHANGE_ID, TEMPLATE_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate application without force', async () => {
      changeRepo.findOne.mockResolvedValue({ id: CHANGE_ID, tenantId: TENANT, isDeleted: false } as ItsmChange);
      templateRepo.findOne.mockResolvedValue(makeTemplate());
      templateTaskRepo.find.mockResolvedValue([makeTemplateTask('pre_check', 'Pre-Check')]);
      templateDepRepo.find.mockResolvedValue([]);
      taskRepo.find.mockResolvedValue([
        { id: 'existing-1', sourceTemplateId: TEMPLATE_ID, templateTaskKey: 'pre_check' } as ItsmChangeTask,
      ]);

      await expect(
        service.applyTemplateToChange(TENANT, USER, CHANGE_ID, TEMPLATE_ID, false),
      ).rejects.toThrow(ConflictException);
    });

    it('should skip existing tasks on force re-apply', async () => {
      changeRepo.findOne.mockResolvedValue({ id: CHANGE_ID, tenantId: TENANT, isDeleted: false } as ItsmChange);
      templateRepo.findOne.mockResolvedValue(makeTemplate());
      templateTaskRepo.find.mockResolvedValue([
        makeTemplateTask('pre_check', 'Pre-Check', { sortOrder: 0, sequenceOrder: 0 }),
        makeTemplateTask('implement', 'Implement', { sortOrder: 1, sequenceOrder: 1 }),
      ]);
      templateDepRepo.find.mockResolvedValue([makeTemplateDep('pre_check', 'implement')]);
      taskRepo.find.mockResolvedValue([]);
      taskRepo.findOne
        .mockResolvedValueOnce({ id: 'existing-pre', templateTaskKey: 'pre_check' } as ItsmChangeTask)
        .mockResolvedValueOnce(null);
      taskRepo.count.mockResolvedValue(1);
      taskRepo.create.mockImplementation((d) => d as ItsmChangeTask);
      taskRepo.save.mockImplementation(async (e) => ({ ...e, id: 'new-impl' }) as ItsmChangeTask);
      taskDepRepo.findOne.mockResolvedValue(null);
      taskDepRepo.create.mockImplementation((d) => d as ItsmChangeTaskDependency);
      taskDepRepo.save.mockImplementation(async (d) => d as ItsmChangeTaskDependency);

      const result = await service.applyTemplateToChange(TENANT, USER, CHANGE_ID, TEMPLATE_ID, true);

      expect(result.tasksCreated).toBe(1);
      expect(result.skipped).toContain('pre_check');
    });

    it('should map template task keys to actual task IDs for dependency creation', async () => {
      setupApplyMocks();

      await service.applyTemplateToChange(TENANT, USER, CHANGE_ID, TEMPLATE_ID);

      expect(taskDepRepo.create).toHaveBeenCalledTimes(2);
      expect(taskDepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          predecessorTaskId: 'created-task-1',
          successorTaskId: 'created-task-2',
        }),
      );
      expect(taskDepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          predecessorTaskId: 'created-task-2',
          successorTaskId: 'created-task-3',
        }),
      );
    });
  });
});
