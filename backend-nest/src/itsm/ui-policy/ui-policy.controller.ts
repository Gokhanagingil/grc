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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { UiPolicyService } from './ui-policy.service';
import { UiActionService } from './ui-action.service';
import { UiPolicy } from './ui-policy.entity';
import { UiAction } from './ui-action.entity';
import { CreateUiPolicyDto } from './dto/create-ui-policy.dto';
import { UpdateUiPolicyDto } from './dto/update-ui-policy.dto';
import { CreateUiActionDto } from './dto/create-ui-action.dto';
import { UpdateUiActionDto } from './dto/update-ui-action.dto';

@Controller('grc/itsm/ui-policies')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class UiPolicyController {
  constructor(
    private readonly uiPolicyService: UiPolicyService,
    private readonly uiActionService: UiActionService,
  ) {}

  @Get()
  @Permissions(Permission.ITSM_UI_POLICY_READ)
  @Perf()
  async findAllPolicies(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.uiPolicyService.findAllActive(tenantId);
  }

  @Post()
  @Permissions(Permission.ITSM_UI_POLICY_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createPolicy(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateUiPolicyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.uiPolicyService.createPolicy(
      tenantId,
      req.user.id,
      dto as unknown as Partial<UiPolicy>,
    );
  }

  @Get('policies/:id')
  @Permissions(Permission.ITSM_UI_POLICY_READ)
  @Perf()
  async findOnePolicy(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const policy = await this.uiPolicyService.findById(tenantId, id);
    if (!policy) {
      throw new NotFoundException(`UI policy ${id} not found`);
    }
    return policy;
  }

  @Patch('policies/:id')
  @Permissions(Permission.ITSM_UI_POLICY_WRITE)
  @Perf()
  async updatePolicy(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateUiPolicyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const updated = await this.uiPolicyService.updatePolicy(
      tenantId,
      req.user.id,
      id,
      dto as unknown as Partial<UiPolicy>,
    );
    if (!updated) {
      throw new NotFoundException(`UI policy ${id} not found`);
    }
    return updated;
  }

  @Delete('policies/:id')
  @Permissions(Permission.ITSM_UI_POLICY_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async removePolicy(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const deleted = await this.uiPolicyService.softDeletePolicy(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`UI policy ${id} not found`);
    }
  }

  @Get('table/:tableName')
  @Permissions(Permission.ITSM_UI_POLICY_READ)
  @Perf()
  async findByTable(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const policies = await this.uiPolicyService.findByTableName(
      tenantId,
      tableName,
    );
    const actions = await this.uiActionService.findByTableName(
      tenantId,
      tableName,
    );
    return { policies, actions };
  }

  @Post('evaluate')
  @Permissions(Permission.ITSM_UI_POLICY_READ)
  @Perf()
  async evaluate(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      tableName: string;
      record: Record<string, unknown>;
      userRoles?: string[];
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const policies = await this.uiPolicyService.findByTableName(
      tenantId,
      body.tableName,
    );
    const actions = await this.uiActionService.findByTableName(
      tenantId,
      body.tableName,
    );

    const fieldEffects = this.uiPolicyService.evaluatePolicies(
      policies,
      body.record,
    );
    const visibleActions = this.uiActionService.getActionsForRecord(
      actions,
      body.record,
      body.userRoles,
    );

    return { fieldEffects, actions: visibleActions };
  }

  @Get('actions')
  @Permissions(Permission.ITSM_UI_POLICY_READ)
  @Perf()
  async findAllActions(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.uiActionService.findAllActive(tenantId);
  }

  @Post('actions')
  @Permissions(Permission.ITSM_UI_POLICY_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createAction(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateUiActionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.uiActionService.createAction(
      tenantId,
      req.user.id,
      dto as unknown as Partial<UiAction>,
    );
  }

  @Get('actions/:id')
  @Permissions(Permission.ITSM_UI_POLICY_READ)
  @Perf()
  async findOneAction(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const action = await this.uiActionService.findById(tenantId, id);
    if (!action) {
      throw new NotFoundException(`UI action ${id} not found`);
    }
    return action;
  }

  @Patch('actions/:id')
  @Permissions(Permission.ITSM_UI_POLICY_WRITE)
  @Perf()
  async updateAction(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateUiActionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const updated = await this.uiActionService.updateAction(
      tenantId,
      req.user.id,
      id,
      dto as unknown as Partial<UiAction>,
    );
    if (!updated) {
      throw new NotFoundException(`UI action ${id} not found`);
    }
    return updated;
  }

  @Delete('actions/:id')
  @Permissions(Permission.ITSM_UI_POLICY_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async removeAction(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const deleted = await this.uiActionService.softDeleteAction(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`UI action ${id} not found`);
    }
  }
}
