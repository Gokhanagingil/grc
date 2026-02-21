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
import { PolicyService, PolicyEvaluationSummary } from './policy.service';
import { ChangeService } from '../change.service';
import {
  CustomerRiskImpactService,
  CustomerRiskImpactResult,
} from './customer-risk-impact.service';
import { EventBusService } from '../../../event-bus/event-bus.service';

@Controller('grc/itsm/changes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class RiskController {
  constructor(
    private readonly riskScoringService: RiskScoringService,
    private readonly policyService: PolicyService,
    private readonly changeService: ChangeService,
    private readonly customerRiskImpactService: CustomerRiskImpactService,
    private readonly eventBusService: EventBusService,
  ) {}

  @Get(':changeId/risk')
  @Permissions(Permission.ITSM_CHANGE_READ)
  async getRiskAssessment(
    @Param('changeId') changeId: string,
    @Req() req: { tenantId: string },
  ) {
    const change = await this.changeService.findOneActiveForTenant(
      req.tenantId,
      changeId,
    );

    const assessment = await this.riskScoringService.getAssessment(
      req.tenantId,
      changeId,
    );

    // Include policy evaluation with customer risk context when change exists
    let policyEvaluation: PolicyEvaluationSummary | null = null;
    if (change) {
      let customerRiskImpact: CustomerRiskImpactResult | null = null;
      try {
        customerRiskImpact =
          await this.customerRiskImpactService.evaluateForChange(
            req.tenantId,
            change,
          );
      } catch {
        // Customer risk impact is optional; do not block risk response
      }
      policyEvaluation = await this.policyService.evaluatePolicies(
        req.tenantId,
        change,
        assessment,
        customerRiskImpact,
      );
    }

    return { data: { assessment, policyEvaluation } };
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

    // Evaluate customer risk impact for policy context
    let customerRiskImpact: CustomerRiskImpactResult | null = null;
    try {
      customerRiskImpact =
        await this.customerRiskImpactService.evaluateForChange(
          req.tenantId,
          change,
        );
    } catch {
      // Customer risk impact is optional
    }

    const policyEvaluation = await this.policyService.evaluatePolicies(
      req.tenantId,
      change,
      assessment,
      customerRiskImpact,
    );

    return {
      data: {
        assessment,
        policyEvaluation,
      },
    };
  }

  @Get(':changeId/customer-risk-impact')
  @Permissions(
    Permission.ITSM_CHANGE_READ,
    Permission.GRC_CUSTOMER_RISK_READ,
    Permission.GRC_CUSTOMER_RISK_BIND_READ,
    Permission.GRC_CUSTOMER_RISK_OBSERVATION_READ,
  )
  async getCustomerRiskImpact(
    @Param('changeId') changeId: string,
    @Req() req: { tenantId: string },
  ) {
    const change = await this.changeService.findOneActiveForTenant(
      req.tenantId,
      changeId,
    );
    if (!change) {
      throw new NotFoundException(`Change ${changeId} not found`);
    }

    const impact = await this.customerRiskImpactService.evaluateForChange(
      req.tenantId,
      change,
    );

    return { data: impact };
  }

  @Post(':changeId/recalculate-customer-risk')
  @Permissions(
    Permission.ITSM_CHANGE_WRITE,
    Permission.GRC_CUSTOMER_RISK_READ,
    Permission.GRC_CUSTOMER_RISK_BIND_READ,
    Permission.GRC_CUSTOMER_RISK_OBSERVATION_READ,
  )
  @HttpCode(HttpStatus.OK)
  async recalculateCustomerRisk(
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

    const impact = await this.customerRiskImpactService.evaluateForChange(
      req.tenantId,
      change,
    );

    const assessment = await this.riskScoringService.calculateRisk(
      req.tenantId,
      req.user.id,
      change,
    );

    const policyEvaluation = await this.policyService.evaluatePolicies(
      req.tenantId,
      change,
      assessment,
      impact,
    );

    // Emit event for customer risk recalculation
    await this.eventBusService.emit({
      tenantId: req.tenantId,
      source: 'itsm.change.customer_risk',
      eventName: 'itsm.change.customer_risk.recalculated',
      tableName: 'itsm_changes',
      recordId: changeId,
      actorId: req.user.id,
      payload: {
        changeNumber: change.number,
        changeTitle: change.title,
        aggregateScore: impact.aggregateScore,
        aggregateLabel: impact.aggregateLabel,
        resolvedRiskCount: impact.resolvedRisks.length,
        decisionRecommendation: policyEvaluation.decisionRecommendation,
      },
    });

    // Emit policy triggered event if governance action is required
    if (
      policyEvaluation.decisionRecommendation !== 'ALLOW' &&
      policyEvaluation.rulesTriggered.length > 0
    ) {
      await this.eventBusService.emit({
        tenantId: req.tenantId,
        source: 'itsm.change.customer_risk',
        eventName: 'itsm.change.customer_risk.policy_triggered',
        tableName: 'itsm_changes',
        recordId: changeId,
        actorId: req.user.id,
        payload: {
          changeNumber: change.number,
          decisionRecommendation: policyEvaluation.decisionRecommendation,
          rulesTriggered: policyEvaluation.rulesTriggered.map((r) => ({
            policyId: r.policyId,
            policyName: r.policyName,
          })),
          requiredActions: policyEvaluation.requiredActions,
        },
      });
    }

    return {
      data: {
        customerRiskImpact: impact,
        assessment,
        policyEvaluation,
      },
    };
  }
}
