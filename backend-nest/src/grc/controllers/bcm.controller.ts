import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  Request,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { BcmModuleService } from '../services/bcm.service';
import {
  CreateBcmServiceDto,
  UpdateBcmServiceDto,
  BcmServiceFilterDto,
  CreateBcmBiaDto,
  UpdateBcmBiaDto,
  BcmBiaFilterDto,
  CreateBcmPlanDto,
  UpdateBcmPlanDto,
  BcmPlanFilterDto,
  CreateBcmPlanStepDto,
  UpdateBcmPlanStepDto,
  BcmPlanStepFilterDto,
  CreateBcmExerciseDto,
  UpdateBcmExerciseDto,
  BcmExerciseFilterDto,
} from '../dto/bcm.dto';
import {
  BcmServiceStatus,
  BcmCriticalityTier,
  BcmBiaStatus,
  BcmPlanType,
  BcmPlanStatus,
  BcmPlanStepStatus,
  BcmExerciseType,
  BcmExerciseStatus,
  BcmExerciseOutcome,
} from '../enums';

/**
 * BCM Controller - Business Continuity Management
 *
 * Provides CRUD endpoints for BCM Services, BIAs, Plans, Plan Steps, and Exercises.
 * All endpoints require JWT authentication and tenant context.
 * Uses GRC_RISK permissions as BCM is a risk-adjacent module.
 */
