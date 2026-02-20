import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../../auth/auth.module';
import { TenantsModule } from '../../../tenants/tenants.module';
import { EventBusModule } from '../../../event-bus/event-bus.module';

import { CmdbCi } from '../ci/ci.entity';
import { CmdbCiRel } from '../ci-rel/ci-rel.entity';

import { CmdbHealthRule } from './cmdb-health-rule.entity';
import { CmdbHealthFinding } from './cmdb-health-finding.entity';
import { CmdbQualitySnapshot } from './cmdb-quality-snapshot.entity';

import { HealthRuleService } from './health-rule.service';
import { HealthFindingService } from './health-finding.service';
import { QualitySnapshotService } from './quality-snapshot.service';
import { HealthEvaluationService } from './health-evaluation.service';

import { HealthRuleController } from './health-rule.controller';
import { HealthFindingController } from './health-finding.controller';
import { QualityController } from './quality.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CmdbHealthRule,
      CmdbHealthFinding,
      CmdbQualitySnapshot,
      CmdbCi,
      CmdbCiRel,
    ]),
    AuthModule,
    TenantsModule,
    EventBusModule,
  ],
  providers: [
    HealthRuleService,
    HealthFindingService,
    QualitySnapshotService,
    HealthEvaluationService,
  ],
  controllers: [
    HealthRuleController,
    HealthFindingController,
    QualityController,
  ],
  exports: [
    HealthRuleService,
    HealthFindingService,
    QualitySnapshotService,
    HealthEvaluationService,
  ],
})
export class CmdbHealthModule {}
