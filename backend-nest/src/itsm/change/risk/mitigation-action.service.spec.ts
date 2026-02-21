import { NotFoundException } from '@nestjs/common';
import { MitigationActionService } from './mitigation-action.service';
import {
  MitigationAction,
  MitigationActionType,
  MitigationActionStatus,
} from './mitigation-action.entity';
import { CreateMitigationActionDto } from './dto/create-mitigation-action.dto';
import {
  ItsmChange,
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from '../change.entity';

// ---- helpers ----

function makeChange(overrides: Partial<ItsmChange> = {}): ItsmChange {
  return {
    id: 'chg-1',
    tenantId: 'tenant-1',
    number: 'CHG-001',
    title: 'Test Change',
    description: null,
    type: ChangeType.NORMAL,
    state: ChangeState.ASSESS,
    risk: ChangeRisk.MEDIUM,
    approvalStatus: ChangeApprovalStatus.NOT_REQUESTED,
    requesterId: null,
    requester: null,
    assigneeId: null,
    assignee: null,
    serviceId: 'svc-1',
    offeringId: null,
    cmdbService: null,
    offering: null,
    plannedStartAt: new Date(),
    plannedEndAt: null,
    actualStartAt: null,
    actualEndAt: null,
    implementationPlan: null,
    backoutPlan: null,
    justification: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    createdBy: 'user-1',
    updatedBy: null,
    ...overrides,
  } as ItsmChange;
}

function makeMitigationAction(
  overrides: Partial<MitigationAction> = {},
): MitigationAction {
  return {
    id: 'ma-1',
    tenantId: 'tenant-1',
    changeId: 'chg-1',
    catalogRiskId: null,
    bindingId: null,
    actionType: MitigationActionType.CHANGE_TASK,
    status: MitigationActionStatus.OPEN,
    title: 'Test Mitigation',
    description: null,
    ownerId: null,
    dueDate: null,
    comment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    createdBy: 'user-1',
    updatedBy: null,
    ...overrides,
  } as MitigationAction;
}

// ---- tests ----

describe('MitigationActionService', () => {
  let service: MitigationActionService;
  let mockMitigationRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockChangeRepo: {
    findOne: jest.Mock;
  };
  let mockEventBus: {
    emit: jest.Mock;
  };

  beforeEach(() => {
    mockMitigationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mockChangeRepo = {
      findOne: jest.fn(),
    };
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
    };
    service = new MitigationActionService(
      mockMitigationRepo as never,
      mockChangeRepo as never,
      mockEventBus as never,
    );
  });

  // ---- create ----

  describe('create', () => {
    const dto: CreateMitigationActionDto = {
      actionType: MitigationActionType.CHANGE_TASK,
      title: 'Mitigate EOS Risk',
      description: 'Address end-of-support risk on CI',
      catalogRiskId: 'risk-1',
      ownerId: 'user-2',
      dueDate: '2026-03-01',
      comment: 'Urgent',
    };

    it('should create a mitigation action and emit event', async () => {
      const change = makeChange();
      mockChangeRepo.findOne.mockResolvedValue(change);

      const created = makeMitigationAction({
        title: dto.title,
        catalogRiskId: dto.catalogRiskId ?? null,
      });
      mockMitigationRepo.create.mockReturnValue(created);
      mockMitigationRepo.save.mockResolvedValue(created);

      const result = await service.create('tenant-1', 'user-1', 'chg-1', dto);

      expect(result).toBe(created);
      expect(mockChangeRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'chg-1', tenantId: 'tenant-1', isDeleted: false },
      });
      expect(mockMitigationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          changeId: 'chg-1',
          actionType: MitigationActionType.CHANGE_TASK,
          title: 'Mitigate EOS Risk',
          status: MitigationActionStatus.OPEN,
          createdBy: 'user-1',
        }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          eventName: 'itsm.change.customer_risk.mitigation_created',
          tableName: 'itsm_change_mitigation_actions',
          recordId: created.id,
          actorId: 'user-1',
          payload: expect.objectContaining({
            changeId: 'chg-1',
            actionType: MitigationActionType.CHANGE_TASK,
            title: 'Mitigate EOS Risk',
          }),
        }),
      );
    });

    it('should throw NotFoundException when change does not exist', async () => {
      mockChangeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'user-1', 'chg-999', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation on change lookup', async () => {
      mockChangeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('tenant-2', 'user-1', 'chg-1', dto),
      ).rejects.toThrow(NotFoundException);

      expect(mockChangeRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'chg-1', tenantId: 'tenant-2', isDeleted: false },
      });
    });

    it('should handle optional fields as null', async () => {
      const minimalDto: CreateMitigationActionDto = {
        actionType: MitigationActionType.RISK_OBSERVATION,
        title: 'Observe risk',
      };
      const change = makeChange();
      mockChangeRepo.findOne.mockResolvedValue(change);

      const created = makeMitigationAction({ title: minimalDto.title });
      mockMitigationRepo.create.mockReturnValue(created);
      mockMitigationRepo.save.mockResolvedValue(created);

      await service.create('tenant-1', 'user-1', 'chg-1', minimalDto);

      expect(mockMitigationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          catalogRiskId: null,
          bindingId: null,
          ownerId: null,
          dueDate: null,
          comment: null,
          description: null,
        }),
      );
    });

    it('should work without event bus (graceful degradation)', async () => {
      const serviceNoEvents = new MitigationActionService(
        mockMitigationRepo as never,
        mockChangeRepo as never,
      );

      const change = makeChange();
      mockChangeRepo.findOne.mockResolvedValue(change);

      const created = makeMitigationAction();
      mockMitigationRepo.create.mockReturnValue(created);
      mockMitigationRepo.save.mockResolvedValue(created);

      const result = await serviceNoEvents.create(
        'tenant-1',
        'user-1',
        'chg-1',
        dto,
      );
      expect(result).toBe(created);
      // No event bus emit called
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  // ---- listByChange ----

  describe('listByChange', () => {
    it('should return paginated results filtered by tenant and change', async () => {
      const items = [makeMitigationAction()];
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue(items),
      };
      mockMitigationRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.listByChange('tenant-1', 'chg-1');

      expect(mockQb.where).toHaveBeenCalledWith('ma.tenantId = :tenantId', {
        tenantId: 'tenant-1',
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('ma.changeId = :changeId', {
        changeId: 'chg-1',
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'ma.isDeleted = :isDeleted',
        { isDeleted: false },
      );
      expect(result.items).toEqual(items);
      expect(result.total).toBe(1);
    });

    it('should filter by status when provided', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockMitigationRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.listByChange('tenant-1', 'chg-1', { status: 'OPEN' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('ma.status = :status', {
        status: 'OPEN',
      });
    });

    it('should apply pagination defaults', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockMitigationRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.listByChange('tenant-1', 'chg-1');

      expect(mockQb.skip).toHaveBeenCalledWith(0); // page 1, offset 0
      expect(mockQb.take).toHaveBeenCalledWith(20); // default pageSize
    });

    it('should cap pageSize at 100', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockMitigationRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.listByChange('tenant-1', 'chg-1', { pageSize: 500 });

      expect(mockQb.take).toHaveBeenCalledWith(100);
    });
  });

  // ---- getById ----

  describe('getById', () => {
    it('should return action when found with tenant isolation', async () => {
      const action = makeMitigationAction();
      mockMitigationRepo.findOne.mockResolvedValue(action);

      const result = await service.getById('tenant-1', 'ma-1');

      expect(result).toBe(action);
      expect(mockMitigationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'ma-1', tenantId: 'tenant-1', isDeleted: false },
      });
    });

    it('should throw NotFoundException when action not found', async () => {
      mockMitigationRepo.findOne.mockResolvedValue(null);

      await expect(service.getById('tenant-1', 'ma-999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should enforce tenant isolation - different tenant cannot access', async () => {
      mockMitigationRepo.findOne.mockResolvedValue(null);

      await expect(service.getById('tenant-2', 'ma-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockMitigationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'ma-1', tenantId: 'tenant-2', isDeleted: false },
      });
    });
  });

  // ---- updateStatus ----

  describe('updateStatus', () => {
    it('should update status and emit event', async () => {
      const action = makeMitigationAction({
        status: MitigationActionStatus.OPEN,
      });
      mockMitigationRepo.findOne.mockResolvedValue(action);
      mockMitigationRepo.save.mockResolvedValue({
        ...action,
        status: MitigationActionStatus.IN_PROGRESS,
      });

      const result = await service.updateStatus(
        'tenant-1',
        'user-1',
        'ma-1',
        MitigationActionStatus.IN_PROGRESS,
        'Starting work',
      );

      expect(result.status).toBe(MitigationActionStatus.IN_PROGRESS);
      expect(mockMitigationRepo.save).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'itsm.change.customer_risk.mitigation_updated',
          payload: expect.objectContaining({
            newStatus: MitigationActionStatus.IN_PROGRESS,
          }),
        }),
      );
    });

    it('should update comment when provided', async () => {
      const action = makeMitigationAction();
      mockMitigationRepo.findOne.mockResolvedValue(action);
      mockMitigationRepo.save.mockResolvedValue(action);

      await service.updateStatus(
        'tenant-1',
        'user-1',
        'ma-1',
        MitigationActionStatus.COMPLETED,
        'Done',
      );

      expect(action.comment).toBe('Done');
      expect(action.updatedBy).toBe('user-1');
    });

    it('should throw NotFoundException for non-existent action', async () => {
      mockMitigationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'tenant-1',
          'user-1',
          'ma-999',
          MitigationActionStatus.COMPLETED,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---- softDelete ----

  describe('softDelete', () => {
    it('should set isDeleted=true and updatedBy', async () => {
      const action = makeMitigationAction({ isDeleted: false });
      mockMitigationRepo.findOne.mockResolvedValue(action);
      mockMitigationRepo.save.mockResolvedValue(action);

      await service.softDelete('tenant-1', 'user-1', 'ma-1');

      expect(action.isDeleted).toBe(true);
      expect(action.updatedBy).toBe('user-1');
      expect(mockMitigationRepo.save).toHaveBeenCalledWith(action);
    });

    it('should throw NotFoundException for non-existent action', async () => {
      mockMitigationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.softDelete('tenant-1', 'user-1', 'ma-999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
