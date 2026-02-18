import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';

import { ItsmIncident } from './incident/incident.entity';
import { IncidentService } from './incident/incident.service';
import { IncidentController } from './incident/incident.controller';

import { ItsmService } from './service/service.entity';
import { ItsmServiceService } from './service/service.service';
import { ServiceController } from './service/service.controller';

import { ItsmChange } from './change/change.entity';
import { ChangeService } from './change/change.service';
import { ChangeController } from './change/change.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ItsmIncident, ItsmService, ItsmChange]),
    AuditModule,
    AuthModule,
    TenantsModule,
  ],
  providers: [IncidentService, ItsmServiceService, ChangeService],
  controllers: [IncidentController, ServiceController, ChangeController],
  exports: [IncidentService, ItsmServiceService, ChangeService],
})
export class ItsmModule {}
