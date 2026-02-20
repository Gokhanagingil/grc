import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessRule } from '../business-rule/business-rule.entity';
import { UiPolicy } from '../ui-policy/ui-policy.entity';
import { UiAction } from '../ui-policy/ui-action.entity';
import { WorkflowDefinition } from '../workflow/workflow-definition.entity';
import { SlaDefinition } from '../sla/sla-definition.entity';
import { SlaInstance } from '../sla/sla-instance.entity';
import { SysChoice } from '../choice/sys-choice.entity';

export interface TableCounts {
  tableName: string;
  businessRules: number;
  uiPolicies: number;
  uiActions: number;
  workflows: number;
  slaDefinitions: number;
}

export interface BaselineValidationError {
  type: 'MISSING_CHOICES' | 'MISSING_WORKFLOW' | 'MALFORMED_WORKFLOW' | 'MISSING_SLA';
  table: string;
  field?: string;
  detail: string;
}

export interface BaselineValidationResult {
  valid: boolean;
  errors: BaselineValidationError[];
  checkedAt: string;
}

export interface DiagnosticsHealth {
  tenantId: string;
  buildSha: string;
  nodeEnv: string;
  uptime: number;
  timestamp: string;
}

const REQUIRED_CHOICE_SETS: Record<string, string[]> = {
  itsm_incidents: ['category', 'impact', 'urgency', 'status', 'source', 'priority'],
  itsm_changes: ['type', 'state', 'risk'],
  itsm_services: ['criticality', 'status'],
};

const ITSM_TABLES = ['itsm_incidents', 'itsm_changes', 'itsm_services'];

@Injectable()
export class DiagnosticsService {
  constructor(
    @InjectRepository(BusinessRule)
    private readonly businessRuleRepo: Repository<BusinessRule>,
    @InjectRepository(UiPolicy)
    private readonly uiPolicyRepo: Repository<UiPolicy>,
    @InjectRepository(UiAction)
    private readonly uiActionRepo: Repository<UiAction>,
    @InjectRepository(WorkflowDefinition)
    private readonly workflowRepo: Repository<WorkflowDefinition>,
    @InjectRepository(SlaDefinition)
    private readonly slaDefRepo: Repository<SlaDefinition>,
    @InjectRepository(SlaInstance)
    private readonly slaInstanceRepo: Repository<SlaInstance>,
    @InjectRepository(SysChoice)
    private readonly choiceRepo: Repository<SysChoice>,
  ) {}

