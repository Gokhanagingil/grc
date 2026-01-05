import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { RequestWithUser } from '../common/types';

interface Todo {
  id: number;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  category: string | null;
  tags: string | null;
  due_date: string | null;
  completed_at: string | null;
  owner_id: string;
  assigned_to: string | null;
  assigned_first_name: string | null;
  assigned_last_name: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateTodoDto {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed';
  category?: string;
  due_date?: string;
}

interface UpdateTodoDto {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed';
  category?: string;
  due_date?: string;
  completed_at?: string | null;
}

/**
 * Todos Controller
 *
 * Provides a minimal in-memory todo list for demo purposes.
 * Data is stored per-tenant in memory and resets on server restart.
 * This is intentionally simple to avoid database migrations.
 *
 * Security:
 * - All routes require JWT authentication (JwtAuthGuard)
 * - All routes require valid tenant access (TenantGuard validates x-tenant-id header
 *   and ensures user belongs to the requested tenant)
 */
@Controller('todos')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TodosController {
  private todosByTenant: Map<string, Todo[]> = new Map();
  private nextIdByTenant: Map<string, number> = new Map();

  private getTodos(tenantId: string): Todo[] {
    if (!this.todosByTenant.has(tenantId)) {
      this.todosByTenant.set(tenantId, []);
    }
    return this.todosByTenant.get(tenantId)!;
  }

  private getNextId(tenantId: string): number {
    const currentId = this.nextIdByTenant.get(tenantId) || 1;
    this.nextIdByTenant.set(tenantId, currentId + 1);
    return currentId;
  }

  @Get()
  list(@Request() req: RequestWithUser) {
    const tenantId = req.tenantId!;
    const todos = this.getTodos(tenantId);
    return { todos };
  }

  @Get('stats/summary')
  getStats(@Request() req: RequestWithUser) {
    const tenantId = req.tenantId!;
    const todos = this.getTodos(tenantId);
    const now = new Date();
    return {
      total: todos.length,
      completed: todos.filter((t) => t.status === 'completed').length,
      pending: todos.filter((t) => t.status === 'pending').length,
      in_progress: todos.filter((t) => t.status === 'in_progress').length,
      overdue: todos.filter(
        (t) =>
          t.due_date && new Date(t.due_date) < now && t.status !== 'completed',
      ).length,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: RequestWithUser, @Body() createDto: CreateTodoDto) {
    const tenantId = req.tenantId!;
    if (!createDto.title) {
      throw new BadRequestException('title is required');
    }

    const todos = this.getTodos(tenantId);
    const now = new Date().toISOString();
    const newTodo: Todo = {
      id: this.getNextId(tenantId),
      title: createDto.title,
      description: createDto.description || null,
      priority: createDto.priority || 'medium',
      status: createDto.status || 'pending',
      category: createDto.category || null,
      tags: null,
      due_date: createDto.due_date || null,
      completed_at: null,
      owner_id: tenantId,
      assigned_to: null,
      assigned_first_name: null,
      assigned_last_name: null,
      created_at: now,
      updated_at: now,
    };

    todos.push(newTodo);
    return newTodo;
  }

  @Get(':id')
  findOne(@Request() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = req.tenantId!;
    const todos = this.getTodos(tenantId);
    const todo = todos.find((t) => t.id === parseInt(id, 10));
    if (!todo) {
      throw new BadRequestException('Todo not found');
    }
    return todo;
  }

  @Put(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() updateDto: UpdateTodoDto,
  ) {
    const tenantId = req.tenantId!;
    const todos = this.getTodos(tenantId);
    const todoIndex = todos.findIndex((t) => t.id === parseInt(id, 10));
    if (todoIndex === -1) {
      throw new BadRequestException('Todo not found');
    }

    const todo = todos[todoIndex];
    const updatedTodo: Todo = {
      ...todo,
      title: updateDto.title ?? todo.title,
      description: updateDto.description ?? todo.description,
      priority: updateDto.priority ?? todo.priority,
      status: updateDto.status ?? todo.status,
      category: updateDto.category ?? todo.category,
      due_date: updateDto.due_date ?? todo.due_date,
      completed_at: updateDto.completed_at ?? todo.completed_at,
      updated_at: new Date().toISOString(),
    };

    todos[todoIndex] = updatedTodo;
    return updatedTodo;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = req.tenantId!;
    const todos = this.getTodos(tenantId);
    const todoIndex = todos.findIndex((t) => t.id === parseInt(id, 10));
    if (todoIndex === -1) {
      throw new BadRequestException('Todo not found');
    }
    todos.splice(todoIndex, 1);
  }
}