@ApiTags('BCM - Business Continuity Management')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/bcm')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class BcmController {
  constructor(private readonly bcmService: BcmModuleService) {}

  // ============================================================================
  // Filter Metadata Endpoints
  // ============================================================================

  @Get('filters')
  @ApiOperation({
    summary: 'Get BCM filter metadata',
    description: 'Returns available filter values for BCM list UIs',
  })
  @ApiResponse({
    status: 200,
    description: 'Filter metadata returned successfully',
  })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  getFilters(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return {
      success: true,
      data: {
        serviceStatuses: Object.values(BcmServiceStatus),
        criticalityTiers: Object.values(BcmCriticalityTier),
        biaStatuses: Object.values(BcmBiaStatus),
        planTypes: Object.values(BcmPlanType),
        planStatuses: Object.values(BcmPlanStatus),
        planStepStatuses: Object.values(BcmPlanStepStatus),
        exerciseTypes: Object.values(BcmExerciseType),
        exerciseStatuses: Object.values(BcmExerciseStatus),
        exerciseOutcomes: Object.values(BcmExerciseOutcome),
      },
    };
  }

  // ============================================================================
  // BCM Service Endpoints
  // ============================================================================

  @Get('services')
  @ApiOperation({
    summary: 'List BCM Services',
    description: 'Returns paginated list of BCM services for the tenant',
  })
  @ApiResponse({ status: 200, description: 'Services retrieved successfully' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async listServices(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: BcmServiceFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { items, total } = await this.bcmService.findAllServices(
      tenantId,
      filter,
    );

    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Get('services/:id')
  @ApiOperation({
    summary: 'Get BCM Service by ID',
    description: 'Returns a single BCM service',
  })
  @ApiResponse({ status: 200, description: 'Service retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getService(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const service = await this.bcmService.findServiceById(tenantId, id);
    return { success: true, data: service };
  }

  @Post('services')
  @ApiOperation({
    summary: 'Create BCM Service',
    description: 'Creates a new BCM service',
  })
  @ApiResponse({ status: 201, description: 'Service created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createService(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateBcmServiceDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const service = await this.bcmService.createService(
      tenantId,
      dto,
      req.user.id,
    );
    return { success: true, data: service };
  }

  @Patch('services/:id')
  @ApiOperation({
    summary: 'Update BCM Service',
    description: 'Updates an existing BCM service',
  })
  @ApiResponse({ status: 200, description: 'Service updated successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @Perf()
  async updateService(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBcmServiceDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const service = await this.bcmService.updateService(
      tenantId,
      id,
      dto,
      req.user.id,
    );
    return { success: true, data: service };
  }

  @Delete('services/:id')
  @ApiOperation({
    summary: 'Delete BCM Service',
    description: 'Soft deletes a BCM service',
  })
  @ApiResponse({ status: 204, description: 'Service deleted successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deleteService(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.bcmService.deleteService(tenantId, id, req.user.id);
  }

  // Service nested endpoints for BIAs, Plans, Exercises
  // These endpoints return LIST CONTRACT format for consistency with useUniversalList
  @Get('services/:id/bias')
  @ApiOperation({
    summary: 'Get BIAs for Service',
    description:
      'Returns all BIAs linked to a specific service in LIST CONTRACT format',
  })
  @ApiResponse({ status: 200, description: 'BIAs retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getBiasByService(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) serviceId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const bias = await this.bcmService.findBiasByService(tenantId, serviceId);
    // Return LIST CONTRACT format for frontend compatibility
    return {
      items: bias,
      total: bias.length,
      page: 1,
      pageSize: bias.length || 20,
      totalPages: 1,
    };
  }

  @Get('services/:id/plans')
  @ApiOperation({
    summary: 'Get Plans for Service',
    description:
      'Returns all plans linked to a specific service in LIST CONTRACT format',
  })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getPlansByService(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) serviceId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const plans = await this.bcmService.findPlansByService(tenantId, serviceId);
    // Return LIST CONTRACT format for frontend compatibility
    return {
      items: plans,
      total: plans.length,
      page: 1,
      pageSize: plans.length || 20,
      totalPages: 1,
    };
  }

  @Get('services/:id/exercises')
  @ApiOperation({
    summary: 'Get Exercises for Service',
    description:
      'Returns all exercises linked to a specific service in LIST CONTRACT format',
  })
  @ApiResponse({ status: 200, description: 'Exercises retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getExercisesByService(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) serviceId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const exercises = await this.bcmService.findExercisesByService(
      tenantId,
      serviceId,
    );
    // Return LIST CONTRACT format for frontend compatibility
    return {
      items: exercises,
      total: exercises.length,
      page: 1,
      pageSize: exercises.length || 20,
      totalPages: 1,
    };
  }

  // ============================================================================
  // BCM BIA Endpoints
  // ============================================================================

  @Get('bias')
  @ApiOperation({
    summary: 'List BCM BIAs',
    description: 'Returns paginated list of Business Impact Analyses',
  })
  @ApiResponse({ status: 200, description: 'BIAs retrieved successfully' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async listBias(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: BcmBiaFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { items, total } = await this.bcmService.findAllBias(
      tenantId,
      filter,
    );

    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Get('bias/:id')
  @ApiOperation({
    summary: 'Get BCM BIA by ID',
    description: 'Returns a single Business Impact Analysis',
  })
  @ApiResponse({ status: 200, description: 'BIA retrieved successfully' })
  @ApiResponse({ status: 404, description: 'BIA not found' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getBia(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const bia = await this.bcmService.findBiaById(tenantId, id);
    return { success: true, data: bia };
  }

  @Post('bias')
  @ApiOperation({
    summary: 'Create BCM BIA',
    description:
      'Creates a new Business Impact Analysis. Automatically calculates criticality tier.',
  })
  @ApiResponse({ status: 201, description: 'BIA created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createBia(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateBcmBiaDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const bia = await this.bcmService.createBia(tenantId, dto, req.user.id);
    return { success: true, data: bia };
  }

  @Patch('bias/:id')
  @ApiOperation({
    summary: 'Update BCM BIA',
    description:
      'Updates a Business Impact Analysis. Recalculates criticality tier if impact fields change.',
  })
  @ApiResponse({ status: 200, description: 'BIA updated successfully' })
  @ApiResponse({ status: 404, description: 'BIA not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @Perf()
  async updateBia(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBcmBiaDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const bia = await this.bcmService.updateBia(tenantId, id, dto, req.user.id);
    return { success: true, data: bia };
  }

  @Delete('bias/:id')
  @ApiOperation({
    summary: 'Delete BCM BIA',
    description: 'Soft deletes a Business Impact Analysis',
  })
  @ApiResponse({ status: 204, description: 'BIA deleted successfully' })
  @ApiResponse({ status: 404, description: 'BIA not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deleteBia(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.bcmService.deleteBia(tenantId, id, req.user.id);
  }

  // ============================================================================
  // BCM Plan Endpoints
  // ============================================================================

  @Get('plans')
  @ApiOperation({
    summary: 'List BCM Plans',
    description:
      'Returns paginated list of BCM plans (BCP, DRP, IT Continuity)',
  })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async listPlans(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: BcmPlanFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { items, total } = await this.bcmService.findAllPlans(
      tenantId,
      filter,
    );

    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Get('plans/:id')
  @ApiOperation({
    summary: 'Get BCM Plan by ID',
    description: 'Returns a single BCM plan with its steps',
  })
  @ApiResponse({ status: 200, description: 'Plan retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getPlan(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const plan = await this.bcmService.findPlanById(tenantId, id);
    return { success: true, data: plan };
  }

  @Post('plans')
  @ApiOperation({
    summary: 'Create BCM Plan',
    description: 'Creates a new BCM plan (BCP, DRP, or IT Continuity)',
  })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createPlan(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateBcmPlanDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const plan = await this.bcmService.createPlan(tenantId, dto, req.user.id);
    return { success: true, data: plan };
  }

  @Patch('plans/:id')
  @ApiOperation({
    summary: 'Update BCM Plan',
    description: 'Updates an existing BCM plan',
  })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @Perf()
  async updatePlan(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBcmPlanDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const plan = await this.bcmService.updatePlan(
      tenantId,
      id,
      dto,
      req.user.id,
    );
    return { success: true, data: plan };
  }

  @Delete('plans/:id')
  @ApiOperation({
    summary: 'Delete BCM Plan',
    description: 'Soft deletes a BCM plan',
  })
  @ApiResponse({ status: 204, description: 'Plan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deletePlan(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.bcmService.deletePlan(tenantId, id, req.user.id);
  }

  // Plan nested endpoints for steps
  @Get('plans/:id/steps')
  @ApiOperation({
    summary: 'Get Steps for Plan',
    description:
      'Returns all steps for a specific plan in LIST CONTRACT format, ordered by step order',
  })
  @ApiResponse({ status: 200, description: 'Steps retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getStepsByPlan(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) planId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const steps = await this.bcmService.findStepsByPlan(tenantId, planId);
    // Return LIST CONTRACT format for frontend compatibility
    return {
      items: steps,
      total: steps.length,
      page: 1,
      pageSize: steps.length || 20,
      totalPages: 1,
    };
  }

  // ============================================================================
  // BCM Plan Step Endpoints
  // ============================================================================

  @Get('plan-steps')
  @ApiOperation({
    summary: 'List BCM Plan Steps',
    description: 'Returns paginated list of plan steps',
  })
  @ApiResponse({ status: 200, description: 'Steps retrieved successfully' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async listPlanSteps(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: BcmPlanStepFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { items, total } = await this.bcmService.findAllPlanSteps(
      tenantId,
      filter,
    );

    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Get('plan-steps/:id')
  @ApiOperation({
    summary: 'Get BCM Plan Step by ID',
    description: 'Returns a single plan step',
  })
  @ApiResponse({ status: 200, description: 'Step retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getPlanStep(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const step = await this.bcmService.findPlanStepById(tenantId, id);
    return { success: true, data: step };
  }

  @Post('plan-steps')
  @ApiOperation({
    summary: 'Create BCM Plan Step',
    description: 'Creates a new step for a BCM plan',
  })
  @ApiResponse({ status: 201, description: 'Step created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createPlanStep(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateBcmPlanStepDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const step = await this.bcmService.createPlanStep(
      tenantId,
      dto,
      req.user.id,
    );
    return { success: true, data: step };
  }

  @Patch('plan-steps/:id')
  @ApiOperation({
    summary: 'Update BCM Plan Step',
    description: 'Updates an existing plan step',
  })
  @ApiResponse({ status: 200, description: 'Step updated successfully' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @Perf()
  async updatePlanStep(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBcmPlanStepDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const step = await this.bcmService.updatePlanStep(
      tenantId,
      id,
      dto,
      req.user.id,
    );
    return { success: true, data: step };
  }

  @Delete('plan-steps/:id')
  @ApiOperation({
    summary: 'Delete BCM Plan Step',
    description: 'Soft deletes a plan step',
  })
  @ApiResponse({ status: 204, description: 'Step deleted successfully' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deletePlanStep(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.bcmService.deletePlanStep(tenantId, id, req.user.id);
  }

  // ============================================================================
  // BCM Exercise Endpoints
  // ============================================================================

  @Get('exercises')
  @ApiOperation({
    summary: 'List BCM Exercises',
    description:
      'Returns paginated list of BCM exercises (tabletop, failover, restore, comms)',
  })
  @ApiResponse({ status: 200, description: 'Exercises retrieved successfully' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async listExercises(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: BcmExerciseFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { items, total } = await this.bcmService.findAllExercises(
      tenantId,
      filter,
    );

    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Get('exercises/:id')
  @ApiOperation({
    summary: 'Get BCM Exercise by ID',
    description: 'Returns a single BCM exercise',
  })
  @ApiResponse({ status: 200, description: 'Exercise retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getExercise(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const exercise = await this.bcmService.findExerciseById(tenantId, id);
    return { success: true, data: exercise };
  }

  @Post('exercises')
  @ApiOperation({
    summary: 'Create BCM Exercise',
    description: 'Creates a new BCM exercise',
  })
  @ApiResponse({ status: 201, description: 'Exercise created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Service or Plan not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createExercise(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateBcmExerciseDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const exercise = await this.bcmService.createExercise(
      tenantId,
      dto,
      req.user.id,
    );
    return { success: true, data: exercise };
  }

  @Patch('exercises/:id')
  @ApiOperation({
    summary: 'Update BCM Exercise',
    description: 'Updates an existing BCM exercise',
  })
  @ApiResponse({ status: 200, description: 'Exercise updated successfully' })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @Perf()
  async updateExercise(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBcmExerciseDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const exercise = await this.bcmService.updateExercise(
      tenantId,
      id,
      dto,
      req.user.id,
    );
    return { success: true, data: exercise };
  }

  @Delete('exercises/:id')
  @ApiOperation({
    summary: 'Delete BCM Exercise',
    description: 'Soft deletes a BCM exercise',
  })
  @ApiResponse({ status: 204, description: 'Exercise deleted successfully' })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deleteExercise(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.bcmService.deleteExercise(tenantId, id, req.user.id);
  }
}
