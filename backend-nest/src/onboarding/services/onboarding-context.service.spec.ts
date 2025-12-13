import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OnboardingContextService,
  DEFAULT_ONBOARDING_CONTEXT,
} from './onboarding-context.service';
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

describe('OnboardingContextService', () => {
  let service: OnboardingContextService;
  let initProfileRepository: jest.Mocked<Repository<TenantInitializationProfile>>;
  let activeSuiteRepository: jest.Mocked<Repository<TenantActiveSuite>>;
  let enabledModuleRepository: jest.Mocked<Repository<TenantEnabledModule>>;
  let activeFrameworkRepository: jest.Mocked<Repository<TenantActiveFramework>>;
  let maturityProfileRepository: jest.Mocked<Repository<TenantMaturityProfile>>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const mockInitProfileRepository = {
      findOne: jest.fn(),
    };

    const mockActiveSuiteRepository = {
      find: jest.fn(),
    };

    const mockEnabledModuleRepository = {
      find: jest.fn(),
    };

    const mockActiveFrameworkRepository = {
      find: jest.fn(),
    };

    const mockMaturityProfileRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingContextService,
        {
          provide: getRepositoryToken(TenantInitializationProfile),
          useValue: mockInitProfileRepository,
        },
        {
          provide: getRepositoryToken(TenantActiveSuite),
          useValue: mockActiveSuiteRepository,
        },
        {
          provide: getRepositoryToken(TenantEnabledModule),
          useValue: mockEnabledModuleRepository,
        },
        {
          provide: getRepositoryToken(TenantActiveFramework),
          useValue: mockActiveFrameworkRepository,
        },
        {
          provide: getRepositoryToken(TenantMaturityProfile),
          useValue: mockMaturityProfileRepository,
        },
      ],
    }).compile();

    service = module.get<OnboardingContextService>(OnboardingContextService);
    initProfileRepository = module.get(getRepositoryToken(TenantInitializationProfile));
    activeSuiteRepository = module.get(getRepositoryToken(TenantActiveSuite));
    enabledModuleRepository = module.get(getRepositoryToken(TenantEnabledModule));
    activeFrameworkRepository = module.get(getRepositoryToken(TenantActiveFramework));
    maturityProfileRepository = module.get(getRepositoryToken(TenantMaturityProfile));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOnboardingContext', () => {
    describe('fallback defaults', () => {
      it('should return default context when no records exist for tenant', async () => {
        initProfileRepository.findOne.mockResolvedValue(null);
        activeSuiteRepository.find.mockResolvedValue([]);
        enabledModuleRepository.find.mockResolvedValue([]);
        activeFrameworkRepository.find.mockResolvedValue([]);
        maturityProfileRepository.findOne.mockResolvedValue(null);

        const result = await service.getOnboardingContext(mockTenantId);

        expect(result).toEqual(DEFAULT_ONBOARDING_CONTEXT);
        expect(result.status).toBe('active');
        expect(result.activeSuites).toEqual([]);
        expect(result.enabledModules).toEqual({
          [SuiteType.GRC_SUITE]: [],
          [SuiteType.ITSM_SUITE]: [],
        });
        expect(result.activeFrameworks).toEqual([]);
        expect(result.maturity).toBe(MaturityLevel.FOUNDATIONAL);
      });

      it('should return default maturity level (foundational) when no maturity profile exists', async () => {
        initProfileRepository.findOne.mockResolvedValue({
          id: 'init-1',
          tenantId: mockTenantId,
          schemaVersion: 1,
          policySetVersion: null,
          isDeleted: false,
        } as TenantInitializationProfile);
        activeSuiteRepository.find.mockResolvedValue([
          {
            id: 'suite-1',
            tenantId: mockTenantId,
            suiteType: SuiteType.GRC_SUITE,
            isActive: true,
            isDeleted: false,
          } as TenantActiveSuite,
        ]);
        enabledModuleRepository.find.mockResolvedValue([]);
        activeFrameworkRepository.find.mockResolvedValue([]);
        maturityProfileRepository.findOne.mockResolvedValue(null);

        const result = await service.getOnboardingContext(mockTenantId);

        expect(result.maturity).toBe(MaturityLevel.FOUNDATIONAL);
      });
    });

    describe('overrides', () => {
      it('should return active suites when configured', async () => {
        initProfileRepository.findOne.mockResolvedValue(null);
        activeSuiteRepository.find.mockResolvedValue([
          {
            id: 'suite-1',
            tenantId: mockTenantId,
            suiteType: SuiteType.GRC_SUITE,
            isActive: true,
            isDeleted: false,
          } as TenantActiveSuite,
          {
            id: 'suite-2',
            tenantId: mockTenantId,
            suiteType: SuiteType.ITSM_SUITE,
            isActive: true,
            isDeleted: false,
          } as TenantActiveSuite,
        ]);
        enabledModuleRepository.find.mockResolvedValue([]);
        activeFrameworkRepository.find.mockResolvedValue([]);
        maturityProfileRepository.findOne.mockResolvedValue(null);

        const result = await service.getOnboardingContext(mockTenantId);

        expect(result.activeSuites).toContain(SuiteType.GRC_SUITE);
        expect(result.activeSuites).toContain(SuiteType.ITSM_SUITE);
      });

      it('should return default modules for active suites when no overrides exist', async () => {
        initProfileRepository.findOne.mockResolvedValue(null);
        activeSuiteRepository.find.mockResolvedValue([
          {
            id: 'suite-1',
            tenantId: mockTenantId,
            suiteType: SuiteType.GRC_SUITE,
            isActive: true,
            isDeleted: false,
          } as TenantActiveSuite,
        ]);
        enabledModuleRepository.find.mockResolvedValue([]);
        activeFrameworkRepository.find.mockResolvedValue([]);
        maturityProfileRepository.findOne.mockResolvedValue(null);

        const result = await service.getOnboardingContext(mockTenantId);

        expect(result.enabledModules[SuiteType.GRC_SUITE]).toContain(ModuleType.RISK);
        expect(result.enabledModules[SuiteType.GRC_SUITE]).toContain(ModuleType.POLICY);
        expect(result.enabledModules[SuiteType.GRC_SUITE]).toContain(ModuleType.CONTROL);
        expect(result.enabledModules[SuiteType.GRC_SUITE]).toContain(ModuleType.AUDIT);
      });

      it('should override default modules when module overrides exist', async () => {
        initProfileRepository.findOne.mockResolvedValue(null);
        activeSuiteRepository.find.mockResolvedValue([
          {
            id: 'suite-1',
            tenantId: mockTenantId,
            suiteType: SuiteType.GRC_SUITE,
            isActive: true,
            isDeleted: false,
          } as TenantActiveSuite,
        ]);
        enabledModuleRepository.find.mockResolvedValue([
          {
            id: 'module-1',
            tenantId: mockTenantId,
            suiteType: SuiteType.GRC_SUITE,
            moduleType: ModuleType.RISK,
            isEnabled: true,
            isDeleted: false,
          } as TenantEnabledModule,
          {
            id: 'module-2',
            tenantId: mockTenantId,
            suiteType: SuiteType.GRC_SUITE,
            moduleType: ModuleType.AUDIT,
            isEnabled: false,
            isDeleted: false,
          } as TenantEnabledModule,
        ]);
        activeFrameworkRepository.find.mockResolvedValue([]);
        maturityProfileRepository.findOne.mockResolvedValue(null);

        const result = await service.getOnboardingContext(mockTenantId);

        expect(result.enabledModules[SuiteType.GRC_SUITE]).toContain(ModuleType.RISK);
        expect(result.enabledModules[SuiteType.GRC_SUITE]).not.toContain(ModuleType.AUDIT);
      });

      it('should return active frameworks when configured', async () => {
        initProfileRepository.findOne.mockResolvedValue(null);
        activeSuiteRepository.find.mockResolvedValue([]);
        enabledModuleRepository.find.mockResolvedValue([]);
        activeFrameworkRepository.find.mockResolvedValue([
          {
            id: 'framework-1',
            tenantId: mockTenantId,
            frameworkType: FrameworkType.ISO27001,
            isActive: true,
            isDeleted: false,
          } as TenantActiveFramework,
          {
            id: 'framework-2',
            tenantId: mockTenantId,
            frameworkType: FrameworkType.SOC2,
            isActive: true,
            isDeleted: false,
          } as TenantActiveFramework,
        ]);
        maturityProfileRepository.findOne.mockResolvedValue(null);

        const result = await service.getOnboardingContext(mockTenantId);

        expect(result.activeFrameworks).toContain(FrameworkType.ISO27001);
        expect(result.activeFrameworks).toContain(FrameworkType.SOC2);
      });

      it('should return configured maturity level', async () => {
        initProfileRepository.findOne.mockResolvedValue(null);
        activeSuiteRepository.find.mockResolvedValue([
          {
            id: 'suite-1',
            tenantId: mockTenantId,
            suiteType: SuiteType.GRC_SUITE,
            isActive: true,
            isDeleted: false,
          } as TenantActiveSuite,
        ]);
        enabledModuleRepository.find.mockResolvedValue([]);
        activeFrameworkRepository.find.mockResolvedValue([]);
        maturityProfileRepository.findOne.mockResolvedValue({
          id: 'maturity-1',
          tenantId: mockTenantId,
          maturityLevel: MaturityLevel.ADVANCED,
          isDeleted: false,
        } as TenantMaturityProfile);

        const result = await service.getOnboardingContext(mockTenantId);

        expect(result.maturity).toBe(MaturityLevel.ADVANCED);
      });
    });
  });

  describe('helper methods', () => {
    it('isSuiteEnabled should return true when suite is in activeSuites', () => {
      const context = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
      };

      expect(service.isSuiteEnabled(context, SuiteType.GRC_SUITE)).toBe(true);
      expect(service.isSuiteEnabled(context, SuiteType.ITSM_SUITE)).toBe(false);
    });

    it('isModuleEnabled should return true when module is enabled in suite', () => {
      const context = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeSuites: [SuiteType.GRC_SUITE],
        enabledModules: {
          [SuiteType.GRC_SUITE]: [ModuleType.RISK, ModuleType.POLICY],
          [SuiteType.ITSM_SUITE]: [],
        },
      };

      expect(service.isModuleEnabled(context, SuiteType.GRC_SUITE, ModuleType.RISK)).toBe(true);
      expect(service.isModuleEnabled(context, SuiteType.GRC_SUITE, ModuleType.AUDIT)).toBe(false);
      expect(service.isModuleEnabled(context, SuiteType.ITSM_SUITE, ModuleType.INCIDENT)).toBe(false);
    });

    it('isFrameworkActive should return true when framework is in activeFrameworks', () => {
      const context = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        activeFrameworks: [FrameworkType.ISO27001],
      };

      expect(service.isFrameworkActive(context, FrameworkType.ISO27001)).toBe(true);
      expect(service.isFrameworkActive(context, FrameworkType.SOC2)).toBe(false);
    });

    it('isMaturityAtLeast should correctly compare maturity levels', () => {
      const foundationalContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        maturity: MaturityLevel.FOUNDATIONAL,
      };
      const intermediateContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        maturity: MaturityLevel.INTERMEDIATE,
      };
      const advancedContext = {
        ...DEFAULT_ONBOARDING_CONTEXT,
        maturity: MaturityLevel.ADVANCED,
      };

      expect(service.isMaturityAtLeast(foundationalContext, MaturityLevel.FOUNDATIONAL)).toBe(true);
      expect(service.isMaturityAtLeast(foundationalContext, MaturityLevel.INTERMEDIATE)).toBe(false);
      expect(service.isMaturityAtLeast(intermediateContext, MaturityLevel.FOUNDATIONAL)).toBe(true);
      expect(service.isMaturityAtLeast(intermediateContext, MaturityLevel.INTERMEDIATE)).toBe(true);
      expect(service.isMaturityAtLeast(advancedContext, MaturityLevel.ADVANCED)).toBe(true);
    });
  });
});
