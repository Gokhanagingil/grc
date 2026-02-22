import {
  Controller,
  Get,
  Post,
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
import { ChangeService } from '../../change.service';
import { MajorIncidentService } from '../../../major-incident/major-incident.service';

/**
 * Topology Impact Controller
 *
 * Endpoints for topology-driven change risk assessment and
 * major incident RCA hypothesis generation.
 *
 * Routes:
 * - GET  /grc/itsm/changes/:id/topology-impact
 * - POST /grc/itsm/changes/:id/recalculate-topology-impact
 * - GET  /grc/itsm/major-incidents/:id/rca-topology-hypotheses
 * - POST /grc/itsm/major-incidents/:id/rca-topology-hypotheses/recalculate
 */
@Controller('grc/itsm')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class TopologyImpactController {
  private readonly logger = new Logger(TopologyImpactController.name);

  constructor(
    private readonly topologyImpactService: TopologyImpactAnalysisService,
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
}
