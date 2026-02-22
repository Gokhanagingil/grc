import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Headers,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { Perf } from '../../../common/decorators';
import { TopologyService } from './topology.service';
import { TopologyQueryDto } from './dto/topology-query.dto';

/**
 * CMDB Topology Controller
 *
 * Read-only endpoints for fetching topology graph data centered on
 * a CI or a Service. Designed as the foundation for:
 * - Change risk assessment / blast radius visualization
 * - Major incident root cause analysis (RCA)
 *
 * Route: grc/cmdb/topology
 */
@Controller('grc/cmdb/topology')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class TopologyController {
  constructor(private readonly topologyService: TopologyService) {}

  /**
   * Get topology graph centered on a specific CI.
   *
   * @param tenantId - Tenant ID from header
   * @param ciId - CI UUID
   * @param query - Topology query params (depth, relationTypes, direction, etc.)
   */
  @Get('ci/:ciId')
  @Permissions(Permission.CMDB_CI_READ)
  @Perf()
  async getTopologyForCi(
    @Headers('x-tenant-id') tenantId: string,
    @Param('ciId') ciId: string,
    @Query() query: TopologyQueryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!ciId) {
      throw new BadRequestException('ciId parameter is required');
    }

    const result = await this.topologyService.getTopologyForCi(
      tenantId,
      ciId,
      query,
    );

    if (
      result.nodes.length === 0 &&
      result.meta.warnings.includes('Root node not found')
    ) {
      throw new NotFoundException(`CI with ID ${ciId} not found`);
    }

    return result;
  }

  /**
   * Get topology graph centered on a specific CMDB Service.
   *
   * @param tenantId - Tenant ID from header
   * @param serviceId - Service UUID
   * @param query - Topology query params (depth, relationTypes, direction, etc.)
   */
  @Get('service/:serviceId')
  @Permissions(Permission.CMDB_CI_READ)
  @Perf()
  async getTopologyForService(
    @Headers('x-tenant-id') tenantId: string,
    @Param('serviceId') serviceId: string,
    @Query() query: TopologyQueryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!serviceId) {
      throw new BadRequestException('serviceId parameter is required');
    }

    const result = await this.topologyService.getTopologyForService(
      tenantId,
      serviceId,
      query,
    );

    if (
      result.nodes.length === 0 &&
      result.meta.warnings.includes('Root node not found')
    ) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    return result;
  }
}
