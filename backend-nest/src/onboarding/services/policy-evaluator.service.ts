import { Injectable } from '@nestjs/common';
import {
  OnboardingContext,
  OnboardingContextService,
} from './onboarding-context.service';
import {
  SuiteType,
  FrameworkType,
  MaturityLevel,
} from '../entities';

export enum PolicyCode {
  FRAMEWORK_REQUIRED = 'FRAMEWORK_REQUIRED',
  ADVANCED_RISK_SCORING_DISABLED = 'ADVANCED_RISK_SCORING_DISABLED',
  ISO27001_EVIDENCE_RECOMMENDED = 'ISO27001_EVIDENCE_RECOMMENDED',
  AUDIT_SCOPE_FILTERED = 'AUDIT_SCOPE_FILTERED',
  CLAUSE_LEVEL_ASSESSMENT_WARNING = 'CLAUSE_LEVEL_ASSESSMENT_WARNING',
  ITSM_RELATED_RISK_DISABLED = 'ITSM_RELATED_RISK_DISABLED',
  MAJOR_INCIDENT_AUTOMATION_DISABLED = 'MAJOR_INCIDENT_AUTOMATION_DISABLED',
}

export enum WarningSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface PolicyWarning {
  code: PolicyCode;
  severity: WarningSeverity;
  message: string;
  targets: string[];
}

export interface PolicyResult {
  disabledFeatures: string[];
  warnings: PolicyWarning[];
  metadata: Record<string, unknown>;
}

@Injectable()
export class PolicyEvaluatorService {
  constructor(
    private readonly onboardingContextService: OnboardingContextService,
  ) {}

  evaluate(context: OnboardingContext): PolicyResult {
    const result: PolicyResult = {
      disabledFeatures: [],
      warnings: [],
      metadata: {},
    };

    this.evaluateP1_FrameworkRequired(context, result);
    this.evaluateP2_AdvancedRiskScoring(context, result);
    this.evaluateP3_ISO27001Evidence(context, result);
    this.evaluateP4_AuditScopeFiltered(context, result);
    this.evaluateP5_ClauseLevelAssessment(context, result);
    this.evaluateP6_ItsmRelatedRisk(context, result);
    this.evaluateP7_MajorIncidentAutomation(context, result);

    return result;
  }

  private evaluateP1_FrameworkRequired(
    context: OnboardingContext,
    result: PolicyResult,
  ): void {
    const grcEnabled = this.onboardingContextService.isSuiteEnabled(
      context,
      SuiteType.GRC_SUITE,
    );

    if (grcEnabled && context.activeFrameworks.length === 0) {
      result.warnings.push({
        code: PolicyCode.FRAMEWORK_REQUIRED,
        severity: WarningSeverity.WARNING,
        message:
          'GRC Suite is enabled but no compliance frameworks are active. Consider activating at least one framework (e.g., ISO27001, SOC2) for full functionality.',
        targets: ['grc', 'audit'],
      });
    }
  }

  private evaluateP2_AdvancedRiskScoring(
    context: OnboardingContext,
    result: PolicyResult,
  ): void {
    if (context.maturity === MaturityLevel.FOUNDATIONAL) {
      result.disabledFeatures.push('advanced_risk_scoring');
      result.metadata['advanced_risk_scoring_reason'] =
        'Requires intermediate or advanced maturity level';
    }
  }

  private evaluateP3_ISO27001Evidence(
    context: OnboardingContext,
    result: PolicyResult,
  ): void {
    const iso27001Active = this.onboardingContextService.isFrameworkActive(
      context,
      FrameworkType.ISO27001,
    );

    if (iso27001Active) {
      result.warnings.push({
        code: PolicyCode.ISO27001_EVIDENCE_RECOMMENDED,
        severity: WarningSeverity.INFO,
        message:
          'ISO 27001 framework is active. Evidence collection is recommended for all controls to support certification audits.',
        targets: ['grc', 'audit', 'control'],
      });
      result.metadata['iso27001_evidence_recommended'] = true;
    }
  }

  private evaluateP4_AuditScopeFiltered(
    context: OnboardingContext,
    result: PolicyResult,
  ): void {
    const availableStandards = this.getAvailableAuditStandards(context);
    result.metadata['audit_scope_standards'] = availableStandards;
    result.metadata['audit_scope_filtered_by_frameworks'] = true;
  }

  private evaluateP5_ClauseLevelAssessment(
    context: OnboardingContext,
    result: PolicyResult,
  ): void {
    if (context.maturity === MaturityLevel.FOUNDATIONAL) {
      result.warnings.push({
        code: PolicyCode.CLAUSE_LEVEL_ASSESSMENT_WARNING,
        severity: WarningSeverity.INFO,
        message:
          'Clause-level assessment is available but may be complex for foundational maturity. Consider starting with control-level assessments.',
        targets: ['audit'],
      });
    }
  }

  private evaluateP6_ItsmRelatedRisk(
    context: OnboardingContext,
    result: PolicyResult,
  ): void {
    const grcEnabled = this.onboardingContextService.isSuiteEnabled(
      context,
      SuiteType.GRC_SUITE,
    );

    if (!grcEnabled) {
      result.disabledFeatures.push('itsm_related_risk');
      result.metadata['itsm_related_risk_reason'] =
        'GRC Suite must be enabled to link incidents to risks';
    }
  }

  private evaluateP7_MajorIncidentAutomation(
    context: OnboardingContext,
    result: PolicyResult,
  ): void {
    if (context.maturity === MaturityLevel.FOUNDATIONAL) {
      result.disabledFeatures.push('major_incident_automation');
      result.metadata['major_incident_automation_reason'] =
        'Requires intermediate or advanced maturity level';
    }
  }

  private getAvailableAuditStandards(
    context: OnboardingContext,
  ): string[] {
    const frameworkToStandards: Record<FrameworkType, string[]> = {
      [FrameworkType.ISO27001]: [
        'ISO 27001:2022',
        'ISO 27001:2013',
        'ISO 27002:2022',
      ],
      [FrameworkType.SOC2]: [
        'SOC 2 Type I',
        'SOC 2 Type II',
        'SOC 1',
      ],
      [FrameworkType.GDPR]: [
        'GDPR',
        'EU Data Protection',
      ],
      [FrameworkType.HIPAA]: [
        'HIPAA Security Rule',
        'HIPAA Privacy Rule',
        'HITECH',
      ],
      [FrameworkType.NIST]: [
        'NIST CSF',
        'NIST 800-53',
        'NIST 800-171',
      ],
      [FrameworkType.PCI_DSS]: [
        'PCI DSS v4.0',
        'PCI DSS v3.2.1',
      ],
    };

    const availableStandards: string[] = [];
    for (const framework of context.activeFrameworks) {
      const standards = frameworkToStandards[framework];
      if (standards) {
        availableStandards.push(...standards);
      }
    }

    return availableStandards;
  }

  isFeatureDisabled(result: PolicyResult, feature: string): boolean {
    return result.disabledFeatures.includes(feature);
  }

  getWarningsForTarget(result: PolicyResult, target: string): PolicyWarning[] {
    return result.warnings.filter((w) => w.targets.includes(target));
  }

  hasWarning(result: PolicyResult, code: PolicyCode): boolean {
    return result.warnings.some((w) => w.code === code);
  }
}
