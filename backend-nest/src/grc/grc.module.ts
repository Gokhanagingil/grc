import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { TenantsModule } from '../tenants/tenants.module';

// Entities
import {
  GrcRisk,
  GrcControl,
  GrcPolicy,
  GrcRequirement,
  GrcIssue,
  GrcCapa,
  GrcEvidence,
  GrcRiskControl,
  GrcPolicyControl,
  GrcRequirementControl,
  GrcIssueEvidence,
  GrcRiskHistory,
  GrcPolicyHistory,
  GrcRequirementHistory,
  UserHistory,
} from './entities';

// Services
import {
  GrcRiskService,
  GrcPolicyService,
  GrcRequirementService,
} from './services';

// Controllers
import {
  GrcRiskController,
  GrcPolicyController,
  GrcRequirementController,
} from './controllers';

/**
 * GRC Module
 *
 * Provides the GRC domain model entities, services, and controllers.
 * This module encapsulates all GRC-related functionality including:
 * - Risk management
 * - Control management
 * - Policy management
 * - Compliance requirement tracking
 * - Issue/Finding management
 * - CAPA (Corrective and Preventive Actions)
 * - Evidence management
 *
 * All entities support multi-tenancy via tenantId field.
 * All endpoints require JWT authentication and tenant context.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Core entities
      GrcRisk,
      GrcControl,
      GrcPolicy,
      GrcRequirement,
      GrcIssue,
      GrcCapa,
      GrcEvidence,
      // Mapping entities
      GrcRiskControl,
      GrcPolicyControl,
      GrcRequirementControl,
      GrcIssueEvidence,
      // History entities
      GrcRiskHistory,
      GrcPolicyHistory,
      GrcRequirementHistory,
      UserHistory,
    ]),
    AuditModule,
    TenantsModule,
  ],
  providers: [GrcRiskService, GrcPolicyService, GrcRequirementService],
  controllers: [
    GrcRiskController,
    GrcPolicyController,
    GrcRequirementController,
  ],
  exports: [GrcRiskService, GrcPolicyService, GrcRequirementService],
})
export class GrcModule {}
