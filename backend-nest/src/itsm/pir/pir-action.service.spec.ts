import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';

import { PirActionService } from './pir-action.service';
import { AuditService } from '../../audit/audit.service';
import { ItsmPirAction } from './pir-action.entity';
import { PirActionStatus, PirActionPriority } from './pir.enums';

describe('PirActionService — Phase 3 (CRUD, Overdue Detection)', () => {
  let service: PirActionService;
  let actionRepo: jest.Mocked<Repository<ItsmPirAction>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockPirId = '00000000-0000-0000-0000-000000000301';
  const mockActionId = '00000000-0000-0000-0000-000000000401';

  const baseAction: Partial<ItsmPirAction> = {
    id: mockActionId,
    tenantId: mockTenantId,
    pirId: mockPirId,
    title: 'Fix monitoring gap',
    description: 'Add alerting for DB pool saturation',
    ownerId: mockUserId,
    dueDate: '2026-03-15',
    status: PirActionStatus.OPEN,
    priority: PirActionPriority.HIGH,
    problemId: null,
    changeId: null,
    riskObservationId: null,
    completedAt: null,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockActionRepo = {
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
        PirActionService,
        {
          provide: getRepositoryToken(ItsmPirAction),
          useValue: mockActionRepo,
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PirActionService>(PirActionService);
    actionRepo = module.get(getRepositoryToken(ItsmPirAction));
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // create
  // ==========================================================================

  describe('create', () => {
    it('should create an action in OPEN status', async () => {
      const dto = {
        pirId: mockPirId,
        title: 'Fix monitoring gap',
        description: 'Add alerting',
        priority: PirActionPriority.HIGH,
        dueDate: '2026-03-15',
      };

      actionRepo.save.mockResolvedValue({
        ...baseAction,
        ...dto,
        status: PirActionStatus.OPEN,
      } as ItsmPirAction);

      const result = await service.create(mockTenantId, mockUserId, dto);

      expect(result.status).toBe(PirActionStatus.OPEN);
      expect(result.pirId).toBe(mockPirId);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'pir-action.created',
        expect.objectContaining({
          tenantId: mockTenantId,
          actionId: mockActionId,
          pirId: mockPirId,
        }),
      );
    });

    it('should default priority to MEDIUM', async () => {
      const dto = {
        pirId: mockPirId,
        title: 'Simple action',
      };

      actionRepo.save.mockResolvedValue({
        ...baseAction,
        ...dto,
        priority: PirActionPriority.MEDIUM,
      } as ItsmPirAction);

      const result = await service.create(mockTenantId, mockUserId, dto);

      expect(result.priority).toBe(PirActionPriority.MEDIUM);
    });
  });

  // ==========================================================================
  // findOne + tenant isolation
  // ==========================================================================

  describe('findOne', () => {
    it('should find an action by id and tenantId', async () => {
      actionRepo.findOne.mockResolvedValue(baseAction as ItsmPirAction);

      const result = await service.findOne(mockTenantId, mockActionId);

      expect(result).not.toBeNull();
      expect(actionRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockActionId, tenantId: mockTenantId, isDeleted: false },
      });
    });

    it('should return null for different tenant', async () => {
      actionRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('other-tenant', mockActionId);

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // update
  // ==========================================================================

  describe('update', () => {
    it('should update action status to IN_PROGRESS', async () => {
      const existing = { ...baseAction, status: PirActionStatus.OPEN } as ItsmPirAction;
      actionRepo.findOne.mockResolvedValue(existing);
      actionRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve({ ...existing, ...(entity as Record<string, unknown>) } as ItsmPirAction),
      );

      const result = await service.update(mockTenantId, mockUserId, mockActionId, {
        status: PirActionStatus.IN_PROGRESS,
      });

      expect(result.status).toBe(PirActionStatus.IN_PROGRESS);
    });

    it('should update action status to COMPLETED and set completedAt', async () => {
      const existing = { ...baseAction, status: PirActionStatus.IN_PROGRESS } as ItsmPirAction;
      actionRepo.findOne.mockResolvedValue(existing);
      actionRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve(entity as ItsmPirAction),
      );

      await service.update(mockTenantId, mockUserId, mockActionId, {
        status: PirActionStatus.COMPLETED,
      });

      expect(existing.completedAt).not.toBeNull();
    });

    it('should throw NotFoundException for non-existent action', async () => {
      actionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(mockTenantId, mockUserId, 'missing-id', { title: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // softDelete
  // ==========================================================================

  describe('softDelete', () => {
    it('should soft-delete an action', async () => {
      const existing = { ...baseAction } as ItsmPirAction;
      actionRepo.findOne.mockResolvedValue(existing);
      actionRepo.save.mockResolvedValue({ ...existing, isDeleted: true } as ItsmPirAction);

      const result = await service.softDelete(mockTenantId, mockUserId, mockActionId);

      expect(result).toBe(true);
    });

    it('should return false when action not found', async () => {
      actionRepo.findOne.mockResolvedValue(null);

      const result = await service.softDelete(mockTenantId, mockUserId, 'missing-id');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // findOverdue
  // ==========================================================================

  describe('findOverdue', () => {
    it('should find overdue actions using repo.find with tenant scope', async () => {
      actionRepo.find.mockResolvedValue([]);

      const result = await service.findOverdue(mockTenantId);

      expect(result).toEqual([]);
      expect(actionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            isDeleted: false,
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // Tenant isolation
  // ==========================================================================

  describe('tenant isolation', () => {
    it('findOne should scope by tenantId', async () => {
      actionRepo.findOne.mockResolvedValue(null);

      await service.findOne(mockTenantId, mockActionId);

      expect(actionRepo.findOne).toHaveBeenCalledWith(
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
