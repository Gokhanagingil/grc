import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';

import { ItsmIncident } from './incident/incident.entity';
import { IncidentService } from './incident/incident.service';
import { IncidentController } from './incident/incident.controller';

/**
 * ITSM Module
 *
 * Provides the ITSM domain model entities, services, and controllers.
 * This module encapsulates all ITSM-related functionality including:
 * - Incident management
 *
 * Future modules:
 * - Problem management
 * - Change management
 * - Service request management
 *
 * All entities support multi-tenancy via tenantId field.
 * All endpoints require JWT authentication and tenant context.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ItsmIncident]),
    AuditModule,
    AuthModule,
    TenantsModule,
  ],
  providers: [IncidentService],
  controllers: [IncidentController],
  exports: [IncidentService],
})
export class ItsmModule {}
