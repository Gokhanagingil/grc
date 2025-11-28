import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { AuditLifecycleService } from './audit-lifecycle.service';
import {
  CreateAuditPlanDto,
  CreateAuditEngagementDto,
  CreateAuditTestDto,
  CreateAuditEvidenceDto,
  CreateAuditFindingDto,
  CreateCorrectiveActionDto,
  QueryAuditPlanDto,
  QueryAuditEngagementDto,
  QueryAuditTestDto,
  QueryAuditFindingDto,
  QueryCorrectiveActionDto,
} from './dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';

@ApiTags('audit')
@ApiBearerAuth()
@Controller({ path: 'audit', version: '2' })
@UseGuards(TenantGuard)
export class AuditLifecycleController {
  constructor(private readonly service: AuditLifecycleService) {}

  // Audit Plans
  @Get('plans')
  @ApiOperation({
    summary: 'List audit plans',
    description: 'Get paginated list of audit plans',
  })
  @ApiOkResponse({ description: 'List of audit plans' })
  async listPlans(
    @Query() query: QueryAuditPlanDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.listPlans(tenantId, query);
  }

  @Get('plans/:id')
  @ApiOperation({
    summary: 'Get audit plan',
    description: 'Get single audit plan by ID',
  })
  @ApiOkResponse({ description: 'Audit plan details' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  async getPlan(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getPlan(id, tenantId);
  }

  @Post('plans')
  @ApiOperation({
    summary: 'Create audit plan',
    description: 'Create a new audit plan',
  })
  @ApiCreatedResponse({ description: 'Created audit plan' })
  @HttpCode(HttpStatus.CREATED)
  async createPlan(
    @Body() dto: CreateAuditPlanDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createPlan(dto, tenantId);
  }

  @Put('plans/:id')
  @ApiOperation({
    summary: 'Update audit plan',
    description: 'Update audit plan',
  })
  @ApiOkResponse({ description: 'Updated audit plan' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: Partial<CreateAuditPlanDto>,
    @Tenant() tenantId: string,
  ) {
    return this.service.updatePlan(id, dto, tenantId);
  }

  @Post('plans/:id/archive')
  @ApiOperation({
    summary: 'Archive audit plan',
    description: 'Archive an audit plan',
  })
  @ApiOkResponse({ description: 'Plan archived' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  async archivePlan(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.archivePlan(id, tenantId);
  }

  // Audit Engagements
  @Get('engagements')
  @ApiOperation({
    summary: 'List audit engagements',
    description: 'Get paginated list of audit engagements',
  })
  @ApiOkResponse({ description: 'List of audit engagements' })
  async listEngagements(
    @Query() query: QueryAuditEngagementDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.listEngagements(tenantId, query);
  }

  @Get('engagements/:id')
  @ApiOperation({
    summary: 'Get audit engagement',
    description: 'Get single audit engagement by ID',
  })
  @ApiOkResponse({ description: 'Audit engagement details' })
  @ApiParam({ name: 'id', description: 'Engagement ID' })
  async getEngagement(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getEngagement(id, tenantId);
  }

  @Post('engagements')
  @ApiOperation({
    summary: 'Create audit engagement',
    description: 'Create a new audit engagement',
  })
  @ApiCreatedResponse({ description: 'Created audit engagement' })
  @HttpCode(HttpStatus.CREATED)
  async createEngagement(
    @Body() dto: CreateAuditEngagementDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createEngagement(dto, tenantId);
  }

  @Put('engagements/:id')
  @ApiOperation({
    summary: 'Update audit engagement',
    description: 'Update audit engagement',
  })
  @ApiOkResponse({ description: 'Updated audit engagement' })
  @ApiParam({ name: 'id', description: 'Engagement ID' })
  async updateEngagement(
    @Param('id') id: string,
    @Body() dto: Partial<CreateAuditEngagementDto>,
    @Tenant() tenantId: string,
  ) {
    return this.service.updateEngagement(id, dto, tenantId);
  }

  // Audit Tests
  @Get('tests')
  @ApiOperation({
    summary: 'List audit tests',
    description: 'Get paginated list of audit tests',
  })
  @ApiOkResponse({ description: 'List of audit tests' })
  async listTests(
    @Query() query: QueryAuditTestDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.listTests(tenantId, query);
  }

  @Get('tests/:id')
  @ApiOperation({
    summary: 'Get audit test',
    description: 'Get single audit test by ID',
  })
  @ApiOkResponse({ description: 'Audit test details' })
  @ApiParam({ name: 'id', description: 'Test ID' })
  async getTest(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getTest(id, tenantId);
  }

  @Post('tests')
  @ApiOperation({
    summary: 'Create audit test',
    description: 'Create a new audit test',
  })
  @ApiCreatedResponse({ description: 'Created audit test' })
  @HttpCode(HttpStatus.CREATED)
  async createTest(
    @Body() dto: CreateAuditTestDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createTest(dto, tenantId);
  }

  @Put('tests/:id')
  @ApiOperation({
    summary: 'Update audit test',
    description: 'Update audit test',
  })
  @ApiOkResponse({ description: 'Updated audit test' })
  @ApiParam({ name: 'id', description: 'Test ID' })
  async updateTest(
    @Param('id') id: string,
    @Body() dto: Partial<CreateAuditTestDto>,
    @Tenant() tenantId: string,
  ) {
    return this.service.updateTest(id, dto, tenantId);
  }

  @Get('engagements/:id/tests')
  @ApiOperation({
    summary: 'List tests for engagement',
    description: 'Get paginated list of tests for a specific engagement',
  })
  @ApiOkResponse({ description: 'List of tests for engagement' })
  @ApiParam({ name: 'id', description: 'Engagement ID' })
  async listEngagementTests(
    @Param('id') id: string,
    @Query() query: QueryAuditTestDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.listTests(tenantId, { ...query, engagement_id: id });
  }

  @Post('tests/:id/findings')
  @ApiOperation({
    summary: 'Create finding from test',
    description: 'Create a new finding from a failed test',
  })
  @ApiCreatedResponse({ description: 'Created finding from test' })
  @ApiParam({ name: 'id', description: 'Test ID' })
  @HttpCode(HttpStatus.CREATED)
  async createFindingFromTest(
    @Param('id') testId: string,
    @Body() dto: Omit<CreateAuditFindingDto, 'test_id' | 'engagement_id'>,
    @Tenant() tenantId: string,
  ) {
    return this.service.createFindingFromTest(testId, dto, tenantId);
  }

  @Post('tests/:id/evidence')
  @ApiOperation({
    summary: 'Add evidence to test',
    description: 'Add evidence to a test',
  })
  @ApiCreatedResponse({ description: 'Evidence added to test' })
  @ApiParam({ name: 'id', description: 'Test ID' })
  @HttpCode(HttpStatus.CREATED)
  async addEvidenceToTest(
    @Param('id') testId: string,
    @Body() dto: Omit<CreateAuditEvidenceDto, 'test_id'>,
    @Tenant() tenantId: string,
  ) {
    return this.service.addEvidenceToTest(testId, dto, tenantId);
  }

  // Audit Evidences
  @Get('evidences')
  @ApiOperation({
    summary: 'List audit evidences',
    description: 'Get list of audit evidences (optionally filtered by test_id)',
  })
  @ApiOkResponse({ description: 'List of audit evidences' })
  async listEvidences(
    @Query('test_id') testId: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.listEvidences(tenantId, testId);
  }

  @Post('evidences')
  @ApiOperation({
    summary: 'Create audit evidence',
    description: 'Create a new audit evidence',
  })
  @ApiCreatedResponse({ description: 'Created audit evidence' })
  @HttpCode(HttpStatus.CREATED)
  async createEvidence(
    @Body() dto: CreateAuditEvidenceDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createEvidence(dto, tenantId);
  }

  @Delete('evidences/:id')
  @ApiOperation({
    summary: 'Delete audit evidence',
    description: 'Delete audit evidence',
  })
  @ApiOkResponse({ description: 'Evidence deleted' })
  @ApiParam({ name: 'id', description: 'Evidence ID' })
  @HttpCode(HttpStatus.OK)
  async deleteEvidence(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.deleteEvidence(id, tenantId);
  }

  // Audit Findings
  @Get('findings')
  @ApiOperation({
    summary: 'List audit findings',
    description: 'Get paginated list of audit findings with filters',
  })
  @ApiOkResponse({ description: 'List of audit findings' })
  async listFindings(
    @Query() query: QueryAuditFindingDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.listFindings(tenantId, query);
  }

  @Get('findings/:id')
  @ApiOperation({
    summary: 'Get audit finding',
    description: 'Get single audit finding by ID',
  })
  @ApiOkResponse({ description: 'Audit finding details' })
  @ApiParam({ name: 'id', description: 'Finding ID' })
  async getFinding(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getFinding(id, tenantId);
  }

  @Post('findings')
  @ApiOperation({
    summary: 'Create audit finding',
    description: 'Create a new audit finding',
  })
  @ApiCreatedResponse({ description: 'Created audit finding' })
  @HttpCode(HttpStatus.CREATED)
  async createFinding(
    @Body() dto: CreateAuditFindingDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createFinding(dto, tenantId);
  }

  @Put('findings/:id')
  @ApiOperation({
    summary: 'Update audit finding',
    description: 'Update audit finding',
  })
  @ApiOkResponse({ description: 'Updated audit finding' })
  @ApiParam({ name: 'id', description: 'Finding ID' })
  async updateFinding(
    @Param('id') id: string,
    @Body() dto: Partial<CreateAuditFindingDto>,
    @Tenant() tenantId: string,
  ) {
    return this.service.updateFinding(id, dto, tenantId);
  }

  @Post('findings/:id/corrective-actions')
  @ApiOperation({
    summary: 'Create corrective action from finding',
    description: 'Create a new corrective action from a finding',
  })
  @ApiCreatedResponse({ description: 'Created corrective action from finding' })
  @ApiParam({ name: 'id', description: 'Finding ID' })
  @HttpCode(HttpStatus.CREATED)
  async createCorrectiveActionFromFinding(
    @Param('id') findingId: string,
    @Body() dto: Omit<CreateCorrectiveActionDto, 'finding_id'>,
    @Tenant() tenantId: string,
  ) {
    return this.service.createCorrectiveActionFromFinding(findingId, dto, tenantId);
  }

  @Post('findings/:id/evidence')
  @ApiOperation({
    summary: 'Add evidence to finding',
    description: 'Add evidence to a finding',
  })
  @ApiCreatedResponse({ description: 'Evidence added to finding' })
  @ApiParam({ name: 'id', description: 'Finding ID' })
  @HttpCode(HttpStatus.CREATED)
  async addEvidenceToFinding(
    @Param('id') findingId: string,
    @Body() dto: Omit<CreateAuditEvidenceDto, 'test_id' | 'related_entity_type' | 'related_entity_id'>,
    @Tenant() tenantId: string,
  ) {
    return this.service.addEvidenceToFinding(findingId, dto, tenantId);
  }

  // Finding Links
  @Post('findings/:id/link-policy/:policyId')
  @ApiOperation({
    summary: 'Link finding to policy',
    description: 'Link an audit finding to a policy',
  })
  @ApiOkResponse({ description: 'Finding linked to policy' })
  @HttpCode(HttpStatus.OK)
  async linkFindingToPolicy(
    @Param('id') id: string,
    @Param('policyId') policyId: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.linkFindingToPolicy(id, policyId, tenantId);
  }

  @Post('findings/:id/link-clause/:clauseId')
  @ApiOperation({
    summary: 'Link finding to clause',
    description: 'Link an audit finding to a compliance clause',
  })
  @ApiOkResponse({ description: 'Finding linked to clause' })
  @HttpCode(HttpStatus.OK)
  async linkFindingToClause(
    @Param('id') id: string,
    @Param('clauseId') clauseId: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.linkFindingToClause(id, clauseId, tenantId);
  }

  @Post('findings/:id/link-control/:controlId')
  @ApiOperation({
    summary: 'Link finding to control',
    description: 'Link an audit finding to a control',
  })
  @ApiOkResponse({ description: 'Finding linked to control' })
  @HttpCode(HttpStatus.OK)
  async linkFindingToControl(
    @Param('id') id: string,
    @Param('controlId') controlId: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.linkFindingToControl(id, controlId, tenantId);
  }

  @Post('findings/:id/link-risk/:riskInstanceId')
  @ApiOperation({
    summary: 'Link finding to risk instance',
    description: 'Link an audit finding to a risk instance',
  })
  @ApiOkResponse({ description: 'Finding linked to risk instance' })
  @HttpCode(HttpStatus.OK)
  async linkFindingToRisk(
    @Param('id') id: string,
    @Param('riskInstanceId') riskInstanceId: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.linkFindingToRisk(id, riskInstanceId, tenantId);
  }

  // Unlink endpoints
  @Delete('findings/:id/link-policy')
  @ApiOperation({
    summary: 'Unlink finding from policy',
    description: 'Unlink an audit finding from a policy',
  })
  @ApiOkResponse({ description: 'Finding unlinked from policy' })
  @HttpCode(HttpStatus.OK)
  async unlinkFindingFromPolicy(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.unlinkFindingFromPolicy(id, tenantId);
  }

  @Delete('findings/:id/link-clause')
  @ApiOperation({
    summary: 'Unlink finding from clause',
    description: 'Unlink an audit finding from a compliance clause',
  })
  @ApiOkResponse({ description: 'Finding unlinked from clause' })
  @HttpCode(HttpStatus.OK)
  async unlinkFindingFromClause(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.unlinkFindingFromClause(id, tenantId);
  }

  @Delete('findings/:id/link-control')
  @ApiOperation({
    summary: 'Unlink finding from control',
    description: 'Unlink an audit finding from a control',
  })
  @ApiOkResponse({ description: 'Finding unlinked from control' })
  @HttpCode(HttpStatus.OK)
  async unlinkFindingFromControl(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.unlinkFindingFromControl(id, tenantId);
  }

  @Delete('findings/:id/link-risk')
  @ApiOperation({
    summary: 'Unlink finding from risk instance',
    description: 'Unlink an audit finding from a risk instance',
  })
  @ApiOkResponse({ description: 'Finding unlinked from risk instance' })
  @HttpCode(HttpStatus.OK)
  async unlinkFindingFromRisk(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.unlinkFindingFromRisk(id, tenantId);
  }

  @Post('findings/:id/link-bia-process/:biaProcessId')
  @ApiOperation({
    summary: 'Link finding to BIA process',
    description: 'Link an audit finding to a BIA process',
  })
  @ApiOkResponse({ description: 'Finding linked to BIA process' })
  @HttpCode(HttpStatus.OK)
  async linkFindingToBIAProcess(
    @Param('id') id: string,
    @Param('biaProcessId') biaProcessId: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.linkFindingToBIAProcess(id, biaProcessId, tenantId);
  }

  @Delete('findings/:id/link-bia-process')
  @ApiOperation({
    summary: 'Unlink finding from BIA process',
    description: 'Unlink an audit finding from a BIA process',
  })
  @ApiOkResponse({ description: 'Finding unlinked from BIA process' })
  @HttpCode(HttpStatus.OK)
  async unlinkFindingFromBIAProcess(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.unlinkFindingFromBIAProcess(id, tenantId);
  }

  // Engagement Summary
  @Get('engagements/:id/summary')
  @ApiOperation({
    summary: 'Get engagement summary',
    description: 'Get summary statistics for an audit engagement',
  })
  @ApiOkResponse({ description: 'Engagement summary' })
  @ApiParam({ name: 'id', description: 'Engagement ID' })
  async getEngagementSummary(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.getEngagementSummary(id, tenantId);
  }

  // Corrective Actions (CAP)
  @Get('caps')
  @ApiOperation({
    summary: 'List corrective actions',
    description: 'Get paginated list of corrective actions (CAPs)',
  })
  @ApiOkResponse({ description: 'List of CAPs' })
  async listCAPs(
    @Query() query: QueryCorrectiveActionDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.listCAPs(tenantId, query);
  }

  @Get('caps/:id')
  @ApiOperation({
    summary: 'Get corrective action',
    description: 'Get single CAP by ID',
  })
  @ApiOkResponse({ description: 'CAP details' })
  @ApiParam({ name: 'id', description: 'CAP ID' })
  async getCAP(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getCAP(id, tenantId);
  }

  @Post('caps')
  @ApiOperation({
    summary: 'Create corrective action',
    description: 'Create a new CAP',
  })
  @ApiCreatedResponse({ description: 'Created CAP' })
  @HttpCode(HttpStatus.CREATED)
  async createCAP(
    @Body() dto: CreateCorrectiveActionDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createCAP(dto, tenantId);
  }

  @Put('caps/:id')
  @ApiOperation({
    summary: 'Update corrective action',
    description: 'Update CAP',
  })
  @ApiOkResponse({ description: 'Updated CAP' })
  @ApiParam({ name: 'id', description: 'CAP ID' })
  async updateCAP(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCorrectiveActionDto>,
    @Tenant() tenantId: string,
  ) {
    return this.service.updateCAP(id, dto, tenantId);
  }

  // CAP Status Transition
  @Patch('caps/:id/status')
  @ApiOperation({
    summary: 'Transition CAP status',
    description: 'Transition CAP status (open ↔ in_progress ↔ done)',
  })
  @ApiOkResponse({ description: 'CAP status transitioned' })
  @ApiParam({ name: 'id', description: 'CAP ID' })
  @HttpCode(HttpStatus.OK)
  async transitionCAPStatus(
    @Param('id') id: string,
    @Body('status') newStatus: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.transitionCAPStatus(id, newStatus as any, tenantId);
  }

  @Post('caps/:id/evidence')
  @ApiOperation({
    summary: 'Add evidence to corrective action',
    description: 'Add evidence to a corrective action',
  })
  @ApiCreatedResponse({ description: 'Evidence added to corrective action' })
  @ApiParam({ name: 'id', description: 'Corrective Action ID' })
  @HttpCode(HttpStatus.CREATED)
  async addEvidenceToCorrectiveAction(
    @Param('id') capId: string,
    @Body() dto: Omit<CreateAuditEvidenceDto, 'test_id' | 'related_entity_type' | 'related_entity_id'>,
    @Tenant() tenantId: string,
  ) {
    return this.service.addEvidenceToCorrectiveAction(capId, dto, tenantId);
  }
}
