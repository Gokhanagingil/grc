import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { IncidentCopilotService } from '../incident-copilot.service';
import {
  IncidentAiAnalysis,
  AnalysisStatus,
  ConfidenceLevel,
} from '../incident-ai-analysis.entity';
import { ItsmIncident } from '../incident.entity';
import { AiAdminService } from '../../../ai-admin/ai-admin.service';
import { ToolGatewayService } from '../../../tool-gateway/tool-gateway.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const INCIDENT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function mockIncident(overrides: Record<string, unknown> = {}): ItsmIncident {
  return {
    id: INCIDENT_ID,
    tenantId: TENANT_ID,
    number: 'INC000001',
    shortDescription: 'Login service is down',
    description: 'Users cannot log in since 10:00 UTC',
    category: 'software',
    impact: 'high',
    urgency: 'high',
    priority: 'p1',
    status: 'open',
    source: 'monitoring',
    assignmentGroup: 'Service Desk',
    assignedTo: USER_ID,
    relatedService: null,
    serviceId: null,
    offeringId: null,
    relatedRiskId: null,
    relatedPolicyId: null,
    firstResponseAt: null,
    resolvedAt: null,
    resolutionNotes: null,
    metadata: null,
    ...overrides,
  } as unknown as ItsmIncident;
}

