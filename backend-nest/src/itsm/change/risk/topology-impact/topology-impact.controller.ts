import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Headers,
  Request,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../../auth/permissions/permission.enum';
import { Perf } from '../../../../common/decorators';
import { TopologyImpactAnalysisService } from './topology-impact-analysis.service';
import { TopologyGovernanceService } from './topology-governance.service';
import { RcaOrchestrationService } from './rca-orchestration.service';
import { ChangeService } from '../../change.service';
import { MajorIncidentService } from '../../../major-incident/major-incident.service';
import { RiskScoringService } from '../risk-scoring.service';
import {
  CustomerRiskImpactService,
  CustomerRiskImpactResult,
} from '../customer-risk-impact.service';
import {
  CreateProblemFromHypothesisDto,
  CreateKnownErrorFromHypothesisDto,
  CreatePirActionFromHypothesisDto,
} from './dto/rca-orchestration.dto';

/**
 * Topology Impact Controller
 *
 * Endpoints for topology-driven change risk assessment,
 * major incident RCA hypothesis generation, and
 * RCA orchestration (create Problem/KE/PIR Action from hypothesis).
 *
 * Routes:
 * - GET  /grc/itsm/changes/:id/topology-impact
 * - POST /grc/itsm/changes/:id/recalculate-topology-impact
 * - POST /grc/itsm/changes/:id/evaluate-topology-governance
 * - GET  /grc/itsm/major-incidents/:id/rca-topology-hypotheses
 * - POST /grc/itsm/major-incidents/:id/rca-topology-hypotheses/recalculate
 * - POST /grc/itsm/major-incidents/:id/rca-create-problem
 * - POST /grc/itsm/major-incidents/:id/rca-create-known-error
 * - POST /grc/itsm/major-incidents/:id/rca-create-pir-action
 */
