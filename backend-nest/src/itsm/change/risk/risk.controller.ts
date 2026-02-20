import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { RiskScoringService } from './risk-scoring.service';
import { PolicyService } from './policy.service';
import { ChangeService } from '../change.service';

@Controller('grc/itsm/changes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class RiskController {
  constructor(
    private readonly riskScoringService: RiskScoringService,
    private readonly policyService: PolicyService,
    private readonly changeService: ChangeService,
  ) {}

  @Get(':changeId/risk')
  @Permissions(Permission.ITSM_CHANGE_READ)
  async getRiskAssessment(
    @Param('changeId') changeId: string,
    @Req() req: { tenantId: string },
  ) {
    const assessment = await this.riskScoringService.getAssessment(
      req.tenantId,
      changeId,
    );

    return { data: assessment };
  }

  @Post(':changeId/recalculate-risk')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.OK)
  async recalculateRisk(
    @Param('changeId') changeId: string,
    @Req() req: { tenantId: string; user: { id: string } },
  ) {
    const change = await this.changeService.findOneActiveForTenant(
      req.tenantId,
      changeId,
    );
    if (!change) {
      throw new NotFoundException(`Change ${changeId} not found`);
    }

    const assessment = await this.riskScoringService.calculateRisk(
      req.tenantId,
      req.user.id,
      change,
    );

    const policyEvaluation = await this.policyService.evaluatePolicies(
      req.tenantId,
      change,
      assessment,
    );

    return {
      data: {
        assessment,
        policyEvaluation,
      },
    };
  }
}
