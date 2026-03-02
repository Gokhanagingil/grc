import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TodoTask, TodoBoard, TodoBoardColumn, TodoTag, TodoTaskTag } from './entities';
import {
  CreateTodoTaskDto,
  UpdateTodoTaskDto,
  CreateTodoBoardDto,
  UpdateTodoBoardDto,
  BoardColumnDto,
  MoveTaskDto,
  CreateTodoTagDto,
  UpdateTodoTagDto,
} from './dto';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(TodoTask)
    private readonly taskRepo: Repository<TodoTask>,
    @InjectRepository(TodoBoard)
    private readonly boardRepo: Repository<TodoBoard>,
    @InjectRepository(TodoBoardColumn)
    private readonly columnRepo: Repository<TodoBoardColumn>,
    @InjectRepository(TodoTag)
    private readonly tagRepo: Repository<TodoTag>,
    @InjectRepository(TodoTaskTag)
    private readonly taskTagRepo: Repository<TodoTaskTag>,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Tasks                                                               */
  /* ------------------------------------------------------------------ */

  async listTasks(
    tenantId: string,
    filters: {
      boardId?: string;
      status?: string;
      assigneeUserId?: string;
      ownerGroupId?: string;
      priority?: string;
      category?: string;
      tagIds?: string[];
      dueDateFrom?: string;
      dueDateTo?: string;
      search?: string;
      sort?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize =
      filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;

    const qb = this.taskRepo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.is_deleted = false');

    if (filters.boardId) {
      qb.andWhere('t.board_id = :boardId', { boardId: filters.boardId });
    }
    if (filters.status) {
      qb.andWhere('t.status = :status', { status: filters.status });
    }
    if (filters.assigneeUserId) {
      qb.andWhere('t.assignee_user_id = :assignee', {
        assignee: filters.assigneeUserId,
      });
    }
    if (filters.ownerGroupId) {
      qb.andWhere('t.owner_group_id = :ownerGroup', {
        ownerGroup: filters.ownerGroupId,
      });
    }
    if (filters.priority) {
      qb.andWhere('t.priority = :priority', { priority: filters.priority });
    }
    if (filters.category) {
      qb.andWhere('t.category = :category', { category: filters.category });
    }
    if (filters.dueDateFrom) {
      qb.andWhere('t.due_date >= :dueDateFrom', {
        dueDateFrom: filters.dueDateFrom,
      });
    }
    if (filters.dueDateTo) {
      qb.andWhere('t.due_date <= :dueDateTo', {
        dueDateTo: filters.dueDateTo,
      });
    }
    if (filters.search) {
      qb.andWhere('(t.title ILIKE :search OR t.description ILIKE :search)', {
        search: `%${filters.search}%`,
      });
    }
    if (filters.tagIds && filters.tagIds.length > 0) {
      qb.andWhere(
        `t.id IN (SELECT tt.task_id FROM todo_task_tags tt WHERE tt.tag_id IN (:...tagIds) AND tt.tenant_id = :tenantId)`,
        { tagIds: filters.tagIds, tenantId },
      );
    }

    // Sorting
    const allowedSorts: Record<string, string> = {
      createdAt: 't.created_at',
      dueDate: 't.due_date',
      priority: 't.priority',
      title: 't.title',
      updatedAt: 't.updated_at',
      sortOrder: 't.sort_order',
    };
    if (filters.sort) {
      const desc = filters.sort.startsWith('-');
      const field = desc ? filters.sort.slice(1) : filters.sort;
      const col = allowedSorts[field];
      if (col) {
        qb.orderBy(col, desc ? 'DESC' : 'ASC');
      } else {
        qb.orderBy('t.created_at', 'DESC');
      }
    } else {
      qb.orderBy('t.created_at', 'DESC');
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    // Attach tags for each task
    if (items.length > 0) {
      const taskIds = items.map((t) => t.id);
      const taskTags = await this.taskTagRepo.find({
        where: { taskId: In(taskIds), tenantId },
        relations: ['tag'],
      });

      const tagsByTaskId = new Map<string, TodoTag[]>();
      for (const tt of taskTags) {
        if (tt.tag && !tt.tag.isDeleted) {
          const arr = tagsByTaskId.get(tt.taskId) || [];
          arr.push(tt.tag);
          tagsByTaskId.set(tt.taskId, arr);
        }
      }

      for (const item of items) {
        (item as TodoTask & { taskTags: TodoTag[] }).taskTags =
          tagsByTaskId.get(item.id) || [];
      }
    }

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getTask(tenantId: string, taskId: string): Promise<TodoTask & { taskTags?: TodoTag[] }> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, tenantId, isDeleted: false },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Attach tags
    const taskTags = await this.taskTagRepo.find({
      where: { taskId, tenantId },
      relations: ['tag'],
    });
    (task as TodoTask & { taskTags: TodoTag[] }).taskTags = taskTags
      .filter((tt) => tt.tag && !tt.tag.isDeleted)
      .map((tt) => tt.tag);

    return task;
  }

  async createTask(
    tenantId: string,
    userId: string,
    dto: CreateTodoTaskDto,
  ): Promise<TodoTask> {
    if (!dto.title || dto.title.trim().length === 0) {
      throw new BadRequestException('title is required');
    }

    // Compute sortOrder: max in the target column + 1
    let sortOrder: number;
    if (dto.sortOrder != null) {
      sortOrder = dto.sortOrder;
    } else {
      const status = dto.status || 'todo';
      const boardId = dto.boardId || null;
      const maxResult = await this.taskRepo
        .createQueryBuilder('t')
        .select('COALESCE(MAX(t.sort_order), 0)', 'maxSort')
        .where('t.tenant_id = :tenantId', { tenantId })
        .andWhere('t.status = :status', { status })
        .andWhere(
          boardId ? 't.board_id = :boardId' : 't.board_id IS NULL',
          boardId ? { boardId } : {},
        )
        .andWhere('t.is_deleted = false')
        .getRawOne();
      sortOrder = (maxResult?.maxSort ?? 0) + 1;
    }

    const task = this.taskRepo.create({
      tenantId,
      createdBy: userId,
      title: dto.title.trim(),
      description: dto.description || null,
      status: dto.status || 'todo',
      priority: dto.priority || 'medium',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      assigneeUserId: dto.assigneeUserId || null,
      ownerGroupId: dto.ownerGroupId || null,
      tags: dto.tags || null,
      category: dto.category || null,
      boardId: dto.boardId || null,
      sortOrder,
    });

    const saved = await this.taskRepo.save(task);

    // Handle tagIds
    if (dto.tagIds && dto.tagIds.length > 0) {
      await this.syncTaskTags(tenantId, saved.id, dto.tagIds);
    }

    return saved;
  }

  async updateTask(
    tenantId: string,
    userId: string,
    taskId: string,
    dto: UpdateTodoTaskDto,
  ): Promise<TodoTask> {
    const task = await this.getTask(tenantId, taskId);

    if (dto.title !== undefined) {
      const trimmed = dto.title.trim();
      if (trimmed.length === 0) {
        throw new BadRequestException('title cannot be empty');
      }
      task.title = trimmed;
    }
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) {
      task.status = dto.status;
      // Auto-set completedAt
      if (dto.status === 'done' || dto.status === 'completed') {
        task.completedAt = task.completedAt || new Date();
      } else {
        task.completedAt = null;
      }
    }
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueDate !== undefined)
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.assigneeUserId !== undefined)
      task.assigneeUserId = dto.assigneeUserId || null;
    if (dto.ownerGroupId !== undefined)
      task.ownerGroupId = dto.ownerGroupId || null;
    if (dto.tags !== undefined) task.tags = dto.tags || null;
    if (dto.category !== undefined) task.category = dto.category || null;
    if (dto.boardId !== undefined) task.boardId = dto.boardId || null;
    if (dto.sortOrder !== undefined) task.sortOrder = dto.sortOrder;
    if (dto.completedAt !== undefined) {
      task.completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    }

    task.updatedBy = userId;
    const saved = await this.taskRepo.save(task);

    // Handle tagIds
    if (dto.tagIds !== undefined) {
      await this.syncTaskTags(tenantId, saved.id, dto.tagIds || []);
    }

    return this.getTask(tenantId, saved.id);
  }

  async deleteTask(tenantId: string, taskId: string): Promise<void> {
    const task = await this.getTask(tenantId, taskId);
    task.isDeleted = true;
    await this.taskRepo.save(task);
  }

  async moveTask(
    tenantId: string,
    userId: string,
    boardId: string,
    taskId: string,
    dto: MoveTaskDto,
  ): Promise<TodoTask> {
    const task = await this.getTask(tenantId, taskId);

    // Verify the board exists
    const board = await this.boardRepo.findOne({
      where: { id: boardId, tenantId, isDeleted: false },
    });
    if (!board) {
      throw new NotFoundException('Board not found');
    }

    // Update task status and sortOrder
    task.status = dto.toColumnKey;
    task.boardId = boardId;
    task.sortOrder = dto.toIndex;
    task.updatedBy = userId;

    // Auto-set completedAt based on column
    const targetColumn = await this.columnRepo.findOne({
      where: { boardId, key: dto.toColumnKey, tenantId, isDeleted: false },
    });
    if (targetColumn?.isDoneColumn) {
      task.completedAt = task.completedAt || new Date();
    } else {
      task.completedAt = null;
    }

    return this.taskRepo.save(task);
  }

  async getTaskStats(tenantId: string, boardId?: string) {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.is_deleted = false');

    if (boardId) {
      qb.andWhere('t.board_id = :boardId', { boardId });
    }

    const all = await qb.getMany();
    const now = new Date();

    return {
      total: all.length,
      completed: all.filter(
        (t) => t.status === 'done' || t.status === 'completed',
      ).length,
      pending: all.filter(
        (t) => t.status === 'todo' || t.status === 'pending',
      ).length,
      in_progress: all.filter(
        (t) => t.status === 'doing' || t.status === 'in_progress',
      ).length,
      overdue: all.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < now &&
          t.status !== 'done' &&
          t.status !== 'completed',
      ).length,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Task-Tag sync helper                                                */
  /* ------------------------------------------------------------------ */

  private async syncTaskTags(
    tenantId: string,
    taskId: string,
    tagIds: string[],
  ): Promise<void> {
    // Remove existing
    await this.taskTagRepo
      .createQueryBuilder()
      .delete()
      .where('task_id = :taskId AND tenant_id = :tenantId', {
        taskId,
        tenantId,
      })
      .execute();

    // Add new
    if (tagIds.length > 0) {
      const entities = tagIds.map((tagId) =>
        this.taskTagRepo.create({ tenantId, taskId, tagId }),
      );
      await this.taskTagRepo.save(entities);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Tags                                                                */
  /* ------------------------------------------------------------------ */

  async listTags(tenantId: string): Promise<TodoTag[]> {
    return this.tagRepo.find({
      where: { tenantId, isDeleted: false },
      order: { name: 'ASC' },
    });
  }

  async createTag(
    tenantId: string,
    userId: string,
    dto: CreateTodoTagDto,
  ): Promise<TodoTag> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestException('name is required');
    }
    const tag = this.tagRepo.create({
      tenantId,
      createdBy: userId,
      name: dto.name.trim(),
      color: dto.color || null,
    });
    return this.tagRepo.save(tag);
  }

  async updateTag(
    tenantId: string,
    userId: string,
    tagId: string,
    dto: UpdateTodoTagDto,
  ): Promise<TodoTag> {
    const tag = await this.tagRepo.findOne({
      where: { id: tagId, tenantId, isDeleted: false },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (trimmed.length === 0) {
        throw new BadRequestException('name cannot be empty');
      }
      tag.name = trimmed;
    }
    if (dto.color !== undefined) tag.color = dto.color || null;
    tag.updatedBy = userId;
    return this.tagRepo.save(tag);
  }

  async deleteTag(tenantId: string, tagId: string): Promise<void> {
    const tag = await this.tagRepo.findOne({
      where: { id: tagId, tenantId, isDeleted: false },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    tag.isDeleted = true;
    await this.tagRepo.save(tag);
  }

  /* ------------------------------------------------------------------ */
  /* Boards                                                              */
  /* ------------------------------------------------------------------ */

  async listBoards(tenantId: string) {
    const boards = await this.boardRepo.find({
      where: { tenantId, isDeleted: false },
      relations: ['columns'],
      order: { createdAt: 'DESC' },
    });
    // Sort columns by orderIndex
    for (const board of boards) {
      if (board.columns) {
        board.columns = board.columns
          .filter((c) => !c.isDeleted)
          .sort((a, b) => a.orderIndex - b.orderIndex);
      }
    }
    return boards;
  }

  async getBoard(tenantId: string, boardId: string): Promise<TodoBoard> {
    const board = await this.boardRepo.findOne({
      where: { id: boardId, tenantId, isDeleted: false },
      relations: ['columns'],
    });
    if (!board) {
      throw new NotFoundException('Board not found');
    }
    if (board.columns) {
      board.columns = board.columns
        .filter((c) => !c.isDeleted)
        .sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return board;
  }

  async createBoard(
    tenantId: string,
    userId: string,
    dto: CreateTodoBoardDto,
  ): Promise<TodoBoard> {
    const board = this.boardRepo.create({
      tenantId,
      createdBy: userId,
      name: dto.name,
      description: dto.description || null,
      visibility: dto.visibility || 'TEAM',
    });

    const savedBoard = await this.boardRepo.save(board);

    // Create columns
    const columnDefs = dto.columns?.length
      ? dto.columns
      : [
          { key: 'todo', title: 'To Do' },
          { key: 'doing', title: 'Doing' },
          { key: 'done', title: 'Done', isDoneColumn: true },
        ];

    const columns: TodoBoardColumn[] = [];
    for (let i = 0; i < columnDefs.length; i++) {
      const colDef = columnDefs[i];
      const col = this.columnRepo.create({
        tenantId,
        createdBy: userId,
        boardId: savedBoard.id,
        key: colDef.key,
        title: colDef.title,
        orderIndex: i,
        wipLimit: colDef.wipLimit ?? null,
        isDoneColumn: colDef.isDoneColumn ?? false,
      });
      columns.push(col);
    }
    await this.columnRepo.save(columns);

    savedBoard.columns = columns;
    return savedBoard;
  }

  async updateBoard(
    tenantId: string,
    userId: string,
    boardId: string,
    dto: UpdateTodoBoardDto,
  ): Promise<TodoBoard> {
    const board = await this.getBoard(tenantId, boardId);
    if (dto.name !== undefined) board.name = dto.name;
    if (dto.description !== undefined) board.description = dto.description;
    if (dto.visibility !== undefined) board.visibility = dto.visibility;
    board.updatedBy = userId;
    return this.boardRepo.save(board);
  }

  async deleteBoard(tenantId: string, boardId: string): Promise<void> {
    const board = await this.boardRepo.findOne({
      where: { id: boardId, tenantId, isDeleted: false },
    });
    if (!board) {
      throw new NotFoundException('Board not found');
    }

    // Move tasks to no-board (null boardId)
    await this.taskRepo
      .createQueryBuilder()
      .update(TodoTask)
      .set({ boardId: null as unknown as string })
      .where('board_id = :boardId AND tenant_id = :tenantId AND is_deleted = false', {
        boardId,
        tenantId,
      })
      .execute();

    board.isDeleted = true;
    await this.boardRepo.save(board);
  }

  async replaceColumns(
    tenantId: string,
    userId: string,
    boardId: string,
    columnDtos: BoardColumnDto[],
  ): Promise<TodoBoardColumn[]> {
    // Verify the board exists
    await this.getBoard(tenantId, boardId);

    // Soft-delete existing columns
    await this.columnRepo
      .createQueryBuilder()
      .update(TodoBoardColumn)
      .set({ isDeleted: true, updatedBy: userId })
      .where('board_id = :boardId AND tenant_id = :tenantId', {
        boardId,
        tenantId,
      })
      .execute();

    // Create new columns
    const columns: TodoBoardColumn[] = [];
    for (let i = 0; i < columnDtos.length; i++) {
      const dto = columnDtos[i];
      const col = this.columnRepo.create({
        tenantId,
        createdBy: userId,
        boardId,
        key: dto.key,
        title: dto.title,
        orderIndex: i,
        wipLimit: dto.wipLimit ?? null,
        isDoneColumn: dto.isDoneColumn ?? false,
      });
      columns.push(col);
    }
    return this.columnRepo.save(columns);
  }

  async getBoardColumns(
    tenantId: string,
    boardId: string,
  ): Promise<TodoBoardColumn[]> {
    return this.columnRepo.find({
      where: { boardId, tenantId, isDeleted: false },
      order: { orderIndex: 'ASC' },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Seed helpers                                                        */
  /* ------------------------------------------------------------------ */

  async seedDefaultBoard(tenantId: string, userId: string): Promise<void> {
    // Check if default board already exists
    const existing = await this.boardRepo.findOne({
      where: { tenantId, name: 'Team Tasks', isDeleted: false },
    });
    if (existing) return;

    try {
      const board = await this.createBoard(tenantId, userId, {
        name: 'Team Tasks',
        description: 'Default team task board',
        visibility: 'TEAM',
        columns: [
          { key: 'todo', title: 'To Do' },
          { key: 'doing', title: 'Doing' },
          { key: 'done', title: 'Done', isDoneColumn: true },
        ],
      });

      // Create demo tasks
      const demoTasks = [
        { title: 'Review Q1 compliance report', priority: 'high', status: 'todo' },
        { title: 'Update security training materials', priority: 'medium', status: 'todo' },
        { title: 'Schedule department sync meeting', priority: 'low', status: 'doing' },
        { title: 'Complete onboarding documentation', priority: 'medium', status: 'done' },
      ];

      for (const demo of demoTasks) {
        await this.createTask(tenantId, userId, {
          title: demo.title,
          priority: demo.priority,
          status: demo.status,
          boardId: board.id,
        });
      }
    } catch (err: unknown) {
      // Handle race condition: if another request already created the board
      // (unique constraint violation or duplicate), silently ignore
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('duplicate') || message.includes('unique')) {
        return;
      }
      throw err;
    }
  }
}
