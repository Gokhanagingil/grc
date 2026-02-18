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
    ]),
    AuditModule,
    AuthModule,
    TenantsModule,
  ],
  providers: [
    IncidentService,
    ItsmServiceService,
    ChangeService,
    WorkflowService,
    WorkflowEngineService,
    BusinessRuleService,
    BusinessRuleEngineService,
    UiPolicyService,
    UiActionService,
  ],
  controllers: [
    IncidentController,
    ServiceController,
    ChangeController,
    WorkflowController,
    BusinessRuleController,
    UiPolicyController,
  ],
  exports: [
    IncidentService,
    ItsmServiceService,
    ChangeService,
    WorkflowService,
    WorkflowEngineService,
    BusinessRuleService,
    BusinessRuleEngineService,
    UiPolicyService,
    UiActionService,
  ],
})
export class ItsmModule {}