@Controller('grc/itsm')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class TopologyImpactController {
  private readonly logger = new Logger(TopologyImpactController.name);

  constructor(
    private readonly topologyImpactService: TopologyImpactAnalysisService,
    private readonly topologyGovernanceService: TopologyGovernanceService,
    private readonly rcaOrchestrationService: RcaOrchestrationService,
    private readonly changeService: ChangeService,
    private readonly majorIncidentService: MajorIncidentService,
    private readonly riskScoringService: RiskScoringService,
    private readonly customerRiskImpactService: CustomerRiskImpactService,
  ) {}

  // ==========================================================================
  // Change Topology Impact
  // ==========================================================================

  /**
   * Get cached/latest topology impact analysis for a change.
   * Returns the topology-based blast radius metrics, impacted nodes,
   * fragility signals, and risk explanation.
   */
  @Get('changes/:id/topology-impact')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async getTopologyImpact(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const change = await this.changeService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!change) {
      throw new NotFoundException(`Change with ID ${id} not found`);
    }

    const impact = await this.topologyImpactService.calculateTopologyImpact(
      tenantId,
      change,
    );

    return { data: impact };
  }

  /**
   * Recalculate topology impact for a change.
   * Forces a fresh analysis of the blast radius based on current topology.
   */
  @Post('changes/:id/recalculate-topology-impact')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async recalculateTopologyImpact(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const change = await this.changeService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!change) {
      throw new NotFoundException(`Change with ID ${id} not found`);
    }

    const impact = await this.topologyImpactService.calculateTopologyImpact(
      tenantId,
      change,
    );

    return { data: impact };
  }

  // ==========================================================================
  // Topology Governance Evaluation
  // ==========================================================================

  /**
   * Evaluate topology-aware governance for a change.
   * Returns governance decision, explainability, and recommended actions.
   */
  @Post('changes/:id/evaluate-topology-governance')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async evaluateTopologyGovernance(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const change = await this.changeService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!change) {
      throw new NotFoundException(`Change with ID ${id} not found`);
    }

    // Fetch risk assessment (fail-open)
    let assessment: Awaited<ReturnType<RiskScoringService['getAssessment']>> | null = null;
    try {
      assessment = await this.riskScoringService.getAssessment(tenantId, id);
    } catch (err) {
      this.logger.warn(`Risk assessment fetch failed for change ${id}: ${String(err)}`);
    }

    // Fetch customer risk impact (fail-open)
    let customerRiskImpact: CustomerRiskImpactResult | null = null;
    try {
      customerRiskImpact = await this.customerRiskImpactService.evaluateForChange(
        tenantId,
        change,
      );
    } catch (err) {
      this.logger.warn(`Customer risk impact fetch failed for change ${id}: ${String(err)}`);
    }

    const result = await this.topologyGovernanceService.evaluateGovernance(
      tenantId,
      req.user.id,
      change,
      assessment,
      customerRiskImpact,
    );

    return { data: result };
  }

  // ==========================================================================
  // Major Incident RCA Topology Hypotheses
  // ==========================================================================

  /**
   * Get RCA topology hypotheses for a major incident.
   * Returns ranked, deterministic, rule-based root cause hypotheses
   * with evidence and recommended follow-up actions.
   */
  @Get('major-incidents/:id/rca-topology-hypotheses')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_READ)
  @Perf()
  async getRcaTopologyHypotheses(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const mi = await this.majorIncidentService.findOne(tenantId, id);
    if (!mi) {
      throw new NotFoundException(`Major Incident with ID ${id} not found`);
    }

    const result = await this.topologyImpactService.generateRcaHypotheses(
      tenantId,
      mi,
    );

    return { data: result };
  }

  /**
   * Recalculate RCA topology hypotheses for a major incident.
   * Forces a fresh analysis based on current topology and linked records.
   */
  @Post('major-incidents/:id/rca-topology-hypotheses/recalculate')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async recalculateRcaTopologyHypotheses(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const mi = await this.majorIncidentService.findOne(tenantId, id);
    if (!mi) {
      throw new NotFoundException(`Major Incident with ID ${id} not found`);
    }

    const result = await this.topologyImpactService.generateRcaHypotheses(
      tenantId,
      mi,
    );

    return { data: result };
  }

  // ==========================================================================
  // RCA Orchestration — Create records from hypotheses
  // ==========================================================================

  /**
   * Create a Problem record from an RCA topology hypothesis.
   * Preserves traceability metadata and writes journal entry.
   */
  @Post('major-incidents/:id/rca-create-problem')
  @Permissions(Permission.ITSM_PROBLEM_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createProblemFromHypothesis(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') majorIncidentId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateProblemFromHypothesisDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Ensure MI ID in path matches body
    if (dto.majorIncidentId !== majorIncidentId) {
      throw new BadRequestException(
        'majorIncidentId in body must match the :id URL parameter',
      );
    }

    const result =
      await this.rcaOrchestrationService.createProblemFromHypothesis(
        tenantId,
        req.user.id,
        dto,
      );

    return { data: result };
  }

  /**
   * Create a Known Error record from an RCA topology hypothesis.
   * Preserves traceability metadata and writes journal entry.
   */
  @Post('major-incidents/:id/rca-create-known-error')
  @Permissions(Permission.ITSM_KNOWN_ERROR_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createKnownErrorFromHypothesis(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') majorIncidentId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateKnownErrorFromHypothesisDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (dto.majorIncidentId !== majorIncidentId) {
      throw new BadRequestException(
        'majorIncidentId in body must match the :id URL parameter',
      );
    }

    const result =
      await this.rcaOrchestrationService.createKnownErrorFromHypothesis(
        tenantId,
        req.user.id,
        dto,
      );

    return { data: result };
  }

  /**
   * Create a PIR Action from an RCA topology hypothesis.
   * Preserves traceability metadata and writes journal entry.
   */
  @Post('major-incidents/:id/rca-create-pir-action')
  @Permissions(Permission.ITSM_PIR_ACTION_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createPirActionFromHypothesis(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') majorIncidentId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreatePirActionFromHypothesisDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (dto.majorIncidentId !== majorIncidentId) {
      throw new BadRequestException(
        'majorIncidentId in body must match the :id URL parameter',
      );
    }

    const result =
      await this.rcaOrchestrationService.createPirActionFromHypothesis(
        tenantId,
        req.user.id,
        dto,
      );

    return { data: result };
  }
}
