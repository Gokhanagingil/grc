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

import { SlaDefinition } from './sla/sla-definition.entity';
import { SlaInstance } from './sla/sla-instance.entity';
import { SlaService } from './sla/sla.service';
import { SlaEngineService } from './sla/sla-engine.service';
import { SlaController } from './sla/sla.controller';
import { SlaEventListener } from './sla/sla-event.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ItsmIncident,
      ItsmService,
      ItsmChange,
      SlaDefinition,
      SlaInstance,
    ]),
    AuditModule,
    AuthModule,
    TenantsModule,
  ],
  providers: [
    IncidentService,
    ItsmServiceService,
    ChangeService,
    SlaEngineService,
    SlaService,
    SlaEventListener,
  ],
  controllers: [
    IncidentController,
    ServiceController,
    ChangeController,
    SlaController,
  ],
  exports: [IncidentService, ItsmServiceService, ChangeService, SlaService],
})
export class ItsmModule {}
