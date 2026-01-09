import {
  Controller,
  Get,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { DataSource } from 'typeorm';
import { GrcControl } from '../entities/grc-control.entity';
import { GrcRequirement } from '../entities/grc-requirement.entity';
import { Process } from '../entities/process.entity';
import { GrcRequirementControl } from '../entities/grc-requirement-control.entity';
import { GrcControlProcess } from '../entities/grc-control-process.entity';
import { Perf } from '../../common/decorators';

interface CountResult {
  count: string;
}

interface RequirementRawResult {
  req_id: string;
  req_title: string;
  req_referenceCode: string;
  req_status: string;
  controlCount: string;
}

interface ProcessRawResult {
  proc_id: string;
  proc_name: string;
  proc_code: string;
  proc_isActive: string;
  controlCount: string;
}

/**
 * GRC Coverage Controller
 *
 * Provides coverage statistics for requirements and processes.
 * All endpoints require JWT authentication and tenant context.
 * Read operations require GRC_CONTROL_READ permission.
 */
@Controller('grc/coverage')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcCoverageController {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * GET /grc/coverage
   * Get coverage statistics for the current tenant
   *
   * Returns:
   * - requirementCoverage: percentage of requirements with at least one control
   * - processCoverage: percentage of processes with at least one control
   * - unlinkedControlsCount: count of controls with no requirement AND no process links
   * - totalRequirements: total count of requirements
   * - coveredRequirements: count of requirements with at least one control
   * - totalProcesses: total count of processes
   * - coveredProcesses: count of processes with at least one control
   * - totalControls: total count of controls
   */
  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  @Perf()
  async getCoverage(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const controlRepo = this.dataSource.getRepository(GrcControl);
    const requirementRepo = this.dataSource.getRepository(GrcRequirement);
    const processRepo = this.dataSource.getRepository(Process);
    const reqControlRepo = this.dataSource.getRepository(GrcRequirementControl);
    const controlProcessRepo = this.dataSource.getRepository(GrcControlProcess);

    // Get total counts
    const totalControls = await controlRepo.count({
      where: { tenantId, isDeleted: false },
    });

    const totalRequirements = await requirementRepo.count({
      where: { tenantId, isDeleted: false },
    });

    const totalProcesses = await processRepo.count({
      where: { tenantId, isDeleted: false },
    });

    // Get covered requirements (requirements with at least one control)
    const coveredRequirementsResult = await reqControlRepo
      .createQueryBuilder('rc')
      .select('COUNT(DISTINCT rc.requirement_id)', 'count')
      .where('rc.tenant_id = :tenantId', { tenantId })
      .getRawOne<CountResult>();
    const coveredRequirements = parseInt(
      coveredRequirementsResult?.count || '0',
      10,
    );

    // Get covered processes (processes with at least one control)
    const coveredProcessesResult = await controlProcessRepo
      .createQueryBuilder('cp')
      .select('COUNT(DISTINCT cp.process_id)', 'count')
      .where('cp.tenant_id = :tenantId', { tenantId })
      .getRawOne<CountResult>();
    const coveredProcesses = parseInt(coveredProcessesResult?.count || '0', 10);

    // Get unlinked controls count (no requirement AND no process links)
    const unlinkedControlsResult = await controlRepo
      .createQueryBuilder('control')
      .where('control.tenantId = :tenantId', { tenantId })
      .andWhere('control.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        `control.id NOT IN (
          SELECT rc.control_id FROM grc_requirement_controls rc 
          WHERE rc.tenant_id = :tenantId
        )`,
        { tenantId },
      )
      .andWhere(
        `control.id NOT IN (
          SELECT cp.control_id FROM grc_control_processes cp 
          WHERE cp.tenant_id = :tenantId
        )`,
        { tenantId },
      )
      .getCount();

    // Calculate coverage percentages
    const requirementCoverage =
      totalRequirements > 0
        ? Math.round((coveredRequirements / totalRequirements) * 100)
        : 0;

    const processCoverage =
      totalProcesses > 0
        ? Math.round((coveredProcesses / totalProcesses) * 100)
        : 0;

    return {
      requirementCoverage,
      processCoverage,
      unlinkedControlsCount: unlinkedControlsResult,
      totalRequirements,
      coveredRequirements,
      totalProcesses,
      coveredProcesses,
      totalControls,
    };
  }

  /**
   * GET /grc/coverage/requirements
   * Get detailed requirement coverage breakdown
   */
  @Get('requirements')
  @Permissions(Permission.GRC_CONTROL_READ)
  @Perf()
  async getRequirementCoverage(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const requirementRepo = this.dataSource.getRepository(GrcRequirement);

    // Get all requirements with their control counts
    const requirements = await requirementRepo
      .createQueryBuilder('req')
      .leftJoin('req.requirementControls', 'rc')
      .select([
        'req.id',
        'req.title',
        'req.referenceCode',
        'req.status',
        'COUNT(rc.id) as controlCount',
      ])
      .where('req.tenantId = :tenantId', { tenantId })
      .andWhere('req.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('req.id')
      .addGroupBy('req.title')
      .addGroupBy('req.referenceCode')
      .addGroupBy('req.status')
      .getRawMany<RequirementRawResult>();

    const covered = requirements.filter(
      (r: RequirementRawResult) => parseInt(r.controlCount, 10) > 0,
    );
    const uncovered = requirements.filter(
      (r: RequirementRawResult) => parseInt(r.controlCount, 10) === 0,
    );

    return {
      total: requirements.length,
      covered: covered.length,
      uncovered: uncovered.length,
      coveragePercent:
        requirements.length > 0
          ? Math.round((covered.length / requirements.length) * 100)
          : 0,
      requirements: requirements.map((r: RequirementRawResult) => ({
        id: r.req_id,
        title: r.req_title,
        referenceCode: r.req_referenceCode,
        status: r.req_status,
        controlCount: parseInt(r.controlCount, 10),
        isCovered: parseInt(r.controlCount, 10) > 0,
      })),
    };
  }

  /**
   * GET /grc/coverage/processes
   * Get detailed process coverage breakdown
   */
  @Get('processes')
  @Permissions(Permission.GRC_CONTROL_READ)
  @Perf()
  async getProcessCoverage(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const processRepo = this.dataSource.getRepository(Process);

    // Get all processes with their control counts
    const processes = await processRepo
      .createQueryBuilder('proc')
      .leftJoin('proc.controlProcesses', 'cp')
      .select([
        'proc.id',
        'proc.name',
        'proc.code',
        'proc.isActive',
        'COUNT(cp.id) as controlCount',
      ])
      .where('proc.tenantId = :tenantId', { tenantId })
      .andWhere('proc.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('proc.id')
      .addGroupBy('proc.name')
      .addGroupBy('proc.code')
      .addGroupBy('proc.isActive')
      .getRawMany<ProcessRawResult>();

    const covered = processes.filter(
      (p: ProcessRawResult) => parseInt(p.controlCount, 10) > 0,
    );
    const uncovered = processes.filter(
      (p: ProcessRawResult) => parseInt(p.controlCount, 10) === 0,
    );

    return {
      total: processes.length,
      covered: covered.length,
      uncovered: uncovered.length,
      coveragePercent:
        processes.length > 0
          ? Math.round((covered.length / processes.length) * 100)
          : 0,
      processes: processes.map((p: ProcessRawResult) => ({
        id: p.proc_id,
        name: p.proc_name,
        code: p.proc_code,
        isActive: p.proc_isActive === 'true' || p.proc_isActive === '1',
        controlCount: parseInt(p.controlCount, 10),
        isCovered: parseInt(p.controlCount, 10) > 0,
      })),
    };
  }
}
