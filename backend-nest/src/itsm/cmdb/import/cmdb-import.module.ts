import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../../auth/auth.module';
import { TenantsModule } from '../../../tenants/tenants.module';
import { CmdbModule } from '../cmdb.module';
import { EventBusModule } from '../../../event-bus/event-bus.module';

import { CmdbImportSource } from './cmdb-import-source.entity';
import { CmdbImportJob } from './cmdb-import-job.entity';
import { CmdbImportRow } from './cmdb-import-row.entity';
import { CmdbReconcileRule } from './cmdb-reconcile-rule.entity';
import { CmdbReconcileResult } from './cmdb-reconcile-result.entity';

import { ImportSourceService } from './import-source.service';
import { ImportJobService } from './import-job.service';
import { ReconcileRuleService } from './reconcile-rule.service';
import { CmdbSchedulerService } from './cmdb-scheduler.service';

import { ImportSourceController } from './import-source.controller';
import { ImportJobController } from './import-job.controller';
import { ReconcileRuleController } from './reconcile-rule.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CmdbImportSource,
      CmdbImportJob,
      CmdbImportRow,
      CmdbReconcileRule,
      CmdbReconcileResult,
    ]),
    AuthModule,
    TenantsModule,
    CmdbModule,
    EventBusModule,
  ],
  providers: [
    ImportSourceService,
    ImportJobService,
    ReconcileRuleService,
    CmdbSchedulerService,
  ],
  controllers: [
    ImportSourceController,
    ImportJobController,
    ReconcileRuleController,
  ],
  exports: [
    ImportSourceService,
    ImportJobService,
    ReconcileRuleService,
    CmdbSchedulerService,
  ],
})
export class CmdbImportModule {}
