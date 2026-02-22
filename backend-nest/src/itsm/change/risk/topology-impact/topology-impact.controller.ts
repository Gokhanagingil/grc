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
import { RcaOrchestrationService } from './rca-orchestration.service';
import { SuggestedTaskPackService } from './suggested-task-pack.service';
import { TraceabilitySummaryService } from './traceability-summary.service';
import { ChangeService } from '../../change.service';
import { MajorIncidentService } from '../../../major-incident/major-incident.service';
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
 * - GET  /grc/itsm/major-incidents/:id/rca-topology-hypotheses
 * - POST /grc/itsm/major-incidents/:id/rca-topology-hypotheses/recalculate
 * - POST /grc/itsm/major-incidents/:id/rca-create-problem
 * - POST /grc/itsm/major-incidents/:id/rca-create-known-error
 * - POST /grc/itsm/major-incidents/:id/rca-create-pir-action
 * - GET  /grc/itsm/changes/:id/suggested-task-pack
 * - GET  /grc/itsm/changes/:id/traceability-summary
 * - GET  /grc/itsm/major-incidents/:id/traceability-summary
 */
@Controller('grc/itsm')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class TopologyImpactController {
  private readonly logger = new Logger(TopologyImpactController.name);

  constructor(
    private readonly topologyImpactService: TopologyImpactAnalysisService,
    private readonly rcaOrchestrationService: RcaOrchestrationService,
    private readonly suggestedTaskPackService: SuggestedTaskPackService,
    private readonly traceabilitySummaryService: TraceabilitySummaryService,
    private readonly changeService: ChangeService,
    private readonly majorIncidentService: MajorIncidentService,
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

  // ==========================================================================
  // Suggested Task Pack (Phase 3)
  // ==========================================================================

  /**
   * Get a suggested task pack for a change based on topology impact + risk level.
   * Returns categorized, topology-driven operational task suggestions.
   */
  @Get('changes/:id/suggested-task-pack')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async getSuggestedTaskPack(
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

    const pack = await this.suggestedTaskPackService.generateTaskPack(
      tenantId,
      change.id,
    );

    return { data: pack };
  }

  // ==========================================================================
  // Closed-Loop Traceability Summary (Phase 3)
  // ==========================================================================

  /**
   * Get closed-loop traceability summary for a change.
   * Returns topology analysis → governance → approvals → tasks → outcomes chain.
   */
  @Get('changes/:id/traceability-summary')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async getChangeTraceability(
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

    const summary =
      await this.traceabilitySummaryService.getChangeTraceability(
        tenantId,
        change.id,
      );

    return { data: summary };
  }

  /**
   * Get closed-loop traceability summary for a major incident.
   * Returns RCA analysis → hypotheses → orchestrated records chain.
   */
  @Get('major-incidents/:id/traceability-summary')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_READ)
  @Perf()
  async getMajorIncidentTraceability(
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

    const summary =
      await this.traceabilitySummaryService.getMajorIncidentTraceability(
        tenantId,
        id,
      );

    return { data: summary };
  }
}
