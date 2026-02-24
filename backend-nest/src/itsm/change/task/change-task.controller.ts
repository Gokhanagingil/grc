import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
  Request,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { Perf } from '../../../common/decorators';
import { ChangeTaskService } from './change-task.service';
import { CreateChangeTaskDto } from './dto/create-change-task.dto';
import { UpdateChangeTaskDto } from './dto/update-change-task.dto';
import { ChangeTaskFilterDto } from './dto/change-task-filter.dto';
import { AddDependencyDto, RemoveDependencyDto } from './dto/manage-dependency.dto';

@Controller('grc/itsm/changes/:changeId/tasks')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ChangeTaskController {
  constructor(private readonly changeTaskService: ChangeTaskService) {}

  @Get()
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async listTasks(
    @Headers('x-tenant-id') tenantId: string,
    @Param('changeId') changeId: string,
    @Query() filterDto: ChangeTaskFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.changeTaskService.findTasksForChange(
      tenantId,
      changeId,
      filterDto,
    );
  }

  @Post()
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createTask(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('changeId') changeId: string,
    @Body() dto: CreateChangeTaskDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { plannedStartAt, plannedEndAt, ...rest } = dto;
    return this.changeTaskService.createTask(tenantId, req.user.id, changeId, {
      ...rest,
      ...(plannedStartAt ? { plannedStartAt: new Date(plannedStartAt) } : {}),
      ...(plannedEndAt ? { plannedEndAt: new Date(plannedEndAt) } : {}),
    });
  }

  @Get('summary')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async getTaskSummary(
    @Headers('x-tenant-id') tenantId: string,
    @Param('changeId') changeId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.changeTaskService.getTaskSummary(tenantId, changeId);
  }

  @Get('dependencies')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async getDependencies(
    @Headers('x-tenant-id') tenantId: string,
    @Param('changeId') changeId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.changeTaskService.getDependencies(tenantId, changeId);
  }

  @Post('dependencies')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async addDependency(
    @Headers('x-tenant-id') tenantId: string,
    @Param('changeId') changeId: string,
    @Body() dto: AddDependencyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.changeTaskService.addDependency(
      tenantId,
      changeId,
      dto.predecessorTaskId,
      dto.successorTaskId,
    );
  }

  @Delete('dependencies')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async removeDependency(
    @Headers('x-tenant-id') tenantId: string,
    @Param('changeId') changeId: string,
    @Body() dto: RemoveDependencyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const removed = await this.changeTaskService.removeDependency(
      tenantId,
      changeId,
      dto.predecessorTaskId,
      dto.successorTaskId,
    );
    if (!removed) {
      throw new NotFoundException('Dependency not found');
    }
  }

  @Get(':taskId')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async getTask(
    @Headers('x-tenant-id') tenantId: string,
    @Param('changeId') changeId: string,
    @Param('taskId') taskId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const task = await this.changeTaskService.findOneTask(
      tenantId,
      changeId,
      taskId,
    );
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const readiness = await this.changeTaskService.calculateReadiness(
      tenantId,
      changeId,
      taskId,
    );

    return { ...task, readiness };
  }

  @Patch(':taskId')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @Perf()
  async updateTask(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('changeId') changeId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateChangeTaskDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const {
      plannedStartAt,
      plannedEndAt,
      actualStartAt,
      actualEndAt,
      ...rest
    } = dto;
    const task = await this.changeTaskService.updateTask(
      tenantId,
      req.user.id,
      changeId,
      taskId,
      {
        ...rest,
        ...(plannedStartAt !== undefined
          ? { plannedStartAt: plannedStartAt ? new Date(plannedStartAt) : null }
          : {}),
        ...(plannedEndAt !== undefined
          ? { plannedEndAt: plannedEndAt ? new Date(plannedEndAt) : null }
          : {}),
        ...(actualStartAt !== undefined
          ? { actualStartAt: actualStartAt ? new Date(actualStartAt) : null }
          : {}),
        ...(actualEndAt !== undefined
          ? { actualEndAt: actualEndAt ? new Date(actualEndAt) : null }
          : {}),
      },
    );

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    return task;
  }

  @Delete(':taskId')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deleteTask(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('changeId') changeId: string,
    @Param('taskId') taskId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const deleted = await this.changeTaskService.softDeleteTask(
      tenantId,
      req.user.id,
      changeId,
      taskId,
    );
    if (!deleted) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
  }
}
