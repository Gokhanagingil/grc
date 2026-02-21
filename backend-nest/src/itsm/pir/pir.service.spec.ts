import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PirService } from './pir.service';
import { AuditService } from '../../audit/audit.service';
import { ItsmPir } from './pir.entity';
import { PirStatus } from './pir.enums';

describe('PirService — Phase 3 (CRUD, Status Transitions, Approval)', () => {
  let service: PirService;
  let pirRepo: jest.Mocked<Repository<ItsmPir>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockPirId = '00000000-0000-0000-0000-000000000301';
  const mockMiId = '00000000-0000-0000-0000-000000000201';

  const basePir: Partial<ItsmPir> = {
    id: mockPirId,
    tenantId: mockTenantId,
    majorIncidentId: mockMiId,
    title: 'PIR: Test Major Incident',
    status: PirStatus.DRAFT,
    summary: null,
    whatHappened: null,
    timelineHighlights: null,
    rootCauses: null,
    whatWorkedWell: null,
    whatDidNotWork: null,
    customerImpact: null,
    detectionEffectiveness: null,
    responseEffectiveness: null,
    preventiveActions: null,
    correctiveActions: null,
    approvedBy: null,
    approvedAt: null,
    submittedAt: null,
    closedAt: null,
    isDeleted: false,
    createdBy: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPirRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((data: unknown) => data),
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
        PirService,
        {
          provide: getRepositoryToken(ItsmPir),
          useValue: mockPirRepo,
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PirService>(PirService);
    pirRepo = module.get(getRepositoryToken(ItsmPir));
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // create
  // ==========================================================================

  describe('create', () => {
    it('should create a PIR in DRAFT status', async () => {
      const dto = {
        majorIncidentId: mockMiId,
        title: 'PIR: Test',
        summary: 'Summary of incident',
      };

      pirRepo.save.mockResolvedValue({
        ...basePir,
        ...dto,
        status: PirStatus.DRAFT,
      } as ItsmPir);

      const result = await service.create(mockTenantId, mockUserId, dto);

      expect(result.status).toBe(PirStatus.DRAFT);
      expect(result.majorIncidentId).toBe(mockMiId);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'pir.created',
        expect.objectContaining({
          tenantId: mockTenantId,
          pirId: mockPirId,
          majorIncidentId: mockMiId,
        }),
      );
    });
  });

  // ==========================================================================
  // findOne + tenant isolation
  // ==========================================================================

  describe('findOne', () => {
    it('should find a PIR by id and tenantId', async () => {
      pirRepo.findOne.mockResolvedValue(basePir as ItsmPir);

      const result = await service.findOne(mockTenantId, mockPirId);

      expect(result).not.toBeNull();
      expect(pirRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockPirId, tenantId: mockTenantId, isDeleted: false },
      });
    });

    it('should return null for different tenant', async () => {
      pirRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('other-tenant-id', mockPirId);

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Status transitions
  // ==========================================================================

  describe('update — status transitions', () => {
    it('should allow DRAFT → IN_REVIEW transition', async () => {
      const existing = { ...basePir, status: PirStatus.DRAFT } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);
      pirRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve({ ...existing, ...(entity as Record<string, unknown>) } as ItsmPir),
      );

      const result = await service.update(mockTenantId, mockUserId, mockPirId, {
        status: PirStatus.IN_REVIEW,
      });

      expect(result.status).toBe(PirStatus.IN_REVIEW);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'pir.status-changed',
        expect.objectContaining({ newStatus: PirStatus.IN_REVIEW }),
      );
    });

    it('should set submittedAt when transitioning to IN_REVIEW', async () => {
      const existing = { ...basePir, status: PirStatus.DRAFT, submittedAt: null } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);
      pirRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmPir),
      );

      await service.update(mockTenantId, mockUserId, mockPirId, {
        status: PirStatus.IN_REVIEW,
      });

      // The existing entity should have submittedAt set
      expect(existing.submittedAt).not.toBeNull();
    });

    it('should reject invalid transition DRAFT → APPROVED', async () => {
      const existing = { ...basePir, status: PirStatus.DRAFT } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.update(mockTenantId, mockUserId, mockPirId, {
          status: PirStatus.APPROVED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid transition DRAFT → CLOSED', async () => {
      const existing = { ...basePir, status: PirStatus.DRAFT } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.update(mockTenantId, mockUserId, mockPirId, {
          status: PirStatus.CLOSED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow IN_REVIEW → DRAFT (return to draft)', async () => {
      const existing = { ...basePir, status: PirStatus.IN_REVIEW } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);
      pirRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve({ ...existing, ...(entity as Record<string, unknown>) } as ItsmPir),
      );

      const result = await service.update(mockTenantId, mockUserId, mockPirId, {
        status: PirStatus.DRAFT,
      });

      expect(result.status).toBe(PirStatus.DRAFT);
    });

    it('should allow APPROVED → CLOSED transition', async () => {
      const existing = { ...basePir, status: PirStatus.APPROVED } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);
      pirRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve({ ...existing, ...(entity as Record<string, unknown>) } as ItsmPir),
      );

      const result = await service.update(mockTenantId, mockUserId, mockPirId, {
        status: PirStatus.CLOSED,
      });

      expect(result.status).toBe(PirStatus.CLOSED);
    });

    it('should reject transitions from CLOSED', async () => {
      const existing = { ...basePir, status: PirStatus.CLOSED } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.update(mockTenantId, mockUserId, mockPirId, {
          status: PirStatus.DRAFT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent PIR', async () => {
      pirRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(mockTenantId, mockUserId, 'missing-id', {
          title: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // approve
  // ==========================================================================

  describe('approve', () => {
    it('should approve a PIR in IN_REVIEW state', async () => {
      const existing = { ...basePir, status: PirStatus.IN_REVIEW } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);
      pirRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmPir),
      );

      const result = await service.approve(mockTenantId, mockUserId, mockPirId);

      expect(result.status).toBe(PirStatus.APPROVED);
      expect(result.approvedBy).toBe(mockUserId);
      expect(result.approvedAt).not.toBeNull();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'pir.approved',
        expect.objectContaining({
          tenantId: mockTenantId,
          pirId: mockPirId,
        }),
      );
    });

    it('should reject approval from DRAFT state', async () => {
      const existing = { ...basePir, status: PirStatus.DRAFT } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.approve(mockTenantId, mockUserId, mockPirId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject approval from APPROVED state', async () => {
      const existing = { ...basePir, status: PirStatus.APPROVED } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.approve(mockTenantId, mockUserId, mockPirId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent PIR', async () => {
      pirRepo.findOne.mockResolvedValue(null);

      await expect(
        service.approve(mockTenantId, mockUserId, 'missing-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // softDelete
  // ==========================================================================

  describe('softDelete', () => {
    it('should soft-delete a PIR', async () => {
      const existing = { ...basePir } as ItsmPir;
      pirRepo.findOne.mockResolvedValue(existing);
      pirRepo.save.mockResolvedValue({ ...existing, isDeleted: true } as ItsmPir);

      const result = await service.softDelete(mockTenantId, mockUserId, mockPirId);

      expect(result).toBe(true);
    });

    it('should return false when PIR not found', async () => {
      pirRepo.findOne.mockResolvedValue(null);

      const result = await service.softDelete(mockTenantId, mockUserId, 'missing-id');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Tenant isolation
  // ==========================================================================

  describe('tenant isolation', () => {
    it('findOne should scope by tenantId', async () => {
      pirRepo.findOne.mockResolvedValue(null);

      await service.findOne(mockTenantId, mockPirId);

      expect(pirRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            isDeleted: false,
          }),
        }),
      );
    });

    it('findByMajorIncident should scope by tenantId', async () => {
      pirRepo.findOne.mockResolvedValue(null);

      await service.findByMajorIncident(mockTenantId, mockMiId);

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
