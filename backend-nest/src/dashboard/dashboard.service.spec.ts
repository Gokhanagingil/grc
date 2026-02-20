import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { GrcRiskService } from '../grc/services/grc-risk.service';
import { GrcPolicyService } from '../grc/services/grc-policy.service';
import { GrcRequirementService } from '../grc/services/grc-requirement.service';
import { IncidentService } from '../itsm/incident/incident.service';
import { ComplianceFramework } from '../grc/enums';
import { GrcRequirement } from '../grc/entities/grc-requirement.entity';

describe('DashboardService', () => {
  let service: DashboardService;
  let riskService: jest.Mocked<GrcRiskService>;
  let policyService: jest.Mocked<GrcPolicyService>;
  let requirementService: jest.Mocked<GrcRequirementService>;
  let incidentService: jest.Mocked<IncidentService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';

  const mockRiskSummary = {
    total: 10,
    totalCount: 10,
    byStatus: {
      identified: 3,
      open: 2,
      in_progress: 1,
      mitigated: 2,
      closed: 2,
    },
    bySeverity: {
      critical: 1,
      high: 3,
      medium: 4,
      low: 2,
    },
    byLikelihood: {},
    byCategory: {},
    highPriorityCount: 4,
    overdueCount: 2,
    top5OpenRisks: [
      { id: 'risk-1', title: 'Risk 1', severity: 'high', score: 12 },
      { id: 'risk-2', title: 'Risk 2', severity: 'critical', score: 16 },
    ],
    totalLinkedPolicies: 5,
    totalLinkedRequirements: 3,
    risksWithPoliciesCount: 4,
    risksWithRequirementsCount: 2,
  };

  const mockPolicySummary = {
    total: 8,
    totalCount: 8,
    byStatus: {
      active: 5,
      draft: 2,
      archived: 1,
    },
    byCategory: {},
    dueForReviewCount: 1,
    activeCount: 5,
    draftCount: 2,
    policyCoveragePercentage: 62.5,
    totalLinkedRisks: 5,
    policiesWithRisksCount: 4,
  };

  const mockRequirementSummary = {
    total: 15,
    totalCount: 15,
    byFramework: {
      'ISO 27001': 5,
      GDPR: 4,
      SOC2: 3,
      Other: 3,
    },
    byStatus: {},
    byCategory: {},
    byPriority: {},
    compliantCount: 8,
    nonCompliantCount: 3,
    inProgressCount: 4,
    requirementCoveragePercentage: 53.3,
    totalLinkedRisks: 3,
    requirementsWithRisksCount: 2,
  };

  const mockIncidentSummary = {
    total: 12,
    totalCount: 12,
    byStatus: {
      open: 4,
      resolved: 5,
      closed: 3,
    },
    byPriority: {},
    byCategory: {},
    bySource: {},
    openCount: 4,
    closedCount: 3,
    resolvedCount: 5,
    resolvedToday: 2,
    avgResolutionTimeHours: 24.5,
  };

  const mockRequirements: Partial<GrcRequirement>[] = [
    {
      id: 'req-1',
      framework: ComplianceFramework.ISO27001,
      status: 'compliant' as any,
    },
    {
      id: 'req-2',
      framework: ComplianceFramework.ISO27001,
      status: 'in_progress' as any,
    },
    {
      id: 'req-3',
      framework: ComplianceFramework.GDPR,
      status: 'compliant' as any,
    },
    {
      id: 'req-4',
      framework: ComplianceFramework.GDPR,
      status: 'non_compliant' as any,
    },
    {
      id: 'req-5',
      framework: ComplianceFramework.SOC2,
      status: 'compliant' as any,
    },
  ];

  beforeEach(async () => {
    const mockRiskService = {
      getSummary: jest.fn().mockResolvedValue(mockRiskSummary),
    };

    const mockPolicyService = {
      getSummary: jest.fn().mockResolvedValue(mockPolicySummary),
    };

    const mockRequirementService = {
      getSummary: jest.fn().mockResolvedValue(mockRequirementSummary),
      findAllActiveForTenant: jest.fn().mockResolvedValue(mockRequirements),
    };

    const mockIncidentService = {
      getSummary: jest.fn().mockResolvedValue(mockIncidentSummary),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: GrcRiskService, useValue: mockRiskService },
        { provide: GrcPolicyService, useValue: mockPolicyService },
        { provide: GrcRequirementService, useValue: mockRequirementService },
        { provide: IncidentService, useValue: mockIncidentService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    riskService = module.get(GrcRiskService);
    policyService = module.get(GrcPolicyService);
    requirementService = module.get(GrcRequirementService);
    incidentService = module.get(IncidentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return aggregated dashboard overview', async () => {
      const result = await service.getOverview(mockTenantId);

      expect(result).toBeDefined();
      expect(riskService.getSummary).toHaveBeenCalledWith(mockTenantId);
      expect(policyService.getSummary).toHaveBeenCalledWith(mockTenantId);
      expect(requirementService.getSummary).toHaveBeenCalledWith(mockTenantId);
      expect(incidentService.getSummary).toHaveBeenCalledWith(mockTenantId);
    });

    it('should return correct risk data', async () => {
      const result = await service.getOverview(mockTenantId);

      expect(result.risks).toEqual({
        total: 10,
        open: 6, // identified(3) + open(2) + in_progress(1)
        high: 4, // high(3) + critical(1)
        overdue: 2,
        top5OpenRisks: mockRiskSummary.top5OpenRisks,
      });
    });

    it('should return correct compliance data', async () => {
      const result = await service.getOverview(mockTenantId);

      expect(result.compliance).toEqual({
        total: 15,
        pending: 4, // inProgressCount
        completed: 8, // compliantCount
        overdue: 3, // nonCompliantCount
        coveragePercentage: 53.3,
      });
    });

    it('should return correct policy data', async () => {
      const result = await service.getOverview(mockTenantId);

      expect(result.policies).toEqual({
        total: 8,
        active: 5,
        draft: 2,
        coveragePercentage: 62.5,
      });
    });

    it('should return correct incident data', async () => {
      const result = await service.getOverview(mockTenantId);

      expect(result.incidents).toEqual({
        total: 12,
        open: 4,
        closed: 3,
        resolved: 5,
        resolvedToday: 2,
        avgResolutionTimeHours: 24.5,
      });
    });

    it('should return zero user counts (not implemented)', async () => {
      const result = await service.getOverview(mockTenantId);

      expect(result.users).toEqual({
        total: 0,
        admins: 0,
        managers: 0,
      });
    });

    it('should handle empty risk summary gracefully', async () => {
      riskService.getSummary.mockResolvedValue({
        total: 0,
        totalCount: 0,
        byStatus: {},
        bySeverity: {},
        byLikelihood: {},
        byCategory: {},
        highPriorityCount: 0,
        overdueCount: 0,
        top5OpenRisks: [],
        totalLinkedPolicies: 0,
        totalLinkedRequirements: 0,
        risksWithPoliciesCount: 0,
        risksWithRequirementsCount: 0,
      });

      const result = await service.getOverview(mockTenantId);

      expect(result.risks).toEqual({
        total: 0,
        open: 0,
        high: 0,
        overdue: 0,
        top5OpenRisks: [],
      });
    });
  });

  describe('getRiskTrends', () => {
    it('should return risk trends data', async () => {
      const result = await service.getRiskTrends(mockTenantId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(riskService.getSummary).toHaveBeenCalledWith(mockTenantId);
    });

    it('should return data with correct structure', async () => {
      const result = await service.getRiskTrends(mockTenantId);

      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('total_risks');
      expect(result[0]).toHaveProperty('critical');
      expect(result[0]).toHaveProperty('high');
      expect(result[0]).toHaveProperty('medium');
      expect(result[0]).toHaveProperty('low');
    });

    it('should return correct severity breakdown', async () => {
      const result = await service.getRiskTrends(mockTenantId);

      expect(result[0].total_risks).toBe(10);
      expect(result[0].critical).toBe(1);
      expect(result[0].high).toBe(3);
      expect(result[0].medium).toBe(4);
      expect(result[0].low).toBe(2);
    });

    it("should return today's date", async () => {
      const result = await service.getRiskTrends(mockTenantId);
      const today = new Date().toISOString().split('T')[0];

      expect(result[0].date).toBe(today);
    });

    it('should handle empty risk data gracefully', async () => {
      riskService.getSummary.mockResolvedValue({
        total: 0,
        totalCount: 0,
        byStatus: {},
        bySeverity: {},
        byLikelihood: {},
        byCategory: {},
        highPriorityCount: 0,
        overdueCount: 0,
        top5OpenRisks: [],
        totalLinkedPolicies: 0,
        totalLinkedRequirements: 0,
        risksWithPoliciesCount: 0,
        risksWithRequirementsCount: 0,
      });

      const result = await service.getRiskTrends(mockTenantId);

      expect(result[0].total_risks).toBe(0);
      expect(result[0].critical).toBe(0);
      expect(result[0].high).toBe(0);
      expect(result[0].medium).toBe(0);
      expect(result[0].low).toBe(0);
    });
  });

  describe('getComplianceByRegulation', () => {
    it('should return compliance by regulation data', async () => {
      const result = await service.getComplianceByRegulation(mockTenantId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(requirementService.findAllActiveForTenant).toHaveBeenCalledWith(
        mockTenantId,
      );
    });

    it('should group requirements by framework', async () => {
      const result = await service.getComplianceByRegulation(mockTenantId);

      // Should have 3 frameworks: gdpr, iso27001, soc2 (enum values)
      expect(result.length).toBe(3);

      const frameworks = result.map((r) => r.regulation);
      expect(frameworks).toContain(ComplianceFramework.ISO27001); // 'iso27001'
      expect(frameworks).toContain(ComplianceFramework.GDPR); // 'gdpr'
      expect(frameworks).toContain(ComplianceFramework.SOC2); // 'soc2'
    });

    it('should count statuses correctly per framework', async () => {
      const result = await service.getComplianceByRegulation(mockTenantId);

      // Find ISO 27001 entry (using enum value 'iso27001')
      const iso27001 = result.find(
        (r) => r.regulation === (ComplianceFramework.ISO27001 as string),
      );
      expect(iso27001).toBeDefined();
      expect(iso27001?.completed).toBe(1); // 1 compliant
      expect(iso27001?.pending).toBe(1); // 1 in_progress

      // Find GDPR entry (using enum value 'gdpr')
      const gdpr = result.find(
        (r) => r.regulation === (ComplianceFramework.GDPR as string),
      );
      expect(gdpr).toBeDefined();
      expect(gdpr?.completed).toBe(1); // 1 compliant
      expect(gdpr?.overdue).toBe(1); // 1 non_compliant
    });

    it('should sort results by regulation name', async () => {
      const result = await service.getComplianceByRegulation(mockTenantId);

      const regulations = result.map((r) => r.regulation);
      const sortedRegulations = [...regulations].sort();
      expect(regulations).toEqual(sortedRegulations);
    });

    it('should handle empty requirements gracefully', async () => {
      requirementService.findAllActiveForTenant.mockResolvedValue([]);

      const result = await service.getComplianceByRegulation(mockTenantId);

      expect(result).toEqual([]);
    });

    it('should use "Other" for requirements without framework', async () => {
      requirementService.findAllActiveForTenant.mockResolvedValue([
        { id: 'req-1', framework: null, status: 'compliant' },
        { id: 'req-2', framework: undefined, status: 'in_progress' },
      ] as unknown as GrcRequirement[]);

      const result = await service.getComplianceByRegulation(mockTenantId);

      expect(result.length).toBe(1);
      expect(result[0].regulation).toBe('Other');
      expect(result[0].completed).toBe(1);
      expect(result[0].pending).toBe(1);
    });

    it('should map unknown statuses to pending', async () => {
      requirementService.findAllActiveForTenant.mockResolvedValue([
        {
          id: 'req-1',
          framework: ComplianceFramework.OTHER,
          status: 'unknown_status',
        },
      ] as unknown as GrcRequirement[]);

      const result = await service.getComplianceByRegulation(mockTenantId);

      expect(result[0].pending).toBe(1);
      expect(result[0].completed).toBe(0);
      expect(result[0].overdue).toBe(0);
    });
  });

  describe('tenant isolation', () => {
    it('should pass tenant ID to all service calls in getOverview', async () => {
      await service.getOverview(mockTenantId);

      expect(riskService.getSummary).toHaveBeenCalledWith(mockTenantId);
      expect(policyService.getSummary).toHaveBeenCalledWith(mockTenantId);
      expect(requirementService.getSummary).toHaveBeenCalledWith(mockTenantId);
      expect(incidentService.getSummary).toHaveBeenCalledWith(mockTenantId);
    });

    it('should pass tenant ID to risk service in getRiskTrends', async () => {
      await service.getRiskTrends(mockTenantId);

      expect(riskService.getSummary).toHaveBeenCalledWith(mockTenantId);
    });

    it('should pass tenant ID to requirement service in getComplianceByRegulation', async () => {
      await service.getComplianceByRegulation(mockTenantId);

      expect(requirementService.findAllActiveForTenant).toHaveBeenCalledWith(
        mockTenantId,
      );
    });
  });
});
