import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';

import { KnownErrorService } from './known-error.service';
import { AuditService } from '../../audit/audit.service';
import { ItsmKnownError } from './known-error.entity';
import { KnownErrorState, KnownErrorFixStatus } from '../enums';

describe('KnownErrorService — Phase 2 (Lifecycle Transitions, Reopen)', () => {
  let service: KnownErrorService;
  let keRepo: jest.Mocked<Repository<ItsmKnownError>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockKeId = '00000000-0000-0000-0000-000000000201';

  const baseKe: Partial<ItsmKnownError> = {
    id: mockKeId,
    tenantId: mockTenantId,
    title: 'Known Error: DB Connection Pool',
    symptoms: 'Slow queries',
    rootCause: 'Pool limit too low',
    workaround: 'Restart app server',
    permanentFixStatus: KnownErrorFixStatus.WORKAROUND_AVAILABLE,
    state: KnownErrorState.DRAFT,
    problemId: null,
    knowledgeCandidate: false,
    knowledgeCandidatePayload: null,
    validatedAt: null,
    validatedBy: null,
    publishedAt: null,
    retiredAt: null,
    metadata: null,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockKeRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((entity: any) => Promise.resolve(entity)),
      create: jest.fn().mockImplementation((data: any) => data),
      createQueryBuilder: jest.fn(),
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
        KnownErrorService,
        {
          provide: getRepositoryToken(ItsmKnownError),
          useValue: mockKeRepo,
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<KnownErrorService>(KnownErrorService);
    keRepo = module.get(getRepositoryToken(ItsmKnownError));
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // validateKnownError (DRAFT → VALIDATED)
  // ==========================================================================

  describe('validateKnownError', () => {
    it('should transition DRAFT → VALIDATED', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.DRAFT,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      const result = await service.validateKnownError(
        mockTenantId,
        mockUserId,
        mockKeId,
      );

      expect(result).not.toBeNull();
      expect(result!.state).toBe(KnownErrorState.VALIDATED);
      expect(result!.validatedAt).toBeDefined();
      expect(result!.validatedBy).toBe(mockUserId);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'known-error.validated',
        expect.objectContaining({ knownErrorId: mockKeId }),
      );
    });

    it('should reject validation from PUBLISHED state', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.PUBLISHED,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.validateKnownError(mockTenantId, mockUserId, mockKeId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject validation from RETIRED state', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.RETIRED,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.validateKnownError(mockTenantId, mockUserId, mockKeId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return null when KE not found', async () => {
      keRepo.findOne.mockResolvedValue(null);

      const result = await service.validateKnownError(
        mockTenantId,
        mockUserId,
        'missing',
      );
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // publishKnownError (VALIDATED → PUBLISHED, or DRAFT → PUBLISHED)
  // ==========================================================================

  describe('publishKnownError', () => {
    it('should transition VALIDATED → PUBLISHED', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.VALIDATED,
        validatedAt: new Date(),
        validatedBy: mockUserId,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      const result = await service.publishKnownError(
        mockTenantId,
        mockUserId,
        mockKeId,
      );

      expect(result).not.toBeNull();
      expect(result!.state).toBe(KnownErrorState.PUBLISHED);
      expect(result!.publishedAt).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'known-error.published',
        expect.objectContaining({ knownErrorId: mockKeId }),
      );
    });

    it('should allow DRAFT → PUBLISHED (skip validation)', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.DRAFT,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      const result = await service.publishKnownError(
        mockTenantId,
        mockUserId,
        mockKeId,
      );

      expect(result).not.toBeNull();
      expect(result!.state).toBe(KnownErrorState.PUBLISHED);
    });

    it('should reject publishing from RETIRED state', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.RETIRED,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.publishKnownError(mockTenantId, mockUserId, mockKeId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // retireKnownError (PUBLISHED → RETIRED)
  // ==========================================================================

  describe('retireKnownError', () => {
    it('should transition PUBLISHED → RETIRED', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.PUBLISHED,
        publishedAt: new Date(),
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      const result = await service.retireKnownError(
        mockTenantId,
        mockUserId,
        mockKeId,
      );

      expect(result).not.toBeNull();
      expect(result!.state).toBe(KnownErrorState.RETIRED);
      expect(result!.retiredAt).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'known-error.retired',
        expect.objectContaining({ knownErrorId: mockKeId }),
      );
    });

    it('should reject retire from DRAFT state', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.DRAFT,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.retireKnownError(mockTenantId, mockUserId, mockKeId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject retire from VALIDATED state', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.VALIDATED,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.retireKnownError(mockTenantId, mockUserId, mockKeId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // reopenKnownError (RETIRED → DRAFT)
  // ==========================================================================

  describe('reopenKnownError', () => {
    it('should transition RETIRED → DRAFT with reason in metadata', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.RETIRED,
        retiredAt: new Date(),
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      const result = await service.reopenKnownError(
        mockTenantId,
        mockUserId,
        mockKeId,
        'New workaround found',
      );

      expect(result).not.toBeNull();
      expect(result!.state).toBe(KnownErrorState.DRAFT);
      expect(
        (result!.metadata as Record<string, unknown>)?.lastReopenReason,
      ).toBe('New workaround found');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'known-error.reopened',
        expect.objectContaining({
          knownErrorId: mockKeId,
          reason: 'New workaround found',
        }),
      );
    });

    it('should reject reopen from DRAFT state', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.DRAFT,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.reopenKnownError(mockTenantId, mockUserId, mockKeId, 'reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reopen from PUBLISHED state', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.PUBLISHED,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.reopenKnownError(mockTenantId, mockUserId, mockKeId, 'reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reopen from VALIDATED state', async () => {
      const existing = {
        ...baseKe,
        state: KnownErrorState.VALIDATED,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.reopenKnownError(mockTenantId, mockUserId, mockKeId, 'reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return null when KE not found', async () => {
      keRepo.findOne.mockResolvedValue(null);

      const result = await service.reopenKnownError(
        mockTenantId,
        mockUserId,
        'missing',
        'reason',
      );
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Full lifecycle: DRAFT → VALIDATED → PUBLISHED → RETIRED → DRAFT
  // ==========================================================================

  describe('full lifecycle', () => {
    it('should support complete DRAFT → VALIDATED → PUBLISHED → RETIRED → DRAFT cycle', async () => {
      // Start with DRAFT
      const ke = { ...baseKe, state: KnownErrorState.DRAFT } as ItsmKnownError;

      // DRAFT → VALIDATED
      keRepo.findOne.mockResolvedValue(ke);
      let result = await service.validateKnownError(
        mockTenantId,
        mockUserId,
        mockKeId,
      );
      expect(result!.state).toBe(KnownErrorState.VALIDATED);

      // VALIDATED → PUBLISHED
      const validated = {
        ...ke,
        state: KnownErrorState.VALIDATED,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(validated);
      result = await service.publishKnownError(
        mockTenantId,
        mockUserId,
        mockKeId,
      );
      expect(result!.state).toBe(KnownErrorState.PUBLISHED);

      // PUBLISHED → RETIRED
      const published = {
        ...ke,
        state: KnownErrorState.PUBLISHED,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(published);
      result = await service.retireKnownError(
        mockTenantId,
        mockUserId,
        mockKeId,
      );
      expect(result!.state).toBe(KnownErrorState.RETIRED);

      // RETIRED → DRAFT (reopen)
      const retired = {
        ...ke,
        state: KnownErrorState.RETIRED,
      } as ItsmKnownError;
      keRepo.findOne.mockResolvedValue(retired);
      result = await service.reopenKnownError(
        mockTenantId,
        mockUserId,
        mockKeId,
        'Rework needed',
      );
      expect(result!.state).toBe(KnownErrorState.DRAFT);
    });
  });

  // ==========================================================================
  // Tenant isolation
  // ==========================================================================

  describe('tenant isolation', () => {
    it('should scope findOne by tenantId for validateKnownError', async () => {
      keRepo.findOne.mockResolvedValue(null);

      await service.validateKnownError(mockTenantId, mockUserId, 'some-id');

      expect(keRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            isDeleted: false,
          }),
        }),
      );
    });

    it('should scope findOne by tenantId for reopenKnownError', async () => {
      keRepo.findOne.mockResolvedValue(null);

      await service.reopenKnownError(
        mockTenantId,
        mockUserId,
        'some-id',
        'reason',
      );

      expect(keRepo.findOne).toHaveBeenCalledWith(
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
