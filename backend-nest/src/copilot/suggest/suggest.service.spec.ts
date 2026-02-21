import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SuggestService } from './suggest.service';
import { ServiceNowClientService, SnIncident } from '../servicenow';
import { CopilotIncidentIndex, CopilotKbIndex } from '../entities';

describe('SuggestService', () => {
  let service: SuggestService;
  let snClient: jest.Mocked<ServiceNowClientService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';

  const mockSnIncident: SnIncident = {
    sys_id: 'inc123',
    number: 'INC0001',
    short_description: 'Email server not responding',
    description: 'The email server has been down since this morning',
    state: '2',
    impact: '2',
    urgency: '2',
    priority: '3',
    category: 'Software',
    assignment_group: 'IT Support',
    assigned_to: 'John Doe',
    service_offering: 'Email',
    business_service: 'Corporate Email',
    opened_at: '2025-01-01T00:00:00Z',
    resolved_at: '',
    closed_at: '',
    close_code: '',
    close_notes: '',
    sys_created_on: '2025-01-01T00:00:00Z',
    sys_updated_on: '2025-01-02T00:00:00Z',
    work_notes: '',
    comments: '',
  };

  const mockIncidentIndexRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockKbIndexRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const mockSnClient = {
      getIncident: jest.fn().mockResolvedValue(mockSnIncident),
      listIncidents: jest.fn(),
      postComment: jest.fn(),
      listKbArticles: jest.fn(),
      getTenantConfig: jest.fn().mockReturnValue({
        instanceUrl: 'https://test.service-now.com',
        username: 'admin',
        password: 'pass',
      }),
    };

    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockIncidentIndexRepo.createQueryBuilder.mockReturnValue(qb);
    mockKbIndexRepo.createQueryBuilder.mockReturnValue(qb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestService,
        { provide: ServiceNowClientService, useValue: mockSnClient },
        {
          provide: getRepositoryToken(CopilotIncidentIndex),
          useValue: mockIncidentIndexRepo,
        },
        {
          provide: getRepositoryToken(CopilotKbIndex),
          useValue: mockKbIndexRepo,
        },
      ],
    }).compile();

    service = module.get<SuggestService>(SuggestService);
    snClient = module.get(ServiceNowClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('suggest', () => {
    it('should return response with stable schema', async () => {
      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);

      expect(result).toHaveProperty('incidentSysId', 'inc123');
      expect(result).toHaveProperty('incidentNumber', 'INC0001');
      expect(result).toHaveProperty('actionCards');
      expect(result).toHaveProperty('similarIncidents');
      expect(result).toHaveProperty('kbSuggestions');
      expect(result).toHaveProperty('generatedAt');
      expect(Array.isArray(result.actionCards)).toBe(true);
      expect(Array.isArray(result.similarIncidents)).toBe(true);
      expect(Array.isArray(result.kbSuggestions)).toBe(true);
    });

    it('should generate exactly 4 action cards', async () => {
      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);
      expect(result.actionCards).toHaveLength(4);
    });

    it('should generate action cards with correct types', async () => {
      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);
      const types = result.actionCards.map((c) => c.type);
      expect(types).toContain('summary');
      expect(types).toContain('next_best_steps');
      expect(types).toContain('customer_update_draft');
      expect(types).toContain('work_notes_draft');
    });

    it('should mark customer_update_draft as canApply with additional_comments targetField', async () => {
      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);
      const card = result.actionCards.find(
        (c) => c.type === 'customer_update_draft',
      );
      expect(card).toBeDefined();
      expect(card!.canApply).toBe(true);
      expect(card!.targetField).toBe('additional_comments');
    });

    it('should mark work_notes_draft as canApply with work_notes targetField', async () => {
      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);
      const card = result.actionCards.find(
        (c) => c.type === 'work_notes_draft',
      );
      expect(card).toBeDefined();
      expect(card!.canApply).toBe(true);
      expect(card!.targetField).toBe('work_notes');
    });

    it('should mark summary as non-applyable', async () => {
      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);
      const card = result.actionCards.find((c) => c.type === 'summary');
      expect(card!.canApply).toBe(false);
    });

    it('should throw when incident not found in SN or index', async () => {
      snClient.getIncident.mockResolvedValue(null);
      mockIncidentIndexRepo.findOne.mockResolvedValue(null);

      await expect(
        service.suggest(mockTenantId, 'nonexistent', 5, 3),
      ).rejects.toThrow(
        'Incident nonexistent not found in ServiceNow or local index',
      );
    });

    it('should throw config-missing error when SN not configured and incident not in index', async () => {
      snClient.getTenantConfig.mockReturnValue(null);
      mockIncidentIndexRepo.findOne.mockResolvedValue(null);

      await expect(
        service.suggest(mockTenantId, 'inc123', 5, 3),
      ).rejects.toThrow(
        'ServiceNow integration is not configured for this tenant',
      );
    });

    it('should skip SN call and fall back to index when SN not configured', async () => {
      snClient.getTenantConfig.mockReturnValue(null);
      const mockIndexed = {
        id: 'idx1',
        tenantId: mockTenantId,
        sysId: 'inc123',
        number: 'INC0001',
        shortDescription: 'Email server not responding',
        description: 'Down since morning',
        state: '6',
        resolutionCode: 'Solved',
        resolutionNotes: 'Restarted service',
        category: 'Software',
        priority: '3',
        assignmentGroup: 'IT Support',
        resolvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockIncidentIndexRepo.findOne.mockResolvedValue(mockIndexed);

      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);

      // Should NOT call getIncident when config is missing
      expect(snClient.getIncident).not.toHaveBeenCalled();
      // Should still return valid response from index
      expect(result).toHaveProperty('incidentSysId', 'inc123');
      expect(result).toHaveProperty('actionCards');
      expect(Array.isArray(result.actionCards)).toBe(true);
    });

    it('should include confidence scores on action cards', async () => {
      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);
      for (const card of result.actionCards) {
        expect(typeof card.confidence).toBe('number');
        expect(card.confidence).toBeGreaterThan(0);
        expect(card.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should include non-empty content for all action cards', async () => {
      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);
      for (const card of result.actionCards) {
        expect(card.content.length).toBeGreaterThan(0);
      }
    });

    it('should include incident number in summary content', async () => {
      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);
      const summary = result.actionCards.find((c) => c.type === 'summary');
      expect(summary!.content).toContain('INC0001');
    });

    it('should include incident number in customer update', async () => {
      const result = await service.suggest(mockTenantId, 'inc123', 5, 3);
      const card = result.actionCards.find(
        (c) => c.type === 'customer_update_draft',
      );
      expect(card!.content).toContain('INC0001');
    });
  });

  describe('tenant isolation', () => {
    it('should pass tenantId to ServiceNow client', async () => {
      await service.suggest(mockTenantId, 'inc123', 5, 3);
      expect(snClient.getIncident).toHaveBeenCalledWith(mockTenantId, 'inc123');
    });

    it('should pass tenantId to incident index query', async () => {
      await service.suggest(mockTenantId, 'inc123', 5, 3);
      const qb =
        mockIncidentIndexRepo.createQueryBuilder.mock.results[0]?.value;
      if (qb) {
        expect(qb.where).toHaveBeenCalledWith(
          expect.stringContaining('tenantId'),
          expect.objectContaining({ tenantId: mockTenantId }),
        );
      }
    });
  });
});
