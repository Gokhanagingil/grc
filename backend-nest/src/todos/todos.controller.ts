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
  UnauthorizedException,
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

  /** Extract authenticated user id or throw. */
  private getUserId(req: RequestWithUser): string {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User identity not available');
    }
    return userId;
  }

  /* ------------------------------------------------------------------ */
  /* Tasks                                                               */
  /* ------------------------------------------------------------------ */

  @Get()
  async list(
    @Request() req: RequestWithUser,
    @Query('boardId') boardId?: string | string[],
    @Query('status') status?: string | string[],
    @Query('assigneeUserId') assigneeUserId?: string | string[],
    @Query('priority') priority?: string | string[],
    @Query('dueDateFrom') dueDateFrom?: string | string[],
    @Query('dueDateTo') dueDateTo?: string | string[],
    @Query('search') search?: string | string[],
    @Query('page') page?: string | string[],
    @Query('pageSize') pageSize?: string | string[],
  ) {
    const tenantId = req.tenantId!;
    // Coerce query params to string to prevent type-confusion attacks
    // (a param sent twice becomes an array)
    const str = (v?: string | string[]): string | undefined =>
      Array.isArray(v) ? v[0] : v;
    const pageStr = str(page);
    const pageSizeStr = str(pageSize);
    return this.todosService.listTasks(tenantId, {
      boardId: str(boardId),
      status: str(status),
      assigneeUserId: str(assigneeUserId),
      priority: str(priority),
      dueDateFrom: str(dueDateFrom),
      dueDateTo: str(dueDateTo),
      search: str(search),
      page: pageStr ? parseInt(pageStr, 10) : undefined,
      pageSize: pageSizeStr ? parseInt(pageSizeStr, 10) : undefined,
    });
  }

  @Get('stats/summary')
  async getStats(
    @Request() req: RequestWithUser,
    @Query('boardId') boardId?: string | string[],
  ) {
    const tenantId = req.tenantId!;
    const id = Array.isArray(boardId) ? boardId[0] : boardId;
    return this.todosService.getTaskStats(tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: RequestWithUser,
    @Body() dto: CreateTodoTaskDto,
  ) {
    const tenantId = req.tenantId!;
    const userId = this.getUserId(req);
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
    const userId = this.getUserId(req);
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
    const userId = this.getUserId(req);
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
    const userId = this.getUserId(req);
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
    const userId = this.getUserId(req);
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
    const userId = this.getUserId(req);
    return this.todosService.moveTask(tenantId, userId, boardId, taskId, dto);
  }

  /* ------------------------------------------------------------------ */
  /* Seed (admin)                                                        */
  /* ------------------------------------------------------------------ */

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  async seed(@Request() req: RequestWithUser) {
    const tenantId = req.tenantId!;
    const userId = this.getUserId(req);
    await this.todosService.seedDefaultBoard(tenantId, userId);
    return { message: 'Default board seeded' };
  }
}
