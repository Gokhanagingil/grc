import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
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
  GrcAudit,
  GrcRiskControl,
  GrcPolicyControl,
  GrcRequirementControl,
  GrcIssueEvidence,
  GrcRiskPolicy,
  GrcRiskRequirement,
  GrcAuditRequirement,
  GrcIssueRequirement,
  GrcRiskHistory,
  GrcPolicyHistory,
  GrcRequirementHistory,
  UserHistory,
  // Platform Core Phase 1 entities
  GrcPolicyVersion,
  GrcAuditReportTemplate,
  GrcFieldMetadata,
  GrcClassificationTag,
  GrcFieldMetadataTag,
  // Sprint 5 - Process Controls entities
  Process,
  ProcessControl,
  ControlResult,
  ProcessViolation,
  ProcessControlRisk,
  // Audit Phase 2 - Standards Library entities
  Standard,
  StandardClause,
  AuditScopeStandard,
  AuditScopeClause,
  GrcIssueClause,
  // Framework Activation entities
  GrcFramework,
  GrcTenantFramework,
} from './entities';

// Services
import {
  GrcRiskService,
  GrcPolicyService,
  GrcRequirementService,
  GrcAuditService,
  // Platform Core Phase 1 services
  GrcPolicyVersionService,
  GrcAuditReportTemplateService,
  SearchService,
  QueryDSLService,
  MetadataService,
  // Sprint 5 - Process Controls services
  ProcessService,
  ProcessControlService,
  ControlResultService,
  ProcessViolationService,
  ProcessComplianceService,
  // Audit Phase 2 - Standards Library services
  StandardsService,
  // Admin Studio FAZ 2 - Data Model Dictionary services
  DataModelDictionaryService,
  // Framework Activation services
  GrcFrameworksService,
} from './services';

// Controllers
import {
  GrcRiskController,
  GrcPolicyController,
  GrcRequirementController,
  GrcAuditController,
  // Platform Core Phase 1 controllers
  GrcPolicyVersionController,
  AuditReportTemplateController,
  SearchController,
  MetadataController,
  // Sprint 5 - Process Controls controllers
  ProcessController,
  ProcessControlController,
  ControlResultController,
  ProcessViolationController,
  // Audit Phase 2 - Standards Library controllers
  StandardController,
  StandardClauseController,
  GrcIssueController,
  StandardsController,
  AuditScopeController,
  // Admin Studio FAZ 2 - Data Model Dictionary controllers
  DataModelDictionaryController,
  // Dotwalking Query Builder controllers
  DotWalkingController,
  // Framework Activation controllers
  GrcFrameworksController,
  TenantFrameworksController,
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
      GrcAudit,
      // Mapping entities
      GrcRiskControl,
      GrcPolicyControl,
      GrcRequirementControl,
      GrcIssueEvidence,
      GrcRiskPolicy,
      GrcRiskRequirement,
      GrcAuditRequirement,
      GrcIssueRequirement,
      // History entities
      GrcRiskHistory,
      GrcPolicyHistory,
      GrcRequirementHistory,
      UserHistory,
      // Platform Core Phase 1 entities
      GrcPolicyVersion,
      GrcAuditReportTemplate,
      GrcFieldMetadata,
      GrcClassificationTag,
      GrcFieldMetadataTag,
      // Sprint 5 - Process Controls entities
      Process,
      ProcessControl,
      ControlResult,
      ProcessViolation,
      ProcessControlRisk,
      // Audit Phase 2 - Standards Library entities
      Standard,
      StandardClause,
      AuditScopeStandard,
      AuditScopeClause,
      GrcIssueClause,
      // Framework Activation entities
      GrcFramework,
      GrcTenantFramework,
    ]),
    AuditModule,
    AuthModule,
    TenantsModule,
  ],
  providers: [
    // Core services
    GrcRiskService,
    GrcPolicyService,
    GrcRequirementService,
    GrcAuditService,
    // Platform Core Phase 1 services
    GrcPolicyVersionService,
    GrcAuditReportTemplateService,
    SearchService,
    QueryDSLService,
    MetadataService,
    // Sprint 5 - Process Controls services
    ProcessService,
    ProcessControlService,
    ControlResultService,
    ProcessViolationService,
    ProcessComplianceService,
    // Audit Phase 2 - Standards Library services
    StandardsService,
    // Admin Studio FAZ 2 - Data Model Dictionary services
    DataModelDictionaryService,
    // Framework Activation services
    GrcFrameworksService,
  ],
  controllers: [
    // Core controllers
    GrcRiskController,
    GrcPolicyController,
    GrcRequirementController,
    GrcAuditController,
    // Platform Core Phase 1 controllers
    GrcPolicyVersionController,
    AuditReportTemplateController,
    SearchController,
    MetadataController,
    // Sprint 5 - Process Controls controllers
    ProcessController,
    ProcessControlController,
    ControlResultController,
    ProcessViolationController,
    // Audit Phase 2 - Standards Library controllers
    StandardController,
    StandardClauseController,
    GrcIssueController,
    StandardsController,
    AuditScopeController,
    // Admin Studio FAZ 2 - Data Model Dictionary controllers
    DataModelDictionaryController,
    // Dotwalking Query Builder controllers
    DotWalkingController,
    // Framework Activation controllers
    GrcFrameworksController,
    TenantFrameworksController,
  ],
  exports: [
    // Core services
    GrcRiskService,
    GrcPolicyService,
    GrcRequirementService,
    GrcAuditService,
    // Platform Core Phase 1 services
    GrcPolicyVersionService,
    GrcAuditReportTemplateService,
    SearchService,
    QueryDSLService,
    MetadataService,
    // Sprint 5 - Process Controls services
    ProcessService,
    ProcessControlService,
    ControlResultService,
    ProcessViolationService,
    ProcessComplianceService,
    // Audit Phase 2 - Standards Library services
    StandardsService,
    // Admin Studio FAZ 2 - Data Model Dictionary services
    DataModelDictionaryService,
    // Framework Activation services
    GrcFrameworksService,
  ],
})
export class GrcModule {}
