import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { KnowledgeCandidateService } from './knowledge-candidate.service';
import { AuditService } from '../../audit/audit.service';
import { ItsmKnowledgeCandidate } from './knowledge-candidate.entity';
import { ItsmPir } from './pir.entity';
import { ItsmKnownError } from '../known-error/known-error.entity';
import { ItsmProblem } from '../problem/problem.entity';
import {
  KnowledgeCandidateStatus,
  KnowledgeCandidateSourceType,
  PirStatus,
} from './pir.enums';

describe('KnowledgeCandidateService — Phase 3 (Generation, Status Transitions)', () => {
  let service: KnowledgeCandidateService;
  let kcRepo: jest.Mocked<Repository<ItsmKnowledgeCandidate>>;
  let pirRepo: jest.Mocked<Repository<ItsmPir>>;
  let keRepo: jest.Mocked<Repository<ItsmKnownError>>;
  let problemRepo: jest.Mocked<Repository<ItsmProblem>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockPirId = '00000000-0000-0000-0000-000000000301';
  const mockKeId = '00000000-0000-0000-0000-000000000501';
  const mockProblemId = '00000000-0000-0000-0000-000000000601';
  const mockKcId = '00000000-0000-0000-0000-000000000701';

  const baseKc: Partial<ItsmKnowledgeCandidate> = {
    id: mockKcId,
    tenantId: mockTenantId,
    title: 'Knowledge Article: Test',
    sourceType: KnowledgeCandidateSourceType.PIR,
    sourceId: mockPirId,
    status: KnowledgeCandidateStatus.DRAFT,
    synopsis: null,
    resolution: null,
    rootCauseSummary: null,
    workaround: null,
    symptoms: null,
    content: {},
    reviewedBy: null,
    reviewedAt: null,
    publishedAt: null,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPir: Partial<ItsmPir> = {
    id: mockPirId,
    tenantId: mockTenantId,
    title: 'PIR: Major Incident Test',
    status: PirStatus.APPROVED,
    summary: 'Incident summary',
    whatHappened: 'Database went down',
    rootCauses: 'Connection pool exhausted',
    whatWorkedWell: 'Quick detection',
    whatDidNotWork: 'Slow escalation',
    customerImpact: '500 users affected',
    detectionEffectiveness: 'Good - auto-alerting worked',
    responseEffectiveness: 'Moderate - 30min delay',
    preventiveActions: 'Add pool monitoring',
    correctiveActions: 'Increase pool size',
    timelineHighlights: '10:00 Alert, 10:15 Response, 10:45 Resolved',
    isDeleted: false,
  };

  const mockKe: Partial<ItsmKnownError> = {
    id: mockKeId,
    tenantId: mockTenantId,
    title: 'KE: DB Pool Exhaustion',
    rootCause: 'Connection pool not sized for peak load',
    workaround: 'Restart application pods',
    symptoms: 'Timeout errors on API calls',
    isDeleted: false,
  };

  const mockProblem: Partial<ItsmProblem> = {
    id: mockProblemId,
    tenantId: mockTenantId,
    shortDescription: 'Database connection issues',
    description: 'Recurring DB pool exhaustion under load',
    rootCauseSummary: 'Pool size too small',
    fiveWhySummary: '1. App crashes 2. DB pool full 3. Not sized for load',
    contributingFactors: ['High traffic', 'Small pool'],
    rootCauseCategory: null,
    workaroundSummary: 'Restart pods',
    isDeleted: false,
  };

  beforeEach(async () => {
    const mockKcRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((data: Record<string, unknown>) => ({ ...data, id: mockKcId })),
      createQueryBuilder: jest.fn(),
    };

    const mockPirRepo = {
      findOne: jest.fn(),
    };

    const mockKeRepo = {
      findOne: jest.fn(),
    };

    const mockProblemRepo = {
      findOne: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockAuditService = {
      recordCreate: jest.fn(),
      recordUpdate: jest.fn(),
      recordDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeCandidateService,
        {
          provide: getRepositoryToken(ItsmKnowledgeCandidate),
          useValue: mockKcRepo,
        },
        {
          provide: getRepositoryToken(ItsmPir),
          useValue: mockPirRepo,
        },
        {
          provide: getRepositoryToken(ItsmKnownError),
          useValue: mockKeRepo,
        },
        {
          provide: getRepositoryToken(ItsmProblem),
          useValue: mockProblemRepo,
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<KnowledgeCandidateService>(KnowledgeCandidateService);
    kcRepo = module.get(getRepositoryToken(ItsmKnowledgeCandidate));
    pirRepo = module.get(getRepositoryToken(ItsmPir));
    keRepo = module.get(getRepositoryToken(ItsmKnownError));
    problemRepo = module.get(getRepositoryToken(ItsmProblem));
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // generateFromPir
  // ==========================================================================

  describe('generateFromPir', () => {
    it('should generate a KC from PIR', async () => {
      pirRepo.findOne.mockResolvedValue(mockPir as ItsmPir);
      kcRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmKnowledgeCandidate),
      );

      const result = await service.generateFromPir(mockTenantId, mockUserId, mockPirId);

      expect(result.sourceType).toBe(KnowledgeCandidateSourceType.PIR);
      expect(result.sourceId).toBe(mockPirId);
      expect(result.status).toBe(KnowledgeCandidateStatus.DRAFT);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'knowledge-candidate.generated',
        expect.objectContaining({
          tenantId: mockTenantId,
          sourceType: 'PIR',
          sourceId: mockPirId,
        }),
      );
    });

    it('should throw NotFoundException when PIR not found', async () => {
      pirRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateFromPir(mockTenantId, mockUserId, 'missing-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should populate content from PIR sections', async () => {
      pirRepo.findOne.mockResolvedValue(mockPir as ItsmPir);
      kcRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmKnowledgeCandidate),
      );

      const result = await service.generateFromPir(mockTenantId, mockUserId, mockPirId);

      expect(result.synopsis).toBe('Incident summary');
      expect(result.rootCauseSummary).toBe('Connection pool exhausted');
    });
  });

  // ==========================================================================
  // generateFromKnownError
  // ==========================================================================

  describe('generateFromKnownError', () => {
    it('should generate a KC from Known Error', async () => {
      keRepo.findOne.mockResolvedValue(mockKe as ItsmKnownError);
      kcRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmKnowledgeCandidate),
      );

      const result = await service.generateFromKnownError(mockTenantId, mockUserId, mockKeId);

      expect(result.sourceType).toBe(KnowledgeCandidateSourceType.KNOWN_ERROR);
      expect(result.sourceId).toBe(mockKeId);
      expect(result.status).toBe(KnowledgeCandidateStatus.DRAFT);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'knowledge-candidate.generated',
        expect.objectContaining({
          sourceType: 'KNOWN_ERROR',
          sourceId: mockKeId,
        }),
      );
    });

    it('should throw NotFoundException when KE not found', async () => {
      keRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateFromKnownError(mockTenantId, mockUserId, 'missing-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // generateFromProblem
  // ==========================================================================

  describe('generateFromProblem', () => {
    it('should generate a KC from Problem', async () => {
      problemRepo.findOne.mockResolvedValue(mockProblem as ItsmProblem);
      kcRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmKnowledgeCandidate),
      );

      const result = await service.generateFromProblem(mockTenantId, mockUserId, mockProblemId);

      expect(result.sourceType).toBe(KnowledgeCandidateSourceType.PROBLEM);
      expect(result.sourceId).toBe(mockProblemId);
      expect(result.status).toBe(KnowledgeCandidateStatus.DRAFT);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'knowledge-candidate.generated',
        expect.objectContaining({
          sourceType: 'PROBLEM',
          sourceId: mockProblemId,
        }),
      );
    });

    it('should throw NotFoundException when Problem not found', async () => {
      problemRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateFromProblem(mockTenantId, mockUserId, 'missing-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use shortDescription for title', async () => {
      problemRepo.findOne.mockResolvedValue(mockProblem as ItsmProblem);
      kcRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmKnowledgeCandidate),
      );

      const result = await service.generateFromProblem(mockTenantId, mockUserId, mockProblemId);

      expect(result.title).toContain('Database connection issues');
    });
  });

  // ==========================================================================
  // transitionStatus
  // ==========================================================================

  describe('transitionStatus', () => {
    it('should transition DRAFT → REVIEWED', async () => {
      const existing = { ...baseKc, status: KnowledgeCandidateStatus.DRAFT } as ItsmKnowledgeCandidate;
      kcRepo.findOne.mockResolvedValue(existing);
      kcRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmKnowledgeCandidate),
      );

      const result = await service.transitionStatus(
        mockTenantId, mockUserId, mockKcId, KnowledgeCandidateStatus.REVIEWED,
      );

      expect(result.status).toBe(KnowledgeCandidateStatus.REVIEWED);
      expect(result.reviewedBy).toBe(mockUserId);
      expect(result.reviewedAt).not.toBeNull();
    });

    it('should transition REVIEWED → PUBLISHED and emit event', async () => {
      const existing = { ...baseKc, status: KnowledgeCandidateStatus.REVIEWED } as ItsmKnowledgeCandidate;
      kcRepo.findOne.mockResolvedValue(existing);
      kcRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmKnowledgeCandidate),
      );

      const result = await service.transitionStatus(
        mockTenantId, mockUserId, mockKcId, KnowledgeCandidateStatus.PUBLISHED,
      );

      expect(result.status).toBe(KnowledgeCandidateStatus.PUBLISHED);
      expect(result.publishedAt).not.toBeNull();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'knowledge-candidate.published',
        expect.objectContaining({
          candidateId: mockKcId,
        }),
      );
    });

    it('should reject invalid transition DRAFT → PUBLISHED', async () => {
      const existing = { ...baseKc, status: KnowledgeCandidateStatus.DRAFT } as ItsmKnowledgeCandidate;
      kcRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.transitionStatus(
          mockTenantId, mockUserId, mockKcId, KnowledgeCandidateStatus.PUBLISHED,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transitions from PUBLISHED', async () => {
      const existing = { ...baseKc, status: KnowledgeCandidateStatus.PUBLISHED } as ItsmKnowledgeCandidate;
      kcRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.transitionStatus(
          mockTenantId, mockUserId, mockKcId, KnowledgeCandidateStatus.DRAFT,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow REJECTED → DRAFT (re-draft)', async () => {
      const existing = { ...baseKc, status: KnowledgeCandidateStatus.REJECTED } as ItsmKnowledgeCandidate;
      kcRepo.findOne.mockResolvedValue(existing);
      kcRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmKnowledgeCandidate),
      );

      const result = await service.transitionStatus(
        mockTenantId, mockUserId, mockKcId, KnowledgeCandidateStatus.DRAFT,
      );

      expect(result.status).toBe(KnowledgeCandidateStatus.DRAFT);
    });

    it('should throw NotFoundException for non-existent KC', async () => {
      kcRepo.findOne.mockResolvedValue(null);

      await expect(
        service.transitionStatus(
          mockTenantId, mockUserId, 'missing-id', KnowledgeCandidateStatus.REVIEWED,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // softDelete
  // ==========================================================================

  describe('softDelete', () => {
    it('should soft-delete a KC', async () => {
      const existing = { ...baseKc } as ItsmKnowledgeCandidate;
      kcRepo.findOne.mockResolvedValue(existing);
      kcRepo.save.mockResolvedValue({ ...existing, isDeleted: true } as ItsmKnowledgeCandidate);

      const result = await service.softDelete(mockTenantId, mockUserId, mockKcId);

      expect(result).toBe(true);
    });

    it('should return false when KC not found', async () => {
      kcRepo.findOne.mockResolvedValue(null);

      const result = await service.softDelete(mockTenantId, mockUserId, 'missing-id');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Tenant isolation
  // ==========================================================================

  describe('tenant isolation', () => {
    it('findOne should scope by tenantId', async () => {
      kcRepo.findOne.mockResolvedValue(null);

      await service.findOne(mockTenantId, mockKcId);

      expect(kcRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            isDeleted: false,
          }),
        }),
      );
    });

    it('generateFromPir should scope PIR lookup by tenantId', async () => {
      pirRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateFromPir(mockTenantId, mockUserId, 'some-pir-id'),
      ).rejects.toThrow(NotFoundException);

      expect(pirRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            isDeleted: false,
          }),
        }),
      );
    });
  });
});
