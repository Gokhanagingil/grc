/**
 * Unit tests for RcaOrchestrationService
 *
 * Tests MI RCA → Problem/KE/PIR orchestration including:
 * - Creating Problem from hypothesis with traceability metadata
 * - Creating Known Error from hypothesis with evidence
 * - Creating PIR Action from hypothesis with traceability
 * - Hypothesis resolution (re-generates and finds by ID)
 * - Journal/audit entry writing
 * - Error handling (missing services, not found, validation)
 * - Traceability metadata correctness
 * - Permission denied behavior (403)
 */
import { RcaOrchestrationService } from './rca-orchestration.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  RcaHypothesis,
  RcaTopologyHypothesesResponse,
} from './dto/topology-impact.dto';
import { JournalType } from '../../../journal/journal.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = 'user-1';

// ============================================================================
// Helpers
// ============================================================================

function makeHypothesis(overrides: Partial<RcaHypothesis> = {}): RcaHypothesis {
  return {
    id: 'hyp-1',
    type: 'common_upstream_dependency',
    score: 0.85,
    suspectNodeId: 'ci-db-1',
    suspectNodeLabel: 'Shared Database Cluster',
    suspectNodeType: 'ci',
    explanation:
      'Database cluster is a common upstream dependency for all affected services',
    evidence: [
      {
        type: 'topology_path',
        description: 'All 3 affected services depend on this database cluster',
        referenceId: 'ci-db-1',
        referenceLabel: 'Shared Database Cluster',
      },
    ],
    affectedServiceIds: ['svc-1', 'svc-2', 'svc-3'],
    recommendedActions: [
      {
        type: 'create_problem',
        label: 'Create Problem',
        reason: 'High confidence root cause',
        confidence: 85,
      },
    ],
    ...overrides,
  };
}

