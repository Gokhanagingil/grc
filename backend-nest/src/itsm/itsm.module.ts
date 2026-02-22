import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';

import { ItsmIncident } from './incident/incident.entity';
import { ItsmIncidentCi } from './incident/incident-ci.entity';
import { IncidentService } from './incident/incident.service';
import { IncidentCiService } from './incident/incident-ci.service';
import { IncidentController } from './incident/incident.controller';

import { ItsmService } from './service/service.entity';
import { ItsmServiceService } from './service/service.service';
import { ServiceController } from './service/service.controller';

import { ItsmChange } from './change/change.entity';
import { ChangeService } from './change/change.service';
import { ChangeController } from './change/change.controller';

import { WorkflowDefinition } from './workflow/workflow-definition.entity';
import { WorkflowService } from './workflow/workflow.service';
import { WorkflowEngineService } from './workflow/workflow-engine.service';
import { WorkflowController } from './workflow/workflow.controller';

import { BusinessRule } from './business-rule/business-rule.entity';
import { BusinessRuleService } from './business-rule/business-rule.service';
import { BusinessRuleEngineService } from './business-rule/business-rule-engine.service';
import { BusinessRuleController } from './business-rule/business-rule.controller';

import { UiPolicy } from './ui-policy/ui-policy.entity';
import { UiAction } from './ui-policy/ui-action.entity';
import { UiPolicyService } from './ui-policy/ui-policy.service';
import { UiActionService } from './ui-policy/ui-action.service';
import { UiPolicyController } from './ui-policy/ui-policy.controller';

import { SlaDefinition } from './sla/sla-definition.entity';
import { SlaInstance } from './sla/sla-instance.entity';
import { SlaService } from './sla/sla.service';
import { SlaEngineService } from './sla/sla-engine.service';
import { SlaController } from './sla/sla.controller';
import { SlaEventListener } from './sla/sla-event.listener';
import { SlaBreachCheckerJob } from './sla/sla-breach-checker.job';

import { SysChoice } from './choice/sys-choice.entity';
import { ChoiceService } from './choice/choice.service';
import { ChoiceController } from './choice/choice.controller';

import { ItsmJournal } from './journal/journal.entity';
import { JournalService } from './journal/journal.service';
import { JournalController } from './journal/journal.controller';

import { DiagnosticsService } from './diagnostics/diagnostics.service';
import { DiagnosticsController } from './diagnostics/diagnostics.controller';
import { RuntimeLoggerService } from './diagnostics/runtime-logger.service';

import { EventBusModule } from '../event-bus/event-bus.module';
import { CmdbService as CmdbServiceEntity } from './cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from './cmdb/service-offering/cmdb-service-offering.entity';
import { CmdbCi } from './cmdb/ci/ci.entity';
import { CmdbServiceCi } from './cmdb/service-ci/cmdb-service-ci.entity';

import { CalendarEvent } from './change/calendar/calendar-event.entity';
import { FreezeWindow } from './change/calendar/freeze-window.entity';
import { CalendarConflict } from './change/calendar/calendar-conflict.entity';
import { CalendarEventService } from './change/calendar/calendar-event.service';
import { FreezeWindowService } from './change/calendar/freeze-window.service';
import { ConflictDetectionService } from './change/calendar/conflict-detection.service';
import { CalendarEventController } from './change/calendar/calendar-event.controller';
import { FreezeWindowController } from './change/calendar/freeze-window.controller';
import { ConflictController } from './change/calendar/conflict.controller';

import { RiskAssessment } from './change/risk/risk-assessment.entity';
import { ChangePolicy } from './change/risk/change-policy.entity';
import { RiskScoringService } from './change/risk/risk-scoring.service';
import { PolicyService } from './change/risk/policy.service';
import { RiskController } from './change/risk/risk.controller';
import { PolicyController } from './change/risk/policy.controller';
import { CustomerRiskImpactService } from './change/risk/customer-risk-impact.service';
import { CmdbCiRel } from './cmdb/ci-rel/ci-rel.entity';
import { CmdbQualitySnapshot } from './cmdb/health/cmdb-quality-snapshot.entity';

import { ItsmApproval } from './change/approval/itsm-approval.entity';
import { ApprovalService } from './change/approval/approval.service';
import { ApprovalController } from './change/approval/approval.controller';

import { CustomerRiskCatalog } from '../grc/entities/customer-risk-catalog.entity';
import { CustomerRiskBinding } from '../grc/entities/customer-risk-binding.entity';
import { CustomerRiskObservation } from '../grc/entities/customer-risk-observation.entity';

import { ItsmProblem } from './problem/problem.entity';
import { ItsmProblemIncident } from './problem/problem-incident.entity';
import { ItsmProblemChange } from './problem/problem-change.entity';
import { ProblemService } from './problem/problem.service';
import { ProblemController } from './problem/problem.controller';

import { ItsmKnownError } from './known-error/known-error.entity';
import { KnownErrorService } from './known-error/known-error.service';
import { KnownErrorController } from './known-error/known-error.controller';

