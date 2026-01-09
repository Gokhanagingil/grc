import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClosureLoopService } from './closure-loop.service';
import { GrcCapa, GrcCapaTask, GrcIssue, GrcStatusHistory } from '../entities';
import { CapaStatus, IssueStatus, CAPATaskStatus } from '../enums';

describe('ClosureLoopService', () => {
  let service: ClosureLoopService;
  let capaRepository: jest.Mocked<Repository<GrcCapa>>;
  let capaTaskRepository: jest.Mocked<Repository<GrcCapaTask>>;
  let issueRepository: jest.Mocked<Repository<GrcIssue>>;
  let statusHistoryRepository: jest.Mocked<Repository<GrcStatusHistory>>;
  let dataSource: jest.Mocked<DataSource>;
  let mockQueryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      save: jest.Mock;
      find: jest.Mock;
      findOne: jest.Mock;
      create: jest.Mock;
    };
  };

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn().mockImplementation((_entity, data) => data),
      },
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as unknown as jest.Mocked<DataSource>;

    capaRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<GrcCapa>>;

    capaTaskRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<GrcCapaTask>>;

    issueRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<GrcIssue>>;

    statusHistoryRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<GrcStatusHistory>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClosureLoopService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(GrcCapa), useValue: capaRepository },
        {
          provide: getRepositoryToken(GrcCapaTask),
          useValue: capaTaskRepository,
        },
        { provide: getRepositoryToken(GrcIssue), useValue: issueRepository },
        {
          provide: getRepositoryToken(GrcStatusHistory),
          useValue: statusHistoryRepository,
        },
      ],
    }).compile();

    service = module.get<ClosureLoopService>(ClosureLoopService);
  });

  describe('CAPA Status Transitions', () => {
    it('should return valid transitions for PLANNED status', () => {
      const transitions = service.getCapaValidTransitions(CapaStatus.PLANNED);
      expect(transitions).toContain(CapaStatus.IN_PROGRESS);
      expect(transitions).toContain(CapaStatus.REJECTED);
      expect(transitions).not.toContain(CapaStatus.CLOSED);
    });

    it('should return valid transitions for IN_PROGRESS status', () => {
      const transitions = service.getCapaValidTransitions(
        CapaStatus.IN_PROGRESS,
      );
      expect(transitions).toContain(CapaStatus.IMPLEMENTED);
      expect(transitions).toContain(CapaStatus.PLANNED);
      expect(transitions).toContain(CapaStatus.REJECTED);
    });

    it('should return valid transitions for IMPLEMENTED status', () => {
      const transitions = service.getCapaValidTransitions(
        CapaStatus.IMPLEMENTED,
      );
      expect(transitions).toContain(CapaStatus.VERIFIED);
      expect(transitions).toContain(CapaStatus.IN_PROGRESS);
    });

    it('should return valid transitions for VERIFIED status', () => {
      const transitions = service.getCapaValidTransitions(CapaStatus.VERIFIED);
      expect(transitions).toContain(CapaStatus.CLOSED);
      expect(transitions).toContain(CapaStatus.IMPLEMENTED);
    });

    it('should return valid transitions for CLOSED status', () => {
      const transitions = service.getCapaValidTransitions(CapaStatus.CLOSED);
      expect(transitions).toContain(CapaStatus.IN_PROGRESS);
    });
  });

  describe('Issue Status Transitions', () => {
    it('should return valid transitions for OPEN status', () => {
      const transitions = service.getIssueValidTransitions(IssueStatus.OPEN);
      expect(transitions).toContain(IssueStatus.IN_PROGRESS);
      expect(transitions).toContain(IssueStatus.REJECTED);
      expect(transitions).not.toContain(IssueStatus.CLOSED);
    });

    it('should return valid transitions for IN_PROGRESS status', () => {
      const transitions = service.getIssueValidTransitions(
        IssueStatus.IN_PROGRESS,
      );
      expect(transitions).toContain(IssueStatus.RESOLVED);
      expect(transitions).toContain(IssueStatus.OPEN);
      expect(transitions).toContain(IssueStatus.REJECTED);
    });

    it('should return valid transitions for RESOLVED status', () => {
      const transitions = service.getIssueValidTransitions(
        IssueStatus.RESOLVED,
      );
      expect(transitions).toContain(IssueStatus.CLOSED);
      expect(transitions).toContain(IssueStatus.IN_PROGRESS);
    });

    it('should return valid transitions for CLOSED status', () => {
      const transitions = service.getIssueValidTransitions(IssueStatus.CLOSED);
      expect(transitions).toContain(IssueStatus.IN_PROGRESS);
    });
  });

  describe('updateCapaStatus', () => {
    const mockCapa = {
      id: 'capa-123',
      tenantId: mockTenantId,
      status: CapaStatus.PLANNED,
      issueId: 'issue-123',
      isDeleted: false,
    } as GrcCapa;

    it('should throw NotFoundException if CAPA not found', async () => {
      capaRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateCapaStatus(
          mockTenantId,
          'capa-123',
          { status: CapaStatus.IN_PROGRESS },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return same CAPA if status is unchanged', async () => {
      capaRepository.findOne.mockResolvedValue(mockCapa);

      const result = await service.updateCapaStatus(
        mockTenantId,
        'capa-123',
        { status: CapaStatus.PLANNED },
        mockUserId,
      );

      expect(result).toEqual(mockCapa);
      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid transition', async () => {
      capaRepository.findOne.mockResolvedValue(mockCapa);

      await expect(
        service.updateCapaStatus(
          mockTenantId,
          'capa-123',
          { status: CapaStatus.CLOSED },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update CAPA status and create history entry', async () => {
      capaRepository.findOne
        .mockResolvedValueOnce(mockCapa)
        .mockResolvedValueOnce({ ...mockCapa, status: CapaStatus.IN_PROGRESS });
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockCapa,
        status: CapaStatus.IN_PROGRESS,
      });

      const result = await service.updateCapaStatus(
        mockTenantId,
        'capa-123',
        { status: CapaStatus.IN_PROGRESS, reason: 'Starting work' },
        mockUserId,
      );

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.status).toBe(CapaStatus.IN_PROGRESS);
    });

    it('should include allowed statuses in error message for invalid transition', async () => {
      // Use a fresh mock for this test to ensure clean state
      const freshMockCapa = {
        id: 'capa-456',
        tenantId: mockTenantId,
        status: CapaStatus.PLANNED,
        issueId: 'issue-123',
        isDeleted: false,
      } as GrcCapa;
      capaRepository.findOne.mockResolvedValue(freshMockCapa);

      await expect(
        service.updateCapaStatus(
          mockTenantId,
          'capa-456',
          { status: CapaStatus.CLOSED },
          mockUserId,
        ),
      ).rejects.toThrow(
        /Allowed next statuses from planned: \[in_progress, rejected\]/,
      );
    });
  });

  describe('updateIssueStatus', () => {
    const mockIssue = {
      id: 'issue-123',
      tenantId: mockTenantId,
      status: IssueStatus.OPEN,
      isDeleted: false,
    } as GrcIssue;

    it('should throw NotFoundException if Issue not found', async () => {
      issueRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateIssueStatus(
          mockTenantId,
          'issue-123',
          { status: IssueStatus.IN_PROGRESS },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return same Issue if status is unchanged', async () => {
      issueRepository.findOne.mockResolvedValue(mockIssue);

      const result = await service.updateIssueStatus(
        mockTenantId,
        'issue-123',
        { status: IssueStatus.OPEN },
        mockUserId,
      );

      expect(result).toEqual(mockIssue);
      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid transition', async () => {
      issueRepository.findOne.mockResolvedValue(mockIssue);

      await expect(
        service.updateIssueStatus(
          mockTenantId,
          'issue-123',
          { status: IssueStatus.CLOSED },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update Issue status and create history entry', async () => {
      issueRepository.findOne
        .mockResolvedValueOnce(mockIssue)
        .mockResolvedValueOnce({
          ...mockIssue,
          status: IssueStatus.IN_PROGRESS,
        });
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockIssue,
        status: IssueStatus.IN_PROGRESS,
      });

      const result = await service.updateIssueStatus(
        mockTenantId,
        'issue-123',
        { status: IssueStatus.IN_PROGRESS, reason: 'Starting investigation' },
        mockUserId,
      );

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.status).toBe(IssueStatus.IN_PROGRESS);
    });

    it('should include allowed statuses in error message for invalid Issue transition', async () => {
      // Use a fresh mock for this test to ensure clean state
      const freshMockIssue = {
        id: 'issue-456',
        tenantId: mockTenantId,
        status: IssueStatus.OPEN,
        isDeleted: false,
      } as GrcIssue;
      issueRepository.findOne.mockResolvedValue(freshMockIssue);

      await expect(
        service.updateIssueStatus(
          mockTenantId,
          'issue-456',
          { status: IssueStatus.CLOSED },
          mockUserId,
        ),
      ).rejects.toThrow(
        /Allowed next statuses from open: \[in_progress, rejected\]/,
      );
    });
  });

  describe('checkAndCascadeCapaClose', () => {
    it('should return null if no tasks exist', async () => {
      capaTaskRepository.find.mockResolvedValue([]);

      const result = await service.checkAndCascadeCapaClose(
        mockTenantId,
        'capa-123',
        mockUserId,
      );

      expect(result).toBeNull();
    });

    it('should return null if not all tasks are terminal', async () => {
      capaTaskRepository.find.mockResolvedValue([
        { status: CAPATaskStatus.COMPLETED } as GrcCapaTask,
        { status: CAPATaskStatus.IN_PROGRESS } as GrcCapaTask,
      ]);

      const result = await service.checkAndCascadeCapaClose(
        mockTenantId,
        'capa-123',
        mockUserId,
      );

      expect(result).toBeNull();
    });

    it('should return null if CAPA is already closed', async () => {
      capaTaskRepository.find.mockResolvedValue([
        { status: CAPATaskStatus.COMPLETED } as GrcCapaTask,
        { status: CAPATaskStatus.CANCELLED } as GrcCapaTask,
      ]);
      capaRepository.findOne.mockResolvedValue({
        id: 'capa-123',
        status: CapaStatus.CLOSED,
        isDeleted: false,
      } as GrcCapa);

      const result = await service.checkAndCascadeCapaClose(
        mockTenantId,
        'capa-123',
        mockUserId,
      );

      expect(result).toBeNull();
    });

    it('should close CAPA when all tasks are terminal', async () => {
      const mockCapaInProgress = {
        id: 'capa-123',
        tenantId: mockTenantId,
        status: CapaStatus.IN_PROGRESS,
        issueId: null,
        isDeleted: false,
      } as unknown as GrcCapa;

      capaTaskRepository.find.mockResolvedValue([
        { status: CAPATaskStatus.COMPLETED } as GrcCapaTask,
        { status: CAPATaskStatus.COMPLETED } as GrcCapaTask,
      ]);
      capaRepository.findOne
        .mockResolvedValueOnce(mockCapaInProgress)
        .mockResolvedValueOnce({
          ...mockCapaInProgress,
          status: CapaStatus.CLOSED,
        } as unknown as GrcCapa);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockCapaInProgress,
        status: CapaStatus.CLOSED,
      });

      const result = await service.checkAndCascadeCapaClose(
        mockTenantId,
        'capa-123',
        mockUserId,
      );

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result?.status).toBe(CapaStatus.CLOSED);
    });

    it('should create history with SYSTEM source for auto-closure', async () => {
      const mockCapaInProgress = {
        id: 'capa-123',
        tenantId: mockTenantId,
        status: CapaStatus.IN_PROGRESS,
        issueId: null,
        isDeleted: false,
      } as unknown as GrcCapa;

      capaTaskRepository.find.mockResolvedValue([
        { status: CAPATaskStatus.COMPLETED } as GrcCapaTask,
      ]);
      capaRepository.findOne
        .mockResolvedValueOnce(mockCapaInProgress)
        .mockResolvedValueOnce({
          ...mockCapaInProgress,
          status: CapaStatus.CLOSED,
        } as unknown as GrcCapa);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockCapaInProgress,
        status: CapaStatus.CLOSED,
      });

      await service.checkAndCascadeCapaClose(
        mockTenantId,
        'capa-123',
        mockUserId,
      );

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        GrcStatusHistory,
        expect.objectContaining({
          changeReason: 'Auto-closed: all tasks completed',
          metadata: { source: 'SYSTEM' },
        }),
      );
    });
  });
});