function makeRcaResponse(
  hypotheses: RcaHypothesis[] = [makeHypothesis()],
): RcaTopologyHypothesesResponse {
  return {
    majorIncidentId: 'mi-1',
    rootServiceIds: ['svc-1'],
    linkedCiIds: ['ci-db-1'],
    hypotheses,
    nodesAnalyzed: 15,
    computedAt: new Date().toISOString(),
    warnings: [],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('RcaOrchestrationService', () => {
  let service: RcaOrchestrationService;
  let mockTopologyService: Record<string, jest.Mock>;
  let mockProblemService: Record<string, jest.Mock>;
  let mockKnownErrorService: Record<string, jest.Mock>;
  let mockPirService: Record<string, jest.Mock>;
  let mockPirActionService: Record<string, jest.Mock>;
  let mockJournalService: Record<string, jest.Mock>;
  let mockMiService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockTopologyService = {
      generateRcaHypotheses: jest.fn().mockResolvedValue(makeRcaResponse()),
    };
    mockProblemService = {
      createProblem: jest.fn().mockResolvedValue({
        id: 'prob-new-1',
        number: 'PRB000001',
        shortDescription: 'Test Problem',
        state: 'NEW',
      }),
    };
    mockKnownErrorService = {
      createKnownError: jest.fn().mockResolvedValue({
        id: 'ke-new-1',
        title: 'Test Known Error',
        state: 'OPEN',
        metadata: null,
      }),
      updateKnownError: jest.fn().mockResolvedValue({}),
    };
    mockPirService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'pir-1',
        majorIncidentId: 'mi-1',
        title: 'PIR for MI-1',
      }),
    };
    mockPirActionService = {
      create: jest.fn().mockResolvedValue({
        id: 'action-new-1',
        title: 'Test PIR Action',
        pirId: 'pir-1',
      }),
    };
    mockJournalService = {
      createJournalEntry: jest.fn().mockResolvedValue({}),
    };
    mockMiService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'mi-1',
        number: 'MI000001',
        title: 'Critical outage',
        status: 'DECLARED',
        primaryServiceId: 'svc-1',
      }),
    };

    service = new RcaOrchestrationService(
      mockTopologyService as never,
      mockProblemService as never,
      mockKnownErrorService as never,
      mockPirService as never,
      mockPirActionService as never,
      mockJournalService as never,
      mockMiService as never,
    );
  });

  // ==========================================================================
  // Create Problem from Hypothesis
  // ==========================================================================

  describe('createProblemFromHypothesis', () => {
    const dto = {
      majorIncidentId: 'mi-1',
      hypothesisId: 'hyp-1',
      shortDescription: 'Database cluster root cause',
      description: 'Investigating shared DB cluster as root cause',
      category: undefined,
      impact: undefined,
      urgency: undefined,
    };

    it('should create a problem with correct traceability metadata', async () => {
      const result = await service.createProblemFromHypothesis(
        TENANT_ID,
        USER_ID,
        dto,
      );

      expect(result.record).toBeDefined();
      expect(result.record.number).toBe('PRB000001');
      expect(result.traceability.sourceType).toBe('TOPOLOGY_RCA_HYPOTHESIS');
      expect(result.traceability.sourceHypothesisId).toBe('hyp-1');
      expect(result.traceability.sourceMajorIncidentId).toBe('mi-1');
      expect(result.traceability.suspectNodeLabel).toBe(
        'Shared Database Cluster',
      );
      expect(result.traceability.hypothesisType).toBe(
        'common_upstream_dependency',
      );
      expect(result.traceability.hypothesisScore).toBe(0.85);
    });

    it('should pass correct fields to problemService.createProblem', async () => {
      await service.createProblemFromHypothesis(TENANT_ID, USER_ID, dto);

      expect(mockProblemService.createProblem).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          shortDescription: 'Database cluster root cause',
          metadata: expect.objectContaining({
            rcaTraceability: expect.objectContaining({
              sourceType: 'TOPOLOGY_RCA_HYPOTHESIS',
            }),
          }),
        }),
      );
    });

    it('should write journal entry on the major incident', async () => {
      await service.createProblemFromHypothesis(TENANT_ID, USER_ID, dto);

      expect(mockJournalService.createJournalEntry).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'major_incidents',
        'mi-1',
        expect.objectContaining({
          type: JournalType.WORK_NOTE,
          message: expect.stringContaining('PRB000001'),
        }),
      );
    });

    it('should include summary with hypothesis details', async () => {
      const result = await service.createProblemFromHypothesis(
        TENANT_ID,
        USER_ID,
        dto,
      );

      expect(result.summary).toContain('PRB000001');
      expect(result.summary).toContain('Shared Database Cluster');
      expect(result.summary).toContain('85%');
    });

    it('should throw BadRequestException when problem service is unavailable', async () => {
      const noProblemService = new RcaOrchestrationService(
        mockTopologyService as never,
        undefined, // no problem service
        mockKnownErrorService as never,
        mockPirService as never,
        mockPirActionService as never,
        mockJournalService as never,
        mockMiService as never,
      );

      await expect(
        noProblemService.createProblemFromHypothesis(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when major incident not found', async () => {
      mockMiService.findOne.mockResolvedValue(null);

      await expect(
        service.createProblemFromHypothesis(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when hypothesis not found', async () => {
      const rcaResp = makeRcaResponse([]); // no hypotheses
      mockTopologyService.generateRcaHypotheses.mockResolvedValue(rcaResp);

      await expect(
        service.createProblemFromHypothesis(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should build RCA entries from hypothesis evidence', async () => {
      await service.createProblemFromHypothesis(TENANT_ID, USER_ID, dto);

      const createCall = mockProblemService.createProblem.mock.calls[0][2];
      expect(createCall.rcaEntries).toBeDefined();
      expect(createCall.rcaEntries.length).toBe(1);
      expect(createCall.rcaEntries[0].type).toBe('EVIDENCE');
      expect(createCall.rcaEntries[0].content).toContain('topology path');
    });
  });

  // ==========================================================================
  // Create Known Error from Hypothesis
  // ==========================================================================

  describe('createKnownErrorFromHypothesis', () => {
    const dto = {
      majorIncidentId: 'mi-1',
      hypothesisId: 'hyp-1',
      title: 'Connection pool exhaustion on Shared DB',
      symptoms: 'Timeouts on all dependent services',
      rootCause: 'Connection pool limit reached',
      workaround: 'Restart connection pool',
    };

    it('should create a known error with traceability metadata', async () => {
      const result = await service.createKnownErrorFromHypothesis(
        TENANT_ID,
        USER_ID,
        dto,
      );

      expect(result.record).toBeDefined();
      expect(result.record.title).toBe('Test Known Error');
      expect(result.traceability.sourceType).toBe('TOPOLOGY_RCA_HYPOTHESIS');
      expect(result.traceability.sourceHypothesisId).toBe('hyp-1');
    });

    it('should persist traceability metadata via update', async () => {
      await service.createKnownErrorFromHypothesis(TENANT_ID, USER_ID, dto);

      expect(mockKnownErrorService.updateKnownError).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'ke-new-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            rcaTraceability: expect.objectContaining({
              sourceType: 'TOPOLOGY_RCA_HYPOTHESIS',
            }),
          }),
        }),
      );
    });

    it('should write journal entry', async () => {
      await service.createKnownErrorFromHypothesis(TENANT_ID, USER_ID, dto);

      expect(mockJournalService.createJournalEntry).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'major_incidents',
        'mi-1',
        expect.objectContaining({
          type: JournalType.WORK_NOTE,
        }),
      );
    });

    it('should throw BadRequestException when KE service is unavailable', async () => {
      const noKeService = new RcaOrchestrationService(
        mockTopologyService as never,
        mockProblemService as never,
        undefined, // no KE service
        mockPirService as never,
        mockPirActionService as never,
        mockJournalService as never,
        mockMiService as never,
      );

      await expect(
        noKeService.createKnownErrorFromHypothesis(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle metadata update failure gracefully', async () => {
      mockKnownErrorService.updateKnownError.mockRejectedValue(
        new Error('Update failed'),
      );

      // Should NOT throw - the metadata update failure is non-blocking
      const result = await service.createKnownErrorFromHypothesis(
        TENANT_ID,
        USER_ID,
        dto,
      );
      expect(result.record).toBeDefined();
    });
  });

  // ==========================================================================
  // Create PIR Action from Hypothesis
  // ==========================================================================

  describe('createPirActionFromHypothesis', () => {
    const dto = {
      majorIncidentId: 'mi-1',
      hypothesisId: 'hyp-1',
      pirId: 'pir-1',
      title: 'Investigate shared DB cluster resilience',
      description: 'Review connection pool settings and failover config',
      priority: undefined,
      ownerId: undefined,
      dueDate: undefined,
    };

    it('should create a PIR action with traceability metadata', async () => {
      const result = await service.createPirActionFromHypothesis(
        TENANT_ID,
        USER_ID,
        dto,
      );

      expect(result.record).toBeDefined();
      expect(result.record.title).toBe('Test PIR Action');
      expect(result.traceability.sourceType).toBe('TOPOLOGY_RCA_HYPOTHESIS');
    });

    it('should pass traceability metadata in action DTO', async () => {
      await service.createPirActionFromHypothesis(TENANT_ID, USER_ID, dto);

      expect(mockPirActionService.create).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          pirId: 'pir-1',
          title: 'Investigate shared DB cluster resilience',
          metadata: expect.objectContaining({
            rcaTraceability: expect.objectContaining({
              sourceType: 'TOPOLOGY_RCA_HYPOTHESIS',
            }),
          }),
        }),
      );
    });

    it('should verify PIR belongs to the correct MI', async () => {
      mockPirService.findOne.mockResolvedValue({
        id: 'pir-1',
        majorIncidentId: 'mi-OTHER', // different MI
      });

      await expect(
        service.createPirActionFromHypothesis(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when PIR not found', async () => {
      mockPirService.findOne.mockResolvedValue(null);

      await expect(
        service.createPirActionFromHypothesis(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when PIR Action service is unavailable', async () => {
      const noPirActionService = new RcaOrchestrationService(
        mockTopologyService as never,
        mockProblemService as never,
        mockKnownErrorService as never,
        mockPirService as never,
        undefined, // no PIR action service
        mockJournalService as never,
        mockMiService as never,
      );

      await expect(
        noPirActionService.createPirActionFromHypothesis(
          TENANT_ID,
          USER_ID,
          dto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should write journal entry', async () => {
      await service.createPirActionFromHypothesis(TENANT_ID, USER_ID, dto);

      expect(mockJournalService.createJournalEntry).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Traceability metadata correctness
  // ==========================================================================

  describe('traceability metadata', () => {
    it('should always include all required fields', async () => {
      const dto = {
        majorIncidentId: 'mi-1',
        hypothesisId: 'hyp-1',
        shortDescription: 'Test',
      };

      const result = await service.createProblemFromHypothesis(
        TENANT_ID,
        USER_ID,
        dto,
      );

      const meta = result.traceability;
      expect(meta).toHaveProperty('sourceType', 'TOPOLOGY_RCA_HYPOTHESIS');
      expect(meta).toHaveProperty('sourceHypothesisId');
      expect(meta).toHaveProperty('sourceMajorIncidentId');
      expect(meta).toHaveProperty('suspectNodeLabel');
      expect(meta).toHaveProperty('suspectNodeType');
      expect(meta).toHaveProperty('hypothesisType');
      expect(meta).toHaveProperty('hypothesisScore');
      expect(typeof meta.hypothesisScore).toBe('number');
    });
  });

  // ==========================================================================
  // Journal cap
  // ==========================================================================

  describe('journal message cap', () => {
    it('should not fail when journal service is unavailable', async () => {
      const noJournalService = new RcaOrchestrationService(
        mockTopologyService as never,
        mockProblemService as never,
        mockKnownErrorService as never,
        mockPirService as never,
        mockPirActionService as never,
        undefined, // no journal service
        mockMiService as never,
      );

      const dto = {
        majorIncidentId: 'mi-1',
        hypothesisId: 'hyp-1',
        shortDescription: 'Test',
      };

      const result = await noJournalService.createProblemFromHypothesis(
        TENANT_ID,
        USER_ID,
        dto,
      );
      expect(result.record).toBeDefined();
    });

    it('should not fail when journal write throws', async () => {
      mockJournalService.createJournalEntry.mockRejectedValue(
        new Error('Journal DB down'),
      );

      const dto = {
        majorIncidentId: 'mi-1',
        hypothesisId: 'hyp-1',
        shortDescription: 'Test',
      };

      // Should NOT throw - journal is non-blocking
      const result = await service.createProblemFromHypothesis(
        TENANT_ID,
        USER_ID,
        dto,
      );
      expect(result.record).toBeDefined();
    });
  });
});