function mockAnalysisEntity(
  overrides: Record<string, unknown> = {},
): IncidentAiAnalysis {
  return {
    id: 'aaaa-bbbb-cccc-dddd',
    tenantId: TENANT_ID,
    incidentId: INCIDENT_ID,
    providerType: 'LOCAL',
    modelName: null,
    status: AnalysisStatus.SUCCESS,
    confidence: ConfidenceLevel.MEDIUM,
    inputsMeta: { incidentRef: INCIDENT_ID, toolCallCount: 0, toolKeysUsed: [] },
    evidenceMeta: null,
    summaryText: 'Test summary',
    recommendedActions: [{ action: 'Test action', severity: 'MEDIUM' }],
    customerUpdateDraft: 'Dear customer...',
    proposedTasks: [{ title: 'Investigate' }],
    similarIncidents: null,
    impactAssessment: 'Impact: HIGH',
    assumptions: ['Local data only'],
    usedDataSources: ['LOCAL_INCIDENT'],
    requestHash: 'abc123',
    responseHash: 'def456',
    errorCode: null,
    userSafeError: null,
    latencyMs: 150,
    userId: USER_ID,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as unknown as IncidentAiAnalysis;
}

describe('IncidentCopilotService', () => {
  let service: IncidentCopilotService;

  const mockIncidentFindOne = jest.fn();
  const mockAnalysisFindOne = jest.fn();
  const mockAnalysisFindAndCount = jest.fn();
  const mockAnalysisCreate = jest.fn().mockImplementation((data: Record<string, unknown>) => ({ ...data, id: 'new-analysis-id' }));
  const mockAnalysisSave = jest.fn().mockImplementation((entity: Record<string, unknown>) => ({
    ...entity,
    id: (entity as { id?: string }).id || 'new-analysis-id',
    createdAt: new Date(),
  }));
  const mockResolveConfig = jest.fn();
  const mockLogAudit = jest.fn().mockResolvedValue(undefined);
  const mockGetToolStatus = jest.fn();
  const mockRunTool = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentCopilotService,
        { provide: getRepositoryToken(ItsmIncident), useValue: { findOne: mockIncidentFindOne } },
        {
          provide: getRepositoryToken(IncidentAiAnalysis),
          useValue: {
            findOne: mockAnalysisFindOne,
            findAndCount: mockAnalysisFindAndCount,
            create: mockAnalysisCreate,
            save: mockAnalysisSave,
          },
        },
        {
          provide: AiAdminService,
          useValue: { resolveEffectiveConfig: mockResolveConfig, logAuditEvent: mockLogAudit },
        },
        {
          provide: ToolGatewayService,
          useValue: { getToolStatus: mockGetToolStatus, runTool: mockRunTool },
        },
      ],
    }).compile();

    service = module.get<IncidentCopilotService>(IncidentCopilotService);
  });

  // ─── Test 1: AI disabled => returns user-safe error ───
  describe('analyzeIncident — policy gating', () => {
    it('should return FAIL when AI is disabled by tenant policy', async () => {
      mockIncidentFindOne.mockResolvedValue(mockIncident());
      mockResolveConfig.mockResolvedValue({
        isAiEnabled: false,
        isFeatureEnabled: false,
        providerType: null,
        modelName: null,
        baseUrl: null,
        humanApprovalRequired: false,
      });

      const result = await service.analyzeIncident(TENANT_ID, INCIDENT_ID, USER_ID, {});

      expect(result.status).toBe(AnalysisStatus.FAIL);
      expect(result.error).toContain('AI is disabled for this tenant');
      expect(mockLogAudit).toHaveBeenCalled();
      expect(mockRunTool).not.toHaveBeenCalled();
    });

    it('should return FAIL when INCIDENT_COPILOT feature is not allowed', async () => {
      mockIncidentFindOne.mockResolvedValue(mockIncident());
      mockResolveConfig.mockResolvedValue({
        isAiEnabled: true,
        isFeatureEnabled: false,
        providerType: 'LOCAL',
        modelName: null,
        baseUrl: null,
        humanApprovalRequired: false,
      });

      const result = await service.analyzeIncident(TENANT_ID, INCIDENT_ID, USER_ID, {});

      expect(result.status).toBe(AnalysisStatus.FAIL);
      expect(result.error).toContain('Incident Copilot feature is not enabled');
    });

    it('should return NOT_FOUND when incident does not exist', async () => {
      mockIncidentFindOne.mockResolvedValue(null);

      await expect(
        service.analyzeIncident(TENANT_ID, 'nonexistent-id', USER_ID, {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 2: Tool gating ───
  describe('analyzeIncident — tool gating', () => {
    it('should produce analysis from local data only when tools are disabled', async () => {
      mockIncidentFindOne.mockResolvedValue(mockIncident());
      mockResolveConfig.mockResolvedValue({
        isAiEnabled: true,
        isFeatureEnabled: true,
        providerType: 'LOCAL',
        modelName: null,
        baseUrl: null,
        humanApprovalRequired: false,
      });
      mockGetToolStatus.mockResolvedValue({
        isToolsEnabled: false,
        availableTools: [],
        hasServiceNowProvider: false,
      });

      const result = await service.analyzeIncident(TENANT_ID, INCIDENT_ID, USER_ID, {});

      expect(result.status).toBe(AnalysisStatus.SUCCESS);
      expect(result.summary).toBeTruthy();
      expect(result.explainability.dataSources).toContain('LOCAL_INCIDENT');
      expect(result.explainability.dataSources).not.toContain('SERVICENOW_INCIDENT');
      expect(mockRunTool).not.toHaveBeenCalled();
    });

    it('should call tool gateway when SN is configured and tools are enabled', async () => {
      const inc = mockIncident({ metadata: { servicenowSysId: 'sn-sys-id-123' } });
      mockIncidentFindOne.mockResolvedValue(inc);
      mockResolveConfig.mockResolvedValue({
        isAiEnabled: true,
        isFeatureEnabled: true,
        providerType: 'LOCAL',
        modelName: null,
        baseUrl: null,
        humanApprovalRequired: false,
      });
      mockGetToolStatus.mockResolvedValue({
        isToolsEnabled: true,
        availableTools: ['SERVICENOW_GET_RECORD', 'SERVICENOW_QUERY_CHANGES'],
        hasServiceNowProvider: true,
      });
      mockRunTool.mockResolvedValue({
        success: true,
        data: { sys_id: 'sn-sys-id-123', short_description: 'SN desc' },
        meta: { table: 'incident', recordCount: 1 },
      });

      const result = await service.analyzeIncident(TENANT_ID, INCIDENT_ID, USER_ID, {});

      expect(result.status).toBe(AnalysisStatus.SUCCESS);
      expect(mockRunTool).toHaveBeenCalled();
    });
  });

  // ─── Test 3: Snapshot persistence ───
  describe('analyzeIncident — snapshot persistence', () => {
    it('should persist analysis snapshot and return structured result', async () => {
      mockIncidentFindOne.mockResolvedValue(mockIncident());
      mockResolveConfig.mockResolvedValue({
        isAiEnabled: true,
        isFeatureEnabled: true,
        providerType: 'LOCAL',
        modelName: null,
        baseUrl: null,
        humanApprovalRequired: false,
      });
      mockGetToolStatus.mockResolvedValue({
        isToolsEnabled: false,
        availableTools: [],
        hasServiceNowProvider: false,
      });

      const result = await service.analyzeIncident(TENANT_ID, INCIDENT_ID, USER_ID, {});

      expect(mockAnalysisCreate).toHaveBeenCalled();
      expect(mockAnalysisSave).toHaveBeenCalled();
      expect(result.analysisId).toBeTruthy();
      expect(result.incidentId).toBe(INCIDENT_ID);
      expect(result.providerType).toBe('LOCAL');
      expect(result.confidence).toBeTruthy();
      expect(result.summary).toBeTruthy();
      expect(result.recommendedActions).toBeDefined();
      expect(result.explainability).toBeDefined();
      expect(result.explainability.dataSources).toEqual(expect.arrayContaining(['LOCAL_INCIDENT']));
    });
  });

  // ─── Test 4: Audit event ───
  describe('analyzeIncident — audit logging', () => {
    it('should log audit event on successful analysis', async () => {
      mockIncidentFindOne.mockResolvedValue(mockIncident());
      mockResolveConfig.mockResolvedValue({
        isAiEnabled: true,
        isFeatureEnabled: true,
        providerType: 'LOCAL',
        modelName: null,
        baseUrl: null,
        humanApprovalRequired: false,
      });
      mockGetToolStatus.mockResolvedValue({
        isToolsEnabled: false,
        availableTools: [],
        hasServiceNowProvider: false,
      });

      await service.analyzeIncident(TENANT_ID, INCIDENT_ID, USER_ID, {});

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          actionType: 'ANALYZE',
          status: 'SUCCESS',
        }),
      );
    });
  });

  // ─── Test 5: List analyses ───
  describe('listAnalyses', () => {
    it('should return paginated list', async () => {
      const items = [mockAnalysisEntity(), mockAnalysisEntity({ id: 'second' })];
      mockAnalysisFindAndCount.mockResolvedValue([items, 2]);

      const result = await service.listAnalyses(TENANT_ID, INCIDENT_ID, { page: 1, pageSize: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockAnalysisFindAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, incidentId: INCIDENT_ID },
        }),
      );
    });
  });

  // ─── Test 6: Get single analysis ───
  describe('getAnalysis', () => {
    it('should return analysis by id', async () => {
      const entity = mockAnalysisEntity();
      mockAnalysisFindOne.mockResolvedValue(entity);

      const result = await service.getAnalysis(TENANT_ID, INCIDENT_ID, entity.id);

      expect(result.analysisId).toBe(entity.id);
      expect(result.summary).toBe('Test summary');
    });

    it('should throw NotFoundException when analysis not found', async () => {
      mockAnalysisFindOne.mockResolvedValue(null);

      await expect(
        service.getAnalysis(TENANT_ID, INCIDENT_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 7: Copilot status ───
  describe('getCopilotStatus', () => {
    it('should return policy status and last analysis', async () => {
      mockResolveConfig.mockResolvedValue({
        isAiEnabled: true,
        isFeatureEnabled: true,
        providerType: 'LOCAL',
        modelName: null,
        baseUrl: null,
        humanApprovalRequired: false,
      });
      mockGetToolStatus.mockResolvedValue({
        isToolsEnabled: true,
        availableTools: ['SERVICENOW_GET_RECORD'],
        hasServiceNowProvider: true,
      });
      const entity = mockAnalysisEntity();
      mockAnalysisFindOne.mockResolvedValue(entity);

      const result = await service.getCopilotStatus(TENANT_ID, INCIDENT_ID);

      expect(result.isAiEnabled).toBe(true);
      expect(result.isFeatureEnabled).toBe(true);
      expect(result.isToolsEnabled).toBe(true);
      expect(result.hasServiceNowProvider).toBe(true);
      expect(result.lastAnalysis).toBeTruthy();
      expect(result.lastAnalysis!.id).toBe(entity.id);
    });
  });
});
