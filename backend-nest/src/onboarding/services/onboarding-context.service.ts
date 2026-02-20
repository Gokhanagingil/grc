import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TenantInitializationProfile,
  TenantActiveSuite,
  TenantEnabledModule,
  TenantActiveFramework,
  TenantMaturityProfile,
  SuiteType,
  ModuleType,
  FrameworkType,
  MaturityLevel,
} from '../entities';
import { getDefaultModulesForSuite } from '../config';
import { GrcTenantFramework } from '../../grc/entities/grc-tenant-framework.entity';

export interface OnboardingContext {
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

export const DEFAULT_ONBOARDING_CONTEXT: OnboardingContext = {
  status: 'active',
  schemaVersion: 1,
  policySetVersion: null,
  activeSuites: [],
  enabledModules: {
    [SuiteType.GRC_SUITE]: [],
    [SuiteType.ITSM_SUITE]: [],
  },
  activeFrameworks: [],
  maturity: MaturityLevel.FOUNDATIONAL,
  metadata: {
    initializedAt: null,
    lastUpdatedAt: null,
  },
};

@Injectable()
export class OnboardingContextService {
  private readonly logger = new Logger(OnboardingContextService.name);

  constructor(
    @InjectRepository(TenantInitializationProfile)
    private readonly initProfileRepository: Repository<TenantInitializationProfile>,
    @InjectRepository(TenantActiveSuite)
    private readonly activeSuiteRepository: Repository<TenantActiveSuite>,
    @InjectRepository(TenantEnabledModule)
    private readonly enabledModuleRepository: Repository<TenantEnabledModule>,
    @InjectRepository(TenantActiveFramework)
    private readonly activeFrameworkRepository: Repository<TenantActiveFramework>,
    @InjectRepository(TenantMaturityProfile)
    private readonly maturityProfileRepository: Repository<TenantMaturityProfile>,
    @InjectRepository(GrcTenantFramework)
    private readonly grcTenantFrameworkRepository: Repository<GrcTenantFramework>,
  ) {}

  /**
   * Get the onboarding context for a tenant.
   *
   * This method is designed to be fail-safe:
   * - If onboarding tables exist but are empty, returns conservative default context
   * - If any onboarding query fails, logs a warning and returns fallback context
   * - Never throws a runtime error - always returns a valid OnboardingContext
   */
  async getOnboardingContext(tenantId: string): Promise<OnboardingContext> {
    try {
      const [
        initProfile,
        activeSuites,
        enabledModules,
        activeFrameworks,
        maturityProfile,
        grcTenantFrameworks,
      ] = await Promise.all([
        this.initProfileRepository.findOne({
          where: { tenantId, isDeleted: false },
        }),
        this.activeSuiteRepository.find({
          where: { tenantId, isDeleted: false, isActive: true },
        }),
        this.enabledModuleRepository.find({
          where: { tenantId, isDeleted: false },
        }),
        this.activeFrameworkRepository.find({
          where: { tenantId, isDeleted: false, isActive: true },
        }),
        this.maturityProfileRepository.findOne({
          where: { tenantId, isDeleted: false },
        }),
        this.grcTenantFrameworkRepository.find({
          where: { tenantId },
          relations: ['framework'],
        }),
      ]);

      const grcFrameworkKeys = grcTenantFrameworks
        .filter((tf) => tf.framework && tf.framework.isActive)
        .map((tf) => tf.framework.key as FrameworkType);

      if (
        !initProfile &&
        activeSuites.length === 0 &&
        activeFrameworks.length === 0 &&
        grcFrameworkKeys.length === 0 &&
        !maturityProfile
      ) {
        this.logger.debug(
          `No onboarding data found for tenant ${tenantId}, returning default context`,
        );
        return { ...DEFAULT_ONBOARDING_CONTEXT };
      }

      const activeSuiteTypes = activeSuites.map((s) => s.suiteType);

      const enabledModulesMap: Record<SuiteType, ModuleType[]> = {
        [SuiteType.GRC_SUITE]: [],
        [SuiteType.ITSM_SUITE]: [],
      };

      for (const suiteType of activeSuiteTypes) {
        const defaultModules = getDefaultModulesForSuite(suiteType);
        const overrides = enabledModules.filter(
          (m) => m.suiteType === suiteType,
        );

        if (overrides.length === 0) {
          enabledModulesMap[suiteType] = defaultModules;
        } else {
          enabledModulesMap[suiteType] = overrides
            .filter((m) => m.isEnabled)
            .map((m) => m.moduleType);
        }
      }

      return {
        status: 'active',
        schemaVersion: initProfile?.schemaVersion ?? 1,
        policySetVersion: initProfile?.policySetVersion ?? null,
        activeSuites: activeSuiteTypes,
        enabledModules: enabledModulesMap,
        activeFrameworks: [
          ...new Set([
            ...activeFrameworks.map((f) => f.frameworkType),
            ...grcFrameworkKeys,
          ]),
        ].sort(),
        maturity: maturityProfile?.maturityLevel ?? MaturityLevel.FOUNDATIONAL,
        metadata: {
          initializedAt: initProfile?.initializedAt ?? null,
          lastUpdatedAt: initProfile?.updatedAt ?? null,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch onboarding context for tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}. Returning fallback context.`,
      );
      return { ...DEFAULT_ONBOARDING_CONTEXT };
    }
  }

  isSuiteEnabled(context: OnboardingContext, suiteType: SuiteType): boolean {
    return context.activeSuites.includes(suiteType);
  }

  isModuleEnabled(
    context: OnboardingContext,
    suiteType: SuiteType,
    moduleType: ModuleType,
  ): boolean {
    if (!this.isSuiteEnabled(context, suiteType)) {
      return false;
    }
    return context.enabledModules[suiteType]?.includes(moduleType) ?? false;
  }

  isFrameworkActive(
    context: OnboardingContext,
    frameworkType: FrameworkType,
  ): boolean {
    return context.activeFrameworks.includes(frameworkType);
  }

  isMaturityLevel(context: OnboardingContext, level: MaturityLevel): boolean {
    return context.maturity === level;
  }

  isMaturityAtLeast(context: OnboardingContext, level: MaturityLevel): boolean {
    const levels = [
      MaturityLevel.FOUNDATIONAL,
      MaturityLevel.INTERMEDIATE,
      MaturityLevel.ADVANCED,
    ];
    const currentIndex = levels.indexOf(context.maturity);
    const requiredIndex = levels.indexOf(level);
    return currentIndex >= requiredIndex;
  }
}
