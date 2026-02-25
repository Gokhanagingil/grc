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
  GrcRiskCategory,
  GrcRiskAssessment,
  GrcRiskTreatmentAction,
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
  SysRelationship,
  SysIndex,
  // Code Generation entities
  TenantSequence,
  // SOA (Statement of Applicability) entities
  GrcSoaProfile,
  GrcSoaItem,
  GrcSoaItemControl,
  GrcSoaItemEvidence,
  // BCM (Business Continuity Management) entities
  BcmService,
  BcmBia,
  BcmPlan,
  BcmPlanStep,
  BcmExercise,
  // ITSM (IT Service Management) entities - ITIL v5 aligned
  ItsmService,
  ItsmChange,
  ItsmChangeRisk,
  ItsmChangeControl,
  // Customer Risk Catalog entities (ITSM↔GRC Bridge)
  CustomerRiskCatalog,
  CustomerRiskBinding,
  CustomerRiskObservation,
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
import { GenericQueryService } from './services/generic-query.service';

// Code Generation services
import { CodeGeneratorService } from './services/code-generator.service';

// SOA (Statement of Applicability) services
import { GrcSoaService } from './services/grc-soa.service';

// BCM (Business Continuity Management) services
import { BcmModuleService } from './services/bcm.service';

// Calendar services
import { CalendarService } from './services/calendar.service';

// ITSM (IT Service Management) services - ITIL v5 aligned
import { ItsmServiceService } from './services/itsm-service.service';
import { ItsmChangeService } from './services/itsm-change.service';

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
import { GenericQueryController } from './controllers/generic-query.controller';

// SOA (Statement of Applicability) controllers
import { GrcSoaController } from './controllers/grc-soa.controller';

// BCM (Business Continuity Management) controllers
import { BcmController } from './controllers/bcm.controller';

// Calendar controllers
import { CalendarController } from './controllers/calendar.controller';

// Customer Risk Catalog controller (ITSM↔GRC Bridge)
import { CustomerRiskCatalogController } from './controllers/customer-risk-catalog.controller';

// Customer Risk Catalog service (ITSM↔GRC Bridge)
import { CustomerRiskCatalogService } from './services/customer-risk-catalog.service';

// Risk Intelligence Advisory Pack v1
import { RiskAdvisoryService } from './risk-advisory/risk-advisory.service';
import { RiskAdvisoryController } from './risk-advisory/risk-advisory.controller';
import { RiskAdvisoryHeuristics } from './risk-advisory/heuristics/risk-advisory-heuristics';

// NOTE: ITSM controllers (ItsmServiceController, ItsmChangeController) removed from GrcModule
// to eliminate duplicate route registration. Canonical ITSM controllers live in ItsmModule.
// See: PR #363 (removed ItsmIncidentController), this PR (removed remaining duplicates).

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
      GrcRiskCategory,
      GrcRiskAssessment,
      GrcRiskTreatmentAction,
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
      SysRelationship,
      SysIndex,
      // Code Generation entities
      TenantSequence,
      // SOA (Statement of Applicability) entities
      GrcSoaProfile,
      GrcSoaItem,
      GrcSoaItemControl,
      GrcSoaItemEvidence,
      // BCM (Business Continuity Management) entities
      BcmService,
      BcmBia,
      BcmPlan,
      BcmPlanStep,
      BcmExercise,
      // ITSM (IT Service Management) entities - ITIL v5 aligned
      ItsmService,
      ItsmChange,
      ItsmChangeRisk,
      ItsmChangeControl,
      // Customer Risk Catalog entities (ITSM↔GRC Bridge)
      CustomerRiskCatalog,
      CustomerRiskBinding,
      CustomerRiskObservation,
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
    GenericQueryService,
    // Code Generation services
    CodeGeneratorService,
    // SOA (Statement of Applicability) services
    GrcSoaService,
    // BCM (Business Continuity Management) services
    BcmModuleService,
    // Calendar services
    CalendarService,
    // ITSM (IT Service Management) services - ITIL v5 aligned
    ItsmServiceService,
    ItsmChangeService,
    // Customer Risk Catalog service (ITSM↔GRC Bridge)
    CustomerRiskCatalogService,
    // Risk Intelligence Advisory Pack v1
    RiskAdvisoryHeuristics,
    RiskAdvisoryService,
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
    GenericQueryController,
    // SOA(Statement of Applicability) controllers
    GrcSoaController,
    // BCM (Business Continuity Management) controllers
    BcmController,
    // Calendar controllers
    CalendarController,
    // Customer Risk Catalog controller (ITSM↔GRC Bridge)
    CustomerRiskCatalogController,
    // NOTE: ITSM controllers moved to ItsmModule (no duplicate route registration)
    // Risk Intelligence Advisory Pack v1
    RiskAdvisoryController,
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
    GenericQueryService,
    // Code Generation services
    CodeGeneratorService,
    // SOA (Statement of Applicability) services
    GrcSoaService,
    // BCM (Business Continuity Management) services
    BcmModuleService,
    // ITSM (IT Service Management) services - ITIL v5 aligned
    ItsmServiceService,
    ItsmChangeService,
    // Customer Risk Catalog service (ITSM↔GRC Bridge)
    CustomerRiskCatalogService,
    // Risk Intelligence Advisory Pack v1
    RiskAdvisoryService,
  ],
})
export class GrcModule {}
