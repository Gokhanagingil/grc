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
  // Golden Flow Phase 1 entities
  GrcControlTest,
  GrcTestResult,
  GrcCapaTask,
  GrcControlEvidence,
  GrcStatusHistory,
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

// Golden Flow Phase 1 services
import { GrcControlTestService } from './services/grc-control-test.service';
import { GrcTestResultService } from './services/grc-test-result.service';
import { GrcCapaTaskService } from './services/grc-capa-task.service';
import { GrcControlEvidenceService } from './services/grc-control-evidence.service';
import { GrcStatusHistoryService } from './services/grc-status-history.service';
import { ClosureLoopService } from './services/closure-loop.service';

// Controllers
import {
  GrcRiskController,
  GrcPolicyController,
  GrcRequirementController,
  GrcAuditController,
  GrcControlController,
  GrcEvidenceController,
  GrcCapaController,
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

// Golden Flow Phase 1 controllers
import { GrcControlTestController } from './controllers/grc-control-test.controller';
import { GrcTestResultController } from './controllers/grc-test-result.controller';
import { GrcCapaTaskController } from './controllers/grc-capa-task.controller';
import { GrcControlEvidenceController } from './controllers/grc-control-evidence.controller';
import { GrcStatusHistoryController } from './controllers/grc-status-history.controller';

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
      // Golden Flow Phase 1 entities
      GrcControlTest,
      GrcTestResult,
      GrcCapaTask,
      GrcControlEvidence,
      GrcStatusHistory,
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
    // Golden Flow Phase 1 services
    GrcControlTestService,
    GrcTestResultService,
    GrcCapaTaskService,
    GrcControlEvidenceService,
    GrcStatusHistoryService,
    // Closure Loop MVP service
    ClosureLoopService,
  ],
  controllers: [
    // Core controllers
    GrcRiskController,
    GrcPolicyController,
    GrcRequirementController,
    GrcAuditController,
    GrcControlController,
    GrcEvidenceController,
    GrcCapaController,
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
    // Golden Flow Phase 1 controllers
    GrcControlTestController,
    GrcTestResultController,
    GrcCapaTaskController,
    GrcControlEvidenceController,
    GrcStatusHistoryController,
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
    // Golden Flow Phase 1 services
    GrcControlTestService,
    GrcTestResultService,
    GrcCapaTaskService,
    GrcControlEvidenceService,
    GrcStatusHistoryService,
    // Closure Loop MVP service
    ClosureLoopService,
  ],
})
export class GrcModule {}
