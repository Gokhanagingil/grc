import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { RequestWithUser } from '../common/types';
import { TodosService } from './todos.service';
import {
  CreateTodoTaskDto,
  UpdateTodoTaskDto,
  CreateTodoBoardDto,
  UpdateTodoBoardDto,
  BoardColumnDto,
  MoveTaskDto,
} from './dto';

/**
 * Todos Controller
 *
 * Provides CRUD for To-Do tasks and Kanban boards.
 * Data is persisted in PostgreSQL with full multi-tenant isolation.
 *
 * Security:
 * - All routes require JWT authentication (JwtAuthGuard)
 * - All routes require valid tenant access (TenantGuard validates x-tenant-id header
 *   and ensures user belongs to the requested tenant)
 */
@Controller('todos')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  /* ------------------------------------------------------------------ */
  /* Tasks                                                               */
  /* ------------------------------------------------------------------ */

  @Get()
  async list(
    @Request() req: RequestWithUser,
    @Query('boardId') boardId?: string,
    @Query('status') status?: string,
    @Query('assigneeUserId') assigneeUserId?: string,
    @Query('priority') priority?: string,
    @Query('dueDateFrom') dueDateFrom?: string,
    @Query('dueDateTo') dueDateTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tenantId = req.tenantId!;
    return this.todosService.listTasks(tenantId, {
      boardId,
      status,
      assigneeUserId,
      priority,
      dueDateFrom,
      dueDateTo,
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('stats/summary')
  async getStats(
    @Request() req: RequestWithUser,
    @Query('boardId') boardId?: string,
  ) {
    const tenantId = req.tenantId!;
    return this.todosService.getTaskStats(tenantId, boardId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: RequestWithUser,
    @Body() dto: CreateTodoTaskDto,
  ) {
    const tenantId = req.tenantId!;
    const userId = req.user?.sub || 'system';
    return this.todosService.createTask(tenantId, userId, dto);
  }

  @Get(':id')
  async findOne(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId!;
    return this.todosService.getTask(tenantId, id);
  }

  @Patch(':id')
  async update(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateTodoTaskDto,
  ) {
    const tenantId = req.tenantId!;
    const userId = req.user?.sub || 'system';
    return this.todosService.updateTask(tenantId, userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId!;
    await this.todosService.deleteTask(tenantId, id);
  }

  /* ------------------------------------------------------------------ */
  /* Boards                                                              */
  /* ------------------------------------------------------------------ */

  @Get('boards/list')
  async listBoards(@Request() req: RequestWithUser) {
    const tenantId = req.tenantId!;
    const boards = await this.todosService.listBoards(tenantId);
    return { items: boards, total: boards.length };
  }

  @Post('boards')
  @HttpCode(HttpStatus.CREATED)
  async createBoard(
    @Request() req: RequestWithUser,
    @Body() dto: CreateTodoBoardDto,
  ) {
    const tenantId = req.tenantId!;
    const userId = req.user?.sub || 'system';
    return this.todosService.createBoard(tenantId, userId, dto);
  }

  @Get('boards/:boardId')
  async getBoard(
    @Request() req: RequestWithUser,
    @Param('boardId') boardId: string,
  ) {
    const tenantId = req.tenantId!;
    return this.todosService.getBoard(tenantId, boardId);
  }

  @Patch('boards/:boardId')
  async updateBoard(
    @Request() req: RequestWithUser,
    @Param('boardId') boardId: string,
    @Body() dto: UpdateTodoBoardDto,
  ) {
    const tenantId = req.tenantId!;
    const userId = req.user?.sub || 'system';
    return this.todosService.updateBoard(tenantId, userId, boardId, dto);
  }

  @Get('boards/:boardId/columns')
  async getBoardColumns(
    @Request() req: RequestWithUser,
    @Param('boardId') boardId: string,
  ) {
    const tenantId = req.tenantId!;
    return this.todosService.getBoardColumns(tenantId, boardId);
  }

  @Put('boards/:boardId/columns')
  async replaceColumns(
    @Request() req: RequestWithUser,
    @Param('boardId') boardId: string,
    @Body() columns: BoardColumnDto[],
  ) {
    const tenantId = req.tenantId!;
    const userId = req.user?.sub || 'system';
    return this.todosService.replaceColumns(tenantId, userId, boardId, columns);
  }

  @Post('boards/:boardId/tasks/:taskId/move')
  async moveTask(
    @Request() req: RequestWithUser,
    @Param('boardId') boardId: string,
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    const tenantId = req.tenantId!;
    const userId = req.user?.sub || 'system';
    return this.todosService.moveTask(tenantId, userId, boardId, taskId, dto);
  }

  /* ------------------------------------------------------------------ */
  /* Seed (admin)                                                        */
  /* ------------------------------------------------------------------ */

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  async seed(@Request() req: RequestWithUser) {
    const tenantId = req.tenantId!;
    const userId = req.user?.sub || 'system';
    await this.todosService.seedDefaultBoard(tenantId, userId);
    return { message: 'Default board seeded' };
  }
}
