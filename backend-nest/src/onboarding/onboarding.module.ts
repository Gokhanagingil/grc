import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';

import {
  TenantInitializationProfile,
  TenantActiveSuite,
  TenantEnabledModule,
  TenantActiveFramework,
  TenantMaturityProfile,
  OnboardingDecision,
} from './entities';

import { GrcTenantFramework } from '../grc/entities/grc-tenant-framework.entity';

import { OnboardingContextService, PolicyEvaluatorService } from './services';

import { OnboardingController } from './controllers';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantInitializationProfile,
      TenantActiveSuite,
      TenantEnabledModule,
      TenantActiveFramework,
      TenantMaturityProfile,
      OnboardingDecision,
      GrcTenantFramework,
    ]),
    AuthModule,
    TenantsModule,
  ],
  providers: [OnboardingContextService, PolicyEvaluatorService],
  controllers: [OnboardingController],
  exports: [OnboardingContextService, PolicyEvaluatorService],
})
export class OnboardingModule {}
