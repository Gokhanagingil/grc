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
  ],
  controllers: [
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
  ],
})
export class ItsmModule {}
