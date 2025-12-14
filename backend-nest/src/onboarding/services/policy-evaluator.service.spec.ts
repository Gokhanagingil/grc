import { Test, TestingModule } from '@nestjs/testing';
import {
  PolicyEvaluatorService,
  PolicyCode,
  WarningSeverity,
} from './policy-evaluator.service';
import {
  OnboardingContextService,
  OnboardingContext,
  DEFAULT_ONBOARDING_CONTEXT,
} from './onboarding-context.service';
import {
  SuiteType,
  ModuleType,
  FrameworkType,
  MaturityLevel,
} from '../entities';

describe('PolicyEvaluatorService', () => {
  let service: PolicyEvaluatorService;

  beforeEach(async () => {
    const mockOnboardingContextService = {
      isSuiteEnabled: jest.fn(
        (context: OnboardingContext, suiteType: SuiteType) => {
          return context.activeSuites.includes(suiteType);
        },
      ),
      isModuleEnabled: jest.fn(
        (
          context: OnboardingContext,
          suiteType: SuiteType,
          moduleType: ModuleType,
        ) => {
          if (!context.activeSuites.includes(suiteType)) {
            return false;
          }
          return (
            context.enabledModules[suiteType]?.includes(moduleType) ?? false
          );
        },
      ),
      isFrameworkActive: jest.fn(
        (context: OnboardingContext, frameworkType: FrameworkType) => {
          return context.activeFrameworks.includes(frameworkType);
        },
      ),
      isMaturityLevel: jest.fn(
        (context: OnboardingContext, level: MaturityLevel) => {
          return context.maturity === level;
        },
      ),
      isMaturityAtLeast: jest.fn(
        (context: OnboardingContext, level: MaturityLevel) => {
          const levels = [
            MaturityLevel.FOUNDATIONAL,
            MaturityLevel.INTERMEDIATE,
            MaturityLevel.ADVANCED,
          ];
          const currentIndex = levels.indexOf(context.maturity);
          const requiredIndex = levels.indexOf(level);
          return currentIndex >= requiredIndex;
        },
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEvaluatorService,
        {
          provide: OnboardingContextService,
          useValue: mockOnboardingContextService,
        },
      ],
    }).compile();

    service = module.get<PolicyEvaluatorService>(PolicyEvaluatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('P1: Framework Required Warning', () => {
    it('should add FRAMEWORK_REQUIRED warning when GRC_SUITE enabled but no frameworks active', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [
            ModuleType.RISK,
            ModuleType.POLICY,
            ModuleType.CONTROL,
            ModuleType.AUDIT,
          ],
          [SuiteType.ITSM_SUITE]: [],
        },
        activeFrameworks: [],
      };

      const result = service.evaluate(context);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: PolicyCode.FRAMEWORK_REQUIRED,
          severity: WarningSeverity.WARNING,
          targets: expect.arrayContaining(['grc', 'audit']),
        }),
      );
    });

    it('should NOT add FRAMEWORK_REQUIRED warning when frameworks are active', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [
            ModuleType.RISK,
            ModuleType.POLICY,
            ModuleType.CONTROL,
            ModuleType.AUDIT,
          ],
          [SuiteType.ITSM_SUITE]: [],
        },
        activeFrameworks: [FrameworkType.ISO27001],
      };

      const result = service.evaluate(context);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          code: PolicyCode.FRAMEWORK_REQUIRED,
        }),
      );
    });
  });

  describe('S2/P2: Advanced Risk Scoring Disabled (Foundational Maturity)', () => {
    it('should disable advanced_risk_scoring when maturity is foundational', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [
            ModuleType.RISK,
            ModuleType.POLICY,
            ModuleType.CONTROL,
            ModuleType.AUDIT,
          ],
          [SuiteType.ITSM_SUITE]: [],
        },
        maturity: MaturityLevel.FOUNDATIONAL,
      };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).toContain('advanced_risk_scoring');
      expect(result.metadata['advanced_risk_scoring_reason']).toBeDefined();
    });

    it('should NOT disable advanced_risk_scoring when maturity is intermediate', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [
            ModuleType.RISK,
            ModuleType.POLICY,
            ModuleType.CONTROL,
            ModuleType.AUDIT,
          ],
          [SuiteType.ITSM_SUITE]: [],
        },
        maturity: MaturityLevel.INTERMEDIATE,
      };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).not.toContain('advanced_risk_scoring');
    });

    it('should NOT disable advanced_risk_scoring when maturity is advanced', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [
            ModuleType.RISK,
            ModuleType.POLICY,
            ModuleType.CONTROL,
            ModuleType.AUDIT,
          ],
          [SuiteType.ITSM_SUITE]: [],
        },
        maturity: MaturityLevel.ADVANCED,
      };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).not.toContain('advanced_risk_scoring');
    });
  });

  describe('P3: ISO27001 Evidence Recommended', () => {
    it('should add ISO27001_EVIDENCE_RECOMMENDED warning when ISO27001 is active', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        activeFrameworks: [FrameworkType.ISO27001],
      };

      const result = service.evaluate(context);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: PolicyCode.ISO27001_EVIDENCE_RECOMMENDED,
          severity: WarningSeverity.INFO,
        }),
      );
      expect(result.metadata['iso27001_evidence_recommended']).toBe(true);
    });
  });

  describe('P4: Audit Scope Filtered by Frameworks', () => {
    it('should include audit_scope_standards in metadata based on active frameworks', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        activeFrameworks: [FrameworkType.ISO27001, FrameworkType.SOC2],
      };

      const result = service.evaluate(context);

      expect(result.metadata['audit_scope_standards']).toBeDefined();
      expect(result.metadata['audit_scope_filtered_by_frameworks']).toBe(true);
      const standards = result.metadata['audit_scope_standards'] as string[];
      expect(standards).toContain('ISO 27001:2022');
      expect(standards).toContain('SOC 2 Type I');
    });

    it('should return empty audit_scope_standards when no frameworks active', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        activeFrameworks: [],
      };

      const result = service.evaluate(context);

      expect(result.metadata['audit_scope_standards']).toEqual([]);
    });
  });

  describe('P5: Clause Level Assessment Warning', () => {
    it('should add CLAUSE_LEVEL_ASSESSMENT_WARNING when maturity is foundational', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        maturity: MaturityLevel.FOUNDATIONAL,
      };

      const result = service.evaluate(context);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: PolicyCode.CLAUSE_LEVEL_ASSESSMENT_WARNING,
          severity: WarningSeverity.INFO,
          targets: expect.arrayContaining(['audit']),
        }),
      );
    });
  });

  describe('S6/P6: ITSM Related Risk Disabled (GRC Suite Not Enabled)', () => {
    it('should disable itsm_related_risk when GRC_SUITE is NOT enabled', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.ITSM_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [],
          [SuiteType.ITSM_SUITE]: [
            ModuleType.INCIDENT,
            ModuleType.REQUEST,
            ModuleType.CHANGE,
            ModuleType.PROBLEM,
            ModuleType.CMDB,
          ],
        },
      };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).toContain('itsm_related_risk');
      expect(result.metadata['itsm_related_risk_reason']).toBeDefined();
    });

    it('should NOT disable itsm_related_risk when GRC_SUITE is enabled', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE, SuiteType.ITSM_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [
            ModuleType.RISK,
            ModuleType.POLICY,
            ModuleType.CONTROL,
            ModuleType.AUDIT,
          ],
          [SuiteType.ITSM_SUITE]: [
            ModuleType.INCIDENT,
            ModuleType.REQUEST,
            ModuleType.CHANGE,
            ModuleType.PROBLEM,
            ModuleType.CMDB,
          ],
        },
      };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).not.toContain('itsm_related_risk');
    });

    it('should disable itsm_related_risk when no suites are enabled', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [],
          [SuiteType.ITSM_SUITE]: [],
        },
      };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).toContain('itsm_related_risk');
    });
  });

  describe('S7/P7: Major Incident Automation Disabled (Foundational Maturity)', () => {
    it('should disable major_incident_automation when maturity is foundational', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.ITSM_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [],
          [SuiteType.ITSM_SUITE]: [
            ModuleType.INCIDENT,
            ModuleType.REQUEST,
            ModuleType.CHANGE,
            ModuleType.PROBLEM,
            ModuleType.CMDB,
          ],
        },
        maturity: MaturityLevel.FOUNDATIONAL,
      };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).toContain('major_incident_automation');
      expect(result.metadata['major_incident_automation_reason']).toBeDefined();
    });

    it('should NOT disable major_incident_automation when maturity is intermediate', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.ITSM_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [],
          [SuiteType.ITSM_SUITE]: [
            ModuleType.INCIDENT,
            ModuleType.REQUEST,
            ModuleType.CHANGE,
            ModuleType.PROBLEM,
            ModuleType.CMDB,
          ],
        },
        maturity: MaturityLevel.INTERMEDIATE,
      };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).not.toContain(
        'major_incident_automation',
      );
    });

    it('should NOT disable major_incident_automation when maturity is advanced', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.ITSM_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [],
          [SuiteType.ITSM_SUITE]: [
            ModuleType.INCIDENT,
            ModuleType.REQUEST,
            ModuleType.CHANGE,
            ModuleType.PROBLEM,
            ModuleType.CMDB,
          ],
        },
        maturity: MaturityLevel.ADVANCED,
      };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).not.toContain(
        'major_incident_automation',
      );
    });
  });

  describe('helper methods', () => {
    it('isFeatureDisabled should return true when feature is in disabledFeatures', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        maturity: MaturityLevel.FOUNDATIONAL,
      };

      const result = service.evaluate(context);

      expect(service.isFeatureDisabled(result, 'advanced_risk_scoring')).toBe(
        true,
      );
      expect(service.isFeatureDisabled(result, 'some_other_feature')).toBe(
        false,
      );
    });

    it('getWarningsForTarget should return warnings that include the target', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        activeFrameworks: [],
        maturity: MaturityLevel.FOUNDATIONAL,
      };

      const result = service.evaluate(context);
      const auditWarnings = service.getWarningsForTarget(result, 'audit');

      expect(auditWarnings.length).toBeGreaterThan(0);
      auditWarnings.forEach((warning) => {
        expect(warning.targets).toContain('audit');
      });
    });

    it('hasWarning should return true when warning code exists', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        activeFrameworks: [],
      };

      const result = service.evaluate(context);

      expect(service.hasWarning(result, PolicyCode.FRAMEWORK_REQUIRED)).toBe(
        true,
      );
      expect(
        service.hasWarning(result, PolicyCode.ISO27001_EVIDENCE_RECOMMENDED),
      ).toBe(false);
    });
  });

  describe('combined scenarios', () => {
    it('should handle full GRC+ITSM setup with all frameworks and advanced maturity', () => {
      const context: OnboardingContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE, SuiteType.ITSM_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [
            ModuleType.RISK,
            ModuleType.POLICY,
            ModuleType.CONTROL,
            ModuleType.AUDIT,
          ],
          [SuiteType.ITSM_SUITE]: [
            ModuleType.INCIDENT,
            ModuleType.REQUEST,
            ModuleType.CHANGE,
            ModuleType.PROBLEM,
            ModuleType.CMDB,
          ],
        },
        activeFrameworks: [
          FrameworkType.ISO27001,
          FrameworkType.SOC2,
          FrameworkType.GDPR,
        ],
        maturity: MaturityLevel.ADVANCED,
      };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).not.toContain('advanced_risk_scoring');
      expect(result.disabledFeatures).not.toContain('itsm_related_risk');
      expect(result.disabledFeatures).not.toContain(
        'major_incident_automation',
      );
      expect(service.hasWarning(result, PolicyCode.FRAMEWORK_REQUIRED)).toBe(
        false,
      );
      expect(
        service.hasWarning(result, PolicyCode.ISO27001_EVIDENCE_RECOMMENDED),
      ).toBe(true);
    });

    it('should handle minimal setup with default context', () => {
      const context: OnboardingContext = { ...DEFAULT_ONBOARDING_CONTEXT };

      const result = service.evaluate(context);

      expect(result.disabledFeatures).toContain('advanced_risk_scoring');
      expect(result.disabledFeatures).toContain('itsm_related_risk');
      expect(result.disabledFeatures).toContain('major_incident_automation');
      expect(service.hasWarning(result, PolicyCode.FRAMEWORK_REQUIRED)).toBe(
        false,
      );
    });
  });
});
