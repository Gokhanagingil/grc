import {
  Controller,
  Get,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { OnboardingContextService } from '../services/onboarding-context.service';
import { PolicyEvaluatorService } from '../services/policy-evaluator.service';
import { OnboardingContextWithPolicyDto } from '../dto';

@Controller('onboarding')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingContextService: OnboardingContextService,
    private readonly policyEvaluatorService: PolicyEvaluatorService,
  ) {}

  @Get('context')
  async getContext(
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<OnboardingContextWithPolicyDto> {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const context =
      await this.onboardingContextService.getOnboardingContext(tenantId);
    const policy = this.policyEvaluatorService.evaluate(context);

    return {
      context,
      policy,
    };
  }
}
