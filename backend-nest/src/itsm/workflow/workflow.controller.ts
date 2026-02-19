import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Headers,
  Request,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { RuntimeLoggerService } from '../diagnostics/runtime-logger.service';
import { WorkflowService } from './workflow.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowDefinition } from './workflow-definition.entity';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';

@Controller('grc/itsm/workflows')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowEngineService: WorkflowEngineService,
    private readonly runtimeLogger: RuntimeLoggerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  @Permissions(Permission.ITSM_WORKFLOW_READ)
  @Perf()
  async findAll(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.workflowService.findAllActive(tenantId);
  }

  @Post()
  @Permissions(Permission.ITSM_WORKFLOW_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateWorkflowDefinitionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.workflowService.createDefinition(
      tenantId,
      req.user.id,
      dto as unknown as Partial<WorkflowDefinition>,
    );
  }

  @Get(':id')
  @Permissions(Permission.ITSM_WORKFLOW_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const definition = await this.workflowService.findDefinitionById(
      tenantId,
      id,
    );
    if (!definition) {
      throw new NotFoundException(`Workflow definition ${id} not found`);
    }
    return definition;
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_WORKFLOW_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const updated = await this.workflowService.updateDefinition(
      tenantId,
      req.user.id,
      id,
      dto as unknown as Partial<WorkflowDefinition>,
    );
    if (!updated) {
      throw new NotFoundException(`Workflow definition ${id} not found`);
    }
    return updated;
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_WORKFLOW_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const deleted = await this.workflowService.softDeleteDefinition(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Workflow definition ${id} not found`);
    }
  }

  @Get('table/:tableName')
  @Permissions(Permission.ITSM_WORKFLOW_READ)
  @Perf()
  async findByTable(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.workflowService.findByTableName(tenantId, tableName);
  }

  @Post(':id/transitions/available')
  @Permissions(Permission.ITSM_WORKFLOW_READ)
  @Perf()
  async getAvailableTransitions(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() body: { currentState: string; userRoles?: string[] },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const definition = await this.workflowService.findDefinitionById(
      tenantId,
      id,
    );
    if (!definition) {
      throw new NotFoundException(`Workflow definition ${id} not found`);
    }
    return this.workflowEngineService.getAvailableTransitions(
      definition,
      body.currentState,
      body.userRoles,
    );
  }

  @Post(':id/transitions/validate')
  @Permissions(Permission.ITSM_WORKFLOW_READ)
  @Perf()
  async validateTransition(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      currentState: string;
      transitionName: string;
      record: Record<string, unknown>;
      userRoles?: string[];
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const definition = await this.workflowService.findDefinitionById(
      tenantId,
      id,
    );
    if (!definition) {
      throw new NotFoundException(`Workflow definition ${id} not found`);
    }
    const result = this.workflowEngineService.validateTransition(
      definition,
      body.currentState,
      body.transitionName,
      body.record,
      body.userRoles,
    );

    this.runtimeLogger.logWorkflowTransition({
      tenantId,
      tableName: definition.tableName,
      workflowName: definition.name,
      transitionName: body.transitionName,
      fromState: body.currentState,
      toState: result.targetState,
      allowed: result.allowed,
      reason: result.reason,
    });

    return result;
  }

  @Post(':id/transitions/execute')
  @Permissions(Permission.ITSM_WORKFLOW_WRITE)
  @Perf()
  async executeTransition(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      currentState: string;
      transitionName: string;
      record: Record<string, unknown>;
      userRoles?: string[];
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const definition = await this.workflowService.findDefinitionById(
      tenantId,
      id,
    );
    if (!definition) {
      throw new NotFoundException(`Workflow definition ${id} not found`);
    }

    const result = this.workflowEngineService.executeTransition(
      definition,
      body.currentState,
      body.transitionName,
      body.record,
      body.userRoles,
    );

    this.runtimeLogger.logWorkflowTransition({
      tenantId,
      tableName: definition.tableName,
      workflowName: definition.name,
      transitionName: body.transitionName,
      fromState: body.currentState,
      toState: result.newState,
      allowed: true,
    });

    this.eventEmitter.emit('workflow.transition.executed', {
      tenantId,
      tableName: definition.tableName,
      workflowId: definition.id,
      transitionName: body.transitionName,
      fromState: body.currentState,
      toState: result.newState,
      fieldUpdates: result.fieldUpdates,
    });

    return result;
  }

  @Get('resolve/:tableName')
  @Permissions(Permission.ITSM_WORKFLOW_READ)
  @Perf()
  async resolveForTable(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const definition = await this.workflowService.resolveWorkflowForTable(
      tenantId,
      tableName,
    );
    if (!definition) {
      throw new NotFoundException(
        `No active workflow found for table '${tableName}'`,
      );
    }
    return definition;
  }
}
