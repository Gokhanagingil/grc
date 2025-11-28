import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { BCMService } from './bcm.service';
import {
  CreateBIAProcessDto,
  CreateBIADependencyDto,
  CreateBCPPlanDto,
  CreateBCPExerciseDto,
  QueryBIAProcessDto,
  QueryBIADependencyDto,
  QueryBCPPlanDto,
  QueryBCPExerciseDto,
} from './dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';

@ApiTags('bcm')
@ApiBearerAuth()
@Controller({ path: 'bcm', version: '2' })
@UseGuards(TenantGuard)
export class BCMController {
  constructor(private readonly service: BCMService) {}

  // BIA Processes
  @Get('processes')
  @ApiOperation({
    summary: 'List BIA processes',
    description: 'Get paginated list of BIA processes',
  })
  @ApiOkResponse({ description: 'List of BIA processes' })
  async listBIAProcesses(
    @Query() query: QueryBIAProcessDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.listBIAProcesses(tenantId, query);
  }

  @Get('processes/:id')
  @ApiOperation({
    summary: 'Get BIA process',
    description: 'Get single BIA process by ID',
  })
  @ApiOkResponse({ description: 'BIA process details' })
  @ApiParam({ name: 'id', description: 'Process ID' })
  async getBIAProcess(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getBIAProcess(id, tenantId);
  }

  @Post('processes')
  @ApiOperation({
    summary: 'Create BIA process',
    description: 'Create a new BIA process',
  })
  @ApiCreatedResponse({ description: 'Created BIA process' })
  @HttpCode(HttpStatus.CREATED)
  async createBIAProcess(
    @Body() dto: CreateBIAProcessDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createBIAProcess(dto, tenantId);
  }

  @Put('processes/:id')
  @ApiOperation({
    summary: 'Update BIA process',
    description: 'Update BIA process',
  })
  @ApiOkResponse({ description: 'Updated BIA process' })
  @ApiParam({ name: 'id', description: 'Process ID' })
  async updateBIAProcess(
    @Param('id') id: string,
    @Body() dto: Partial<CreateBIAProcessDto>,
    @Tenant() tenantId: string,
  ) {
    return this.service.updateBIAProcess(id, dto, tenantId);
  }

  @Delete('processes/:id')
  @ApiOperation({
    summary: 'Delete BIA process',
    description: 'Delete BIA process',
  })
  @ApiOkResponse({ description: 'BIA process deleted' })
  @ApiParam({ name: 'id', description: 'Process ID' })
  @HttpCode(HttpStatus.OK)
  async deleteBIAProcess(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.deleteBIAProcess(id, tenantId);
  }

  // BIA Dependencies
  @Get('dependencies')
  @ApiOperation({
    summary: 'List BIA dependencies',
    description: 'Get paginated list of BIA process dependencies',
  })
  @ApiOkResponse({ description: 'List of BIA dependencies' })
  async listBIADependencies(
    @Query() query: QueryBIADependencyDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.listBIADependencies(tenantId, query);
  }

  @Post('dependencies')
  @ApiOperation({
    summary: 'Create BIA dependency',
    description: 'Create a new BIA process dependency',
  })
  @ApiCreatedResponse({ description: 'Created BIA dependency' })
  @HttpCode(HttpStatus.CREATED)
  async createBIADependency(
    @Body() dto: CreateBIADependencyDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createBIADependency(dto, tenantId);
  }

  @Delete('dependencies/:id')
  @ApiOperation({
    summary: 'Delete BIA dependency',
    description: 'Delete BIA process dependency',
  })
  @ApiOkResponse({ description: 'BIA dependency deleted' })
  @ApiParam({ name: 'id', description: 'Dependency ID' })
  @HttpCode(HttpStatus.OK)
  async deleteBIADependency(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.deleteBIADependency(id, tenantId);
  }

  // BCP Plans
  @Get('plans')
  @ApiOperation({
    summary: 'List BCP plans',
    description: 'Get paginated list of BCP plans',
  })
  @ApiOkResponse({ description: 'List of BCP plans' })
  async listBCPPlans(
    @Query() query: QueryBCPPlanDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.listBCPPlans(tenantId, query);
  }

  @Get('plans/:id')
  @ApiOperation({
    summary: 'Get BCP plan',
    description: 'Get single BCP plan by ID',
  })
  @ApiOkResponse({ description: 'BCP plan details' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  async getBCPPlan(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getBCPPlan(id, tenantId);
  }

  @Post('plans')
  @ApiOperation({
    summary: 'Create BCP plan',
    description: 'Create a new BCP plan',
  })
  @ApiCreatedResponse({ description: 'Created BCP plan' })
  @HttpCode(HttpStatus.CREATED)
  async createBCPPlan(
    @Body() dto: CreateBCPPlanDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createBCPPlan(dto, tenantId);
  }

  @Put('plans/:id')
  @ApiOperation({ summary: 'Update BCP plan', description: 'Update BCP plan' })
  @ApiOkResponse({ description: 'Updated BCP plan' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  async updateBCPPlan(
    @Param('id') id: string,
    @Body() dto: Partial<CreateBCPPlanDto>,
    @Tenant() tenantId: string,
  ) {
    return this.service.updateBCPPlan(id, dto, tenantId);
  }

  @Delete('plans/:id')
  @ApiOperation({ summary: 'Delete BCP plan', description: 'Delete BCP plan' })
  @ApiOkResponse({ description: 'BCP plan deleted' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @HttpCode(HttpStatus.OK)
  async deleteBCPPlan(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.deleteBCPPlan(id, tenantId);
  }

  // BCP Exercises
  @Get('exercises')
  @ApiOperation({
    summary: 'List BCP exercises',
    description: 'Get paginated list of BCP exercises',
  })
  @ApiOkResponse({ description: 'List of BCP exercises' })
  async listBCPExercises(
    @Query() query: QueryBCPExerciseDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.listBCPExercises(tenantId, query);
  }

  @Get('exercises/:id')
  @ApiOperation({
    summary: 'Get BCP exercise',
    description: 'Get single BCP exercise by ID',
  })
  @ApiOkResponse({ description: 'BCP exercise details' })
  @ApiParam({ name: 'id', description: 'Exercise ID' })
  async getBCPExercise(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getBCPExercise(id, tenantId);
  }

  @Post('exercises')
  @ApiOperation({
    summary: 'Create BCP exercise',
    description: 'Create a new BCP exercise',
  })
  @ApiCreatedResponse({ description: 'Created BCP exercise' })
  @HttpCode(HttpStatus.CREATED)
  async createBCPExercise(
    @Body() dto: CreateBCPExerciseDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createBCPExercise(dto, tenantId);
  }

  @Put('exercises/:id')
  @ApiOperation({
    summary: 'Update BCP exercise',
    description: 'Update BCP exercise',
  })
  @ApiOkResponse({ description: 'Updated BCP exercise' })
  @ApiParam({ name: 'id', description: 'Exercise ID' })
  async updateBCPExercise(
    @Param('id') id: string,
    @Body() dto: Partial<CreateBCPExerciseDto>,
    @Tenant() tenantId: string,
  ) {
    return this.service.updateBCPExercise(id, dto, tenantId);
  }

  @Delete('exercises/:id')
  @ApiOperation({
    summary: 'Delete BCP exercise',
    description: 'Delete BCP exercise',
  })
  @ApiOkResponse({ description: 'BCP exercise deleted' })
  @ApiParam({ name: 'id', description: 'Exercise ID' })
  @HttpCode(HttpStatus.OK)
  async deleteBCPExercise(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.deleteBCPExercise(id, tenantId);
  }
}
