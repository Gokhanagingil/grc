import {
  SuiteType,
  ModuleType,
  FrameworkType,
  MaturityLevel,
} from '../entities';
import {
  PolicyCode,
  WarningSeverity,
} from '../services/policy-evaluator.service';

export class OnboardingContextResponseDto {
  status: 'active' | 'pending' | 'suspended';
  schemaVersion: number;
  policySetVersion: string | null;
  activeSuites: SuiteType[];
  enabledModules: Record<SuiteType, ModuleType[]>;
  activeFrameworks: FrameworkType[];
  maturity: MaturityLevel;
  metadata: {
    initializedAt: Date | null;
    lastUpdatedAt: Date | null;
  };
}

export class PolicyWarningDto {
  code: PolicyCode;
  severity: WarningSeverity;
  message: string;
  targets: string[];
}

export class PolicyResultDto {
  disabledFeatures: string[];
  warnings: PolicyWarningDto[];
  metadata: Record<string, unknown>;
}

export class OnboardingContextWithPolicyDto {
  context: OnboardingContextResponseDto;
  policy: PolicyResultDto;
}
