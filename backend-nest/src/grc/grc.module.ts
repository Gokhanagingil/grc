import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UniversalListService } from '../common/services/universal-list.service';
import { ViewPreferenceService } from '../common/services/view-preference.service';
import { UserViewPreference } from '../common/entities/user-view-preference.entity';

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
  GrcControlProcess,
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
  // Golden Flow Sprint 1B entities
  GrcEvidenceTestResult,
  // Platform Builder entities
  SysDbObject,
  SysDictionary,
  DynamicRecord,
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

// Golden Flow Sprint 1B services
import { GrcEvidenceService } from './services/grc-evidence.service';
import { GrcIssueService } from './services/grc-issue.service';

// Golden Flow Sprint 1C services
import { GrcCapaService } from './services/grc-capa.service';

// Sprint 1E - Insights service
import { GrcInsightsService } from './services/grc-insights.service';

// Platform Builder services
import { PlatformBuilderService } from './services/platform-builder.service';
import { DynamicDataService } from './services/dynamic-data.service';

// Controllers
import {
  GrcRiskController,
  GrcPolicyController,
  GrcRequirementController,
  GrcAuditController,
  GrcControlController,
  GrcEvidenceController,
  GrcCapaController,
  GrcCoverageController,
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
  // Platform Controllers (Universal Views)
  PlatformController,
  // List Options Controller (List Toolbar Standard)
  ListOptionsController,
  // Export Controller (CSV Export with XSS protection)
  ExportController,
} from './controllers';

// Golden Flow Phase 1 controllers
import { GrcControlTestController } from './controllers/grc-control-test.controller';
import { GrcTestResultController } from './controllers/grc-test-result.controller';
import { GrcCapaTaskController } from './controllers/grc-capa-task.controller';
import { GrcControlEvidenceController } from './controllers/grc-control-evidence.controller';
import { GrcStatusHistoryController } from './controllers/grc-status-history.controller';

// Sprint 1E - Insights controller
import { GrcInsightsController } from './controllers/grc-insights.controller';

// Platform Builder controllers
import { PlatformBuilderController } from './controllers/platform-builder.controller';
import { DynamicDataController } from './controllers/dynamic-data.controller';

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
      GrcControlProcess,
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
      // Golden Flow Sprint 1B entities
      GrcEvidenceTestResult,
      // Universal Views entities
      UserViewPreference,
      // Platform Builder entities
      SysDbObject,
      SysDictionary,
      DynamicRecord,
    ]),
    AuditModule,
    AuthModule,
    TenantsModule,
  ],
  providers: [
    // Universal List Service (platform-level)
    UniversalListService,
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
    // Universal Views services
    ViewPreferenceService,
    // Golden Flow Sprint 1B services
    GrcEvidenceService,
    GrcIssueService,
    // Golden Flow Sprint 1C services
    GrcCapaService,
    // Sprint 1E - Insights service
    GrcInsightsService,
    // Platform Builder services
    PlatformBuilderService,
    DynamicDataService,
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
    GrcCoverageController,
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
    // Universal Views controllers
    PlatformController,
    // Golden Flow Phase 1 controllers
    GrcControlTestController,
    GrcTestResultController,
    GrcCapaTaskController,
    GrcControlEvidenceController,
    GrcStatusHistoryController,
    // Sprint 1E - Insights controller
    GrcInsightsController,
    // List Options Controller (List Toolbar Standard)
    ListOptionsController,
    // Export Controller (CSV Export with XSS protection)
    ExportController,
    // Platform Builder controllers
    PlatformBuilderController,
    DynamicDataController,
  ],
  exports: [
    // Universal List Service (platform-level)
    UniversalListService,
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
    // Universal Views services
    ViewPreferenceService,
    // Golden Flow Sprint 1B services
    GrcEvidenceService,
    GrcIssueService,
    // Golden Flow Sprint 1C services
    GrcCapaService,
    // Platform Builder services
    PlatformBuilderService,
    DynamicDataService,
  ],
})
export class GrcModule {}