  getHealth(tenantId: string): DiagnosticsHealth {
    return {
      tenantId,
      buildSha: process.env.BUILD_SHA || process.env.GIT_COMMIT || 'dev',
      nodeEnv: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  async getCounts(tenantId: string): Promise<TableCounts[]> {
    const results: TableCounts[] = [];

    for (const tableName of ITSM_TABLES) {
      const [businessRules, uiPolicies, uiActions, workflows, slaDefinitions] =
        await Promise.all([
          this.businessRuleRepo.count({
            where: { tenantId, tableName, isActive: true, isDeleted: false },
          }),
          this.uiPolicyRepo.count({
            where: { tenantId, tableName, isActive: true, isDeleted: false },
          }),
          this.uiActionRepo.count({
            where: { tenantId, tableName, isActive: true, isDeleted: false },
          }),
          this.workflowRepo.count({
            where: { tenantId, tableName, isActive: true, isDeleted: false },
          }),
          this.slaDefRepo.count({
            where: { tenantId, isActive: true, isDeleted: false },
          }),
        ]);

      results.push({
        tableName,
        businessRules,
        uiPolicies,
        uiActions,
        workflows,
        slaDefinitions,
      });
    }

    return results;
  }

  async validateBaseline(tenantId: string): Promise<BaselineValidationResult> {
    const errors: BaselineValidationError[] = [];

    await this.validateChoiceSets(tenantId, errors);
    await this.validateWorkflows(tenantId, errors);
    await this.validateSlaDefinitions(tenantId, errors);

    return {
      valid: errors.length === 0,
      errors,
      checkedAt: new Date().toISOString(),
    };
  }

  private async validateChoiceSets(
    tenantId: string,
    errors: BaselineValidationError[],
  ): Promise<void> {
    for (const [tableName, fields] of Object.entries(REQUIRED_CHOICE_SETS)) {
      for (const field of fields) {
        const count = await this.choiceRepo.count({
          where: {
            tenantId,
            tableName,
            fieldName: field,
            isActive: true,
            isDeleted: false,
          },
        });

        if (count === 0) {
          errors.push({
            type: 'MISSING_CHOICES',
            table: tableName,
            field,
            detail: `No active choices for field '${field}' on table '${tableName}'. ITSM forms will not render dropdowns for this field.`,
          });
        }
      }
    }
  }

  private async validateWorkflows(
    tenantId: string,
    errors: BaselineValidationError[],
  ): Promise<void> {
    for (const tableName of ITSM_TABLES) {
      const workflows = await this.workflowRepo.find({
        where: { tenantId, tableName, isActive: true, isDeleted: false },
        order: { order: 'ASC' },
      });

      if (workflows.length === 0) {
        errors.push({
          type: 'MISSING_WORKFLOW',
          table: tableName,
          detail: `No active workflow definition for table '${tableName}'. State transitions will not be enforced.`,
        });
        continue;
      }

      for (const wf of workflows) {
        const hasInitial = wf.states.some((s) => s.isInitial);
        if (!hasInitial) {
          errors.push({
            type: 'MALFORMED_WORKFLOW',
            table: tableName,
            detail: `Workflow '${wf.name}' has no initial state defined. Records cannot enter the workflow.`,
          });
        }

        const hasFinal = wf.states.some((s) => s.isFinal);
        if (!hasFinal) {
          errors.push({
            type: 'MALFORMED_WORKFLOW',
            table: tableName,
            detail: `Workflow '${wf.name}' has no final state defined. Records cannot reach completion.`,
          });
        }

        const stateNames = new Set(wf.states.map((s) => s.name));
        for (const t of wf.transitions) {
          if (!stateNames.has(t.from)) {
            errors.push({
              type: 'MALFORMED_WORKFLOW',
              table: tableName,
              detail: `Workflow '${wf.name}' transition '${t.name}' references unknown 'from' state '${t.from}'.`,
            });
          }
          if (!stateNames.has(t.to)) {
            errors.push({
              type: 'MALFORMED_WORKFLOW',
              table: tableName,
              detail: `Workflow '${wf.name}' transition '${t.name}' references unknown 'to' state '${t.to}'.`,
            });
          }
        }
      }
    }
  }

  private async validateSlaDefinitions(
    tenantId: string,
    errors: BaselineValidationError[],
  ): Promise<void> {
    const slaCount = await this.slaDefRepo.count({
      where: { tenantId, isActive: true, isDeleted: false },
    });

    if (slaCount === 0) {
      errors.push({
        type: 'MISSING_SLA',
        table: 'itsm_incidents',
        detail: 'No active SLA definitions found. SLA tracking will not start for new records.',
      });
    }
  }

  async getActiveSlaInstanceSummary(
    tenantId: string,
  ): Promise<{ total: number; inProgress: number; breached: number; met: number; paused: number }> {
    const qb = this.slaInstanceRepo.createQueryBuilder('inst');
    qb.select('inst.status', 'status');
    qb.addSelect('COUNT(*)', 'count');
    qb.where('inst.tenantId = :tenantId', { tenantId });
    qb.andWhere('inst.isDeleted = :isDeleted', { isDeleted: false });
    qb.groupBy('inst.status');

    const rows = await qb.getRawMany<{ status: string; count: string }>();

    let total = 0;
    let inProgress = 0;
    let breached = 0;
    let met = 0;
    let paused = 0;

    for (const row of rows) {
      const c = parseInt(row.count, 10);
      total += c;
      switch (row.status) {
        case 'IN_PROGRESS':
          inProgress = c;
          break;
        case 'BREACHED':
          breached = c;
          break;
        case 'MET':
          met = c;
          break;
        case 'PAUSED':
          paused = c;
          break;
      }
    }

    return { total, inProgress, breached, met, paused };
  }
}
