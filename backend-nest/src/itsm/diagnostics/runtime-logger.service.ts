import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../../common/logger/structured-logger.service';

@Injectable()
export class RuntimeLoggerService {
  private readonly logger: StructuredLoggerService;

  constructor() {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('ItsmRuntime');
  }

  logBusinessRuleEvaluation(params: {
    tenantId: string;
    tableName: string;
    trigger: string;
    ruleName: string;
    conditionResult: boolean;
    applied: boolean;
    rejected: boolean;
    fieldUpdates?: Record<string, unknown>;
    executionMs?: number;
  }): void {
    this.logger.log('business_rule.evaluated', {
      tenantId: params.tenantId,
      tableName: params.tableName,
      trigger: params.trigger,
      ruleName: params.ruleName,
      conditionResult: params.conditionResult,
      applied: params.applied,
      rejected: params.rejected,
      fieldUpdateCount: params.fieldUpdates
        ? Object.keys(params.fieldUpdates).length
        : 0,
      executionMs: params.executionMs,
    });
  }

  logBusinessRuleBatchComplete(params: {
    tenantId: string;
    tableName: string;
    trigger: string;
    rulesEvaluated: number;
    rulesApplied: number;
    rejected: boolean;
    totalMs: number;
  }): void {
    this.logger.log('business_rule.batch_complete', {
      tenantId: params.tenantId,
      tableName: params.tableName,
      trigger: params.trigger,
      rulesEvaluated: params.rulesEvaluated,
      rulesApplied: params.rulesApplied,
      rejected: params.rejected,
      totalMs: params.totalMs,
    });
  }

  logWorkflowTransition(params: {
    tenantId: string;
    tableName: string;
    workflowName: string;
    transitionName: string;
    fromState: string;
    toState: string;
    allowed: boolean;
    reason?: string;
    executionMs?: number;
  }): void {
    this.logger.log('workflow.transition', {
      tenantId: params.tenantId,
      tableName: params.tableName,
      workflowName: params.workflowName,
      transitionName: params.transitionName,
      fromState: params.fromState,
      toState: params.toState,
      allowed: params.allowed,
      reason: params.reason,
      executionMs: params.executionMs,
    });
  }

  logSlaEvent(params: {
    tenantId: string;
    event: 'started' | 'paused' | 'resumed' | 'stopped' | 'breached' | 'met';
    recordType: string;
    recordId: string;
    definitionName?: string;
    elapsedSeconds?: number;
    remainingSeconds?: number;
  }): void {
    this.logger.log(`sla.${params.event}`, {
      tenantId: params.tenantId,
      recordType: params.recordType,
      recordId: params.recordId,
      definitionName: params.definitionName,
      elapsedSeconds: params.elapsedSeconds,
      remainingSeconds: params.remainingSeconds,
    });
  }

  logUiPolicyEvaluation(params: {
    tenantId: string;
    tableName: string;
    policiesEvaluated: number;
    effectsApplied: number;
  }): void {
    this.logger.log('ui_policy.evaluated', {
      tenantId: params.tenantId,
      tableName: params.tableName,
      policiesEvaluated: params.policiesEvaluated,
      effectsApplied: params.effectsApplied,
    });
  }

  logDiagnosticsValidation(params: {
    tenantId: string;
    valid: boolean;
    errorCount: number;
    checkedAt: string;
  }): void {
    this.logger.log('diagnostics.baseline_validated', {
      tenantId: params.tenantId,
      valid: params.valid,
      errorCount: params.errorCount,
      checkedAt: params.checkedAt,
    });
  }
}