import { ItsmMajorIncident } from './major-incident/major-incident.entity';
import { ItsmMajorIncidentUpdate } from './major-incident/major-incident-update.entity';
import { ItsmMajorIncidentLink } from './major-incident/major-incident-link.entity';
import { MajorIncidentService } from './major-incident/major-incident.service';
import { MajorIncidentController } from './major-incident/major-incident.controller';

import { ItsmPir } from './pir/pir.entity';
import { ItsmPirAction } from './pir/pir-action.entity';
import { ItsmKnowledgeCandidate } from './pir/knowledge-candidate.entity';
import { PirService } from './pir/pir.service';
import { PirActionService } from './pir/pir-action.service';
import { KnowledgeCandidateService } from './pir/knowledge-candidate.service';
import { PirController } from './pir/pir.controller';
import { PirActionController } from './pir/pir-action.controller';
import { KnowledgeCandidateController } from './pir/knowledge-candidate.controller';

import { AnalyticsService } from './analytics/analytics.service';
import { AnalyticsController } from './analytics/analytics.controller';

import { TopologyImpactAnalysisService } from './change/risk/topology-impact/topology-impact-analysis.service';
import { TopologyGovernanceService } from './change/risk/topology-impact/topology-governance.service';
import { RcaOrchestrationService } from './change/risk/topology-impact/rca-orchestration.service';
import { TopologyImpactController } from './change/risk/topology-impact/topology-impact.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ItsmIncident,
      ItsmService,
      ItsmChange,
      WorkflowDefinition,
      BusinessRule,
      UiPolicy,
      UiAction,
      SlaDefinition,
      SlaInstance,
      SysChoice,
      ItsmJournal,
      CmdbServiceEntity,
      CmdbServiceOffering,
      CmdbCi,
      CmdbServiceCi,
      ItsmIncidentCi,
      CalendarEvent,
      FreezeWindow,
      CalendarConflict,
      RiskAssessment,
      ChangePolicy,
      CmdbCiRel,
      CmdbQualitySnapshot,
      ItsmApproval,
      CustomerRiskCatalog,
      CustomerRiskBinding,
      CustomerRiskObservation,
      ItsmProblem,
      ItsmProblemIncident,
      ItsmProblemChange,
      ItsmKnownError,
      ItsmMajorIncident,
      ItsmMajorIncidentUpdate,
      ItsmMajorIncidentLink,
      ItsmPir,
      ItsmPirAction,
      ItsmKnowledgeCandidate,
    ]),
    AuditModule,
    AuthModule,
    TenantsModule,
    EventBusModule,
  ],
  providers: [
    IncidentService,
    IncidentCiService,
    ItsmServiceService,
    ChangeService,
    WorkflowService,
    WorkflowEngineService,
    BusinessRuleService,
    BusinessRuleEngineService,
    UiPolicyService,
    UiActionService,
    SlaService,
    SlaEngineService,
    SlaEventListener,
    SlaBreachCheckerJob,
    ChoiceService,
    JournalService,
    DiagnosticsService,
    RuntimeLoggerService,
    CalendarEventService,
    FreezeWindowService,
    ConflictDetectionService,
    RiskScoringService,
    PolicyService,
    CustomerRiskImpactService,
    ApprovalService,
    ProblemService,
    KnownErrorService,
    MajorIncidentService,
    PirService,
    PirActionService,
    KnowledgeCandidateService,
    AnalyticsService,
    TopologyImpactAnalysisService,
    TopologyGovernanceService,
    RcaOrchestrationService,
  ],
  controllers:[
    IncidentController,
    ServiceController,
    ChangeController,
    ChoiceController,
    JournalController,
    WorkflowController,
    BusinessRuleController,
    UiPolicyController,
    SlaController,
    DiagnosticsController,
    CalendarEventController,
    FreezeWindowController,
    ConflictController,
    RiskController,
    PolicyController,
    ApprovalController,
    ProblemController,
    KnownErrorController,
    MajorIncidentController,
    PirController,
    PirActionController,
    KnowledgeCandidateController,
    AnalyticsController,
    TopologyImpactController,
  ],
  exports: [
    IncidentService,
    IncidentCiService,
    ItsmServiceService,
    ChangeService,
    WorkflowService,
    WorkflowEngineService,
    BusinessRuleService,
    BusinessRuleEngineService,
    UiPolicyService,
    UiActionService,
    SlaService,
    SlaEngineService,
    SlaBreachCheckerJob,
    ChoiceService,
    JournalService,
    DiagnosticsService,
    RuntimeLoggerService,
    CalendarEventService,
    FreezeWindowService,
    ConflictDetectionService,
    RiskScoringService,
    PolicyService,
    CustomerRiskImpactService,
    ApprovalService,
    ProblemService,
    KnownErrorService,
    MajorIncidentService,
    PirService,
    PirActionService,
    KnowledgeCandidateService,
    TopologyImpactAnalysisService,
    TopologyGovernanceService,
    RcaOrchestrationService,
  ],
})
export class ItsmModule {}
