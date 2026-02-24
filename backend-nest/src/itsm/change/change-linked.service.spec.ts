/**
 * ChangeService — GRC Bridge Linked Risks/Controls Tests
 *
 * Tests the linked risks/controls methods added to ChangeService
 * as part of the GRC Bridge v1 integration.
 *
 * Covers:
 * - getLinkedRisks: success, empty, change not found, soft-deleted filtering
 * - getLinkedControls: success, empty, change not found, soft-deleted filtering
 * - linkRisk: success, duplicate, risk not found, change not found
 * - unlinkRisk: success, not linked
 * - linkControl: success, duplicate, control not found, change not found
 * - unlinkControl: success, not linked
 *
 * @regression
 * @grc-bridge
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ChangeService } from './change.service';
import {
  ItsmChange,
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from './change.entity';
import { ApprovalService } from './approval/approval.service';
import { ItsmChangeRisk } from '../../grc/entities/itsm-change-risk.entity';
import { ItsmChangeControl } from '../../grc/entities/itsm-change-control.entity';
import { GrcRisk } from '../../grc/entities/grc-risk.entity';
import { GrcControl } from '../../grc/entities/grc-control.entity';

describe('ChangeService — GRC Bridge Linked Risks/Controls', () => {
  let service: ChangeService;
  let changeRepository: jest.Mocked<Repository<ItsmChange>>;
  let changeRiskRepository: jest.Mocked<Repository<ItsmChangeRisk>>;
  let changeControlRepository: jest.Mocked<Repository<ItsmChangeControl>>;
  let grcRiskRepository: jest.Mocked<Repository<GrcRisk>>;
  let grcControlRepository: jest.Mocked<Repository<GrcControl>>;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const OTHER_TENANT = '00000000-0000-0000-0000-000000000099';
  const USER_ID = '00000000-0000-0000-0000-000000000002';
  const CHANGE_ID = '00000000-0000-0000-0000-000000000020';
  const RISK_ID_1 = '00000000-0000-0000-0000-000000000030';
  const RISK_ID_2 = '00000000-0000-0000-0000-000000000031';
  const CONTROL_ID_1 = '00000000-0000-0000-0000-000000000040';
  const CONTROL_ID_2 = '00000000-0000-0000-0000-000000000041';

  const mockChange: Partial<ItsmChange> = {
    id: CHANGE_ID,
    tenantId: TENANT_ID,
    number: 'CHG000001',
    title: 'Test Change',
    type: ChangeType.NORMAL,
    state: ChangeState.DRAFT,
    risk: ChangeRisk.MEDIUM,
    approvalStatus: ChangeApprovalStatus.NOT_REQUESTED,
    isDeleted: false,
  };

  const mockRisk1: Partial<GrcRisk> = {
    id: RISK_ID_1,
    tenantId: TENANT_ID,
    title: 'Risk 1',
    isDeleted: false,
    createdAt: new Date('2025-01-01'),
  };

  const mockRisk2: Partial<GrcRisk> = {
    id: RISK_ID_2,
    tenantId: TENANT_ID,
    title: 'Risk 2',
    isDeleted: false,
    createdAt: new Date('2025-01-02'),
  };

  const mockControl1: Partial<GrcControl> = {
    id: CONTROL_ID_1,
    tenantId: TENANT_ID,
    name: 'Control 1',
    isDeleted: false,
    createdAt: new Date('2025-01-01'),
  };

  const mockControl2: Partial<GrcControl> = {
    id: CONTROL_ID_2,
    tenantId: TENANT_ID,
    name: 'Control 2',
    isDeleted: false,
    createdAt: new Date('2025-01-02'),
  };

  beforeEach(async () => {
    const mockChangeRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      merge: jest
        .fn()
        .mockImplementation((entity, data) => ({ ...entity, ...data })),
    };

    const mockChangeRiskRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const mockChangeControlRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const mockGrcRiskRepo = {
      findOne: jest.fn(),
    };

    const mockGrcControlRepo = {
      findOne: jest.fn(),
    };

    const mockApprovalService = {
      checkTransitionGate: jest.fn().mockResolvedValue({ allowed: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeService,
        { provide: getRepositoryToken(ItsmChange), useValue: mockChangeRepo },
        { provide: ApprovalService, useValue: mockApprovalService },
        {
          provide: getRepositoryToken(ItsmChangeRisk),
          useValue: mockChangeRiskRepo,
        },
        {
          provide: getRepositoryToken(ItsmChangeControl),
          useValue: mockChangeControlRepo,
        },
        { provide: getRepositoryToken(GrcRisk), useValue: mockGrcRiskRepo },
        {
          provide: getRepositoryToken(GrcControl),
          useValue: mockGrcControlRepo,
        },
      ],
    }).compile();

    service = module.get<ChangeService>(ChangeService);
    changeRepository = module.get(getRepositoryToken(ItsmChange));
    changeRiskRepository = module.get(getRepositoryToken(ItsmChangeRisk));
    changeControlRepository = module.get(getRepositoryToken(ItsmChangeControl));
    grcRiskRepository = module.get(getRepositoryToken(GrcRisk));
    grcControlRepository = module.get(getRepositoryToken(GrcControl));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // getLinkedRisks
  // ===========================================================================
  describe('getLinkedRisks', () => {
    it('returns linked risks for a valid change', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      changeRiskRepository.find.mockResolvedValue([
        {
          id: 'link-1',
          tenantId: TENANT_ID,
          changeId: CHANGE_ID,
          riskId: RISK_ID_1,
          risk: mockRisk1 as GrcRisk,
          createdAt: new Date('2025-01-02'),
        } as ItsmChangeRisk,
        {
          id: 'link-2',
          tenantId: TENANT_ID,
          changeId: CHANGE_ID,
          riskId: RISK_ID_2,
          risk: mockRisk2 as GrcRisk,
          createdAt: new Date('2025-01-01'),
        } as ItsmChangeRisk,
      ]);

      const result = await service.getLinkedRisks(TENANT_ID, CHANGE_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(RISK_ID_1);
      expect(result[1].id).toBe(RISK_ID_2);
      expect(changeRiskRepository.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, changeId: CHANGE_ID },
        relations: ['risk'],
        order: { createdAt: 'DESC' },
      });
    });

    it('returns empty array when change has no linked risks', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      changeRiskRepository.find.mockResolvedValue([]);

      const result = await service.getLinkedRisks(TENANT_ID, CHANGE_ID);

      expect(result).toEqual([]);
    });

    it('filters out soft-deleted risks', async () => {
      const deletedRisk = { ...mockRisk2, isDeleted: true };
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      changeRiskRepository.find.mockResolvedValue([
        {
          id: 'link-1',
          tenantId: TENANT_ID,
          changeId: CHANGE_ID,
          riskId: RISK_ID_1,
          risk: mockRisk1 as GrcRisk,
          createdAt: new Date(),
        } as ItsmChangeRisk,
        {
          id: 'link-2',
          tenantId: TENANT_ID,
          changeId: CHANGE_ID,
          riskId: RISK_ID_2,
          risk: deletedRisk as GrcRisk,
          createdAt: new Date(),
        } as ItsmChangeRisk,
      ]);

      const result = await service.getLinkedRisks(TENANT_ID, CHANGE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(RISK_ID_1);
    });

    it('filters out null risks (orphaned links)', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      changeRiskRepository.find.mockResolvedValue([
        {
          id: 'link-1',
          tenantId: TENANT_ID,
          changeId: CHANGE_ID,
          riskId: RISK_ID_1,
          risk: mockRisk1 as GrcRisk,
          createdAt: new Date(),
        } as ItsmChangeRisk,
        {
          id: 'link-2',
          tenantId: TENANT_ID,
          changeId: CHANGE_ID,
          riskId: RISK_ID_2,
          risk: null as unknown as GrcRisk,
          createdAt: new Date(),
        } as ItsmChangeRisk,
      ]);

      const result = await service.getLinkedRisks(TENANT_ID, CHANGE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(RISK_ID_1);
    });

    it('throws NotFoundException when change does not exist', async () => {
      changeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getLinkedRisks(TENANT_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for tenant mismatch (change in different tenant)', async () => {
      changeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getLinkedRisks(OTHER_TENANT, CHANGE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // getLinkedControls
  // ===========================================================================
  describe('getLinkedControls', () => {
    it('returns linked controls for a valid change', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      changeControlRepository.find.mockResolvedValue([
        {
          id: 'link-1',
          tenantId: TENANT_ID,
          changeId: CHANGE_ID,
          controlId: CONTROL_ID_1,
          control: mockControl1 as GrcControl,
          createdAt: new Date('2025-01-02'),
        } as ItsmChangeControl,
        {
          id: 'link-2',
          tenantId: TENANT_ID,
          changeId: CHANGE_ID,
          controlId: CONTROL_ID_2,
          control: mockControl2 as GrcControl,
          createdAt: new Date('2025-01-01'),
        } as ItsmChangeControl,
      ]);

      const result = await service.getLinkedControls(TENANT_ID, CHANGE_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(CONTROL_ID_1);
      expect(result[1].id).toBe(CONTROL_ID_2);
      expect(changeControlRepository.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, changeId: CHANGE_ID },
        relations: ['control'],
        order: { createdAt: 'DESC' },
      });
    });

    it('returns empty array when change has no linked controls', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      changeControlRepository.find.mockResolvedValue([]);

      const result = await service.getLinkedControls(TENANT_ID, CHANGE_ID);

      expect(result).toEqual([]);
    });

    it('filters out soft-deleted controls', async () => {
      const deletedControl = { ...mockControl2, isDeleted: true };
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      changeControlRepository.find.mockResolvedValue([
        {
          id: 'link-1',
          tenantId: TENANT_ID,
          changeId: CHANGE_ID,
          controlId: CONTROL_ID_1,
          control: mockControl1 as GrcControl,
          createdAt: new Date(),
        } as ItsmChangeControl,
        {
          id: 'link-2',
          tenantId: TENANT_ID,
          changeId: CHANGE_ID,
          controlId: CONTROL_ID_2,
          control: deletedControl as GrcControl,
          createdAt: new Date(),
        } as ItsmChangeControl,
      ]);

      const result = await service.getLinkedControls(TENANT_ID, CHANGE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(CONTROL_ID_1);
    });

    it('throws NotFoundException when change does not exist', async () => {
      changeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getLinkedControls(TENANT_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for tenant mismatch', async () => {
      changeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getLinkedControls(OTHER_TENANT, CHANGE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // linkRisk
  // ===========================================================================
  describe('linkRisk', () => {
    it('links a risk to a change', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      grcRiskRepository.findOne.mockResolvedValue(mockRisk1 as GrcRisk);
      changeRiskRepository.findOne.mockResolvedValue(null);
      const newLink = {
        id: 'link-new',
        tenantId: TENANT_ID,
        changeId: CHANGE_ID,
        riskId: RISK_ID_1,
        createdBy: USER_ID,
      } as ItsmChangeRisk;
      changeRiskRepository.create.mockReturnValue(newLink);
      changeRiskRepository.save.mockResolvedValue(newLink);

      const result = await service.linkRisk(
        TENANT_ID,
        CHANGE_ID,
        RISK_ID_1,
        USER_ID,
      );

      expect(result.id).toBe('link-new');
      expect(changeRiskRepository.create).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        changeId: CHANGE_ID,
        riskId: RISK_ID_1,
        createdBy: USER_ID,
      });
    });

    it('throws ConflictException when risk is already linked', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      grcRiskRepository.findOne.mockResolvedValue(mockRisk1 as GrcRisk);
      changeRiskRepository.findOne.mockResolvedValue({
        id: 'existing',
      } as ItsmChangeRisk);

      await expect(
        service.linkRisk(TENANT_ID, CHANGE_ID, RISK_ID_1, USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when risk does not exist', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      grcRiskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.linkRisk(TENANT_ID, CHANGE_ID, 'non-existent', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when change does not exist', async () => {
      changeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.linkRisk(TENANT_ID, 'non-existent', RISK_ID_1, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // unlinkRisk
  // ===========================================================================
  describe('unlinkRisk', () => {
    it('unlinks a risk from a change', async () => {
      const link = {
        id: 'link-1',
        tenantId: TENANT_ID,
        changeId: CHANGE_ID,
        riskId: RISK_ID_1,
      } as ItsmChangeRisk;
      changeRiskRepository.findOne.mockResolvedValue(link);
      changeRiskRepository.remove.mockResolvedValue(link);

      await service.unlinkRisk(TENANT_ID, CHANGE_ID, RISK_ID_1);

      expect(changeRiskRepository.remove).toHaveBeenCalledWith(link);
    });

    it('throws NotFoundException when link does not exist', async () => {
      changeRiskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.unlinkRisk(TENANT_ID, CHANGE_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // linkControl
  // ===========================================================================
  describe('linkControl', () => {
    it('links a control to a change', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      grcControlRepository.findOne.mockResolvedValue(
        mockControl1 as GrcControl,
      );
      changeControlRepository.findOne.mockResolvedValue(null);
      const newLink = {
        id: 'link-new',
        tenantId: TENANT_ID,
        changeId: CHANGE_ID,
        controlId: CONTROL_ID_1,
        createdBy: USER_ID,
      } as ItsmChangeControl;
      changeControlRepository.create.mockReturnValue(newLink);
      changeControlRepository.save.mockResolvedValue(newLink);

      const result = await service.linkControl(
        TENANT_ID,
        CHANGE_ID,
        CONTROL_ID_1,
        USER_ID,
      );

      expect(result.id).toBe('link-new');
      expect(changeControlRepository.create).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        changeId: CHANGE_ID,
        controlId: CONTROL_ID_1,
        createdBy: USER_ID,
      });
    });

    it('throws ConflictException when control is already linked', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      grcControlRepository.findOne.mockResolvedValue(
        mockControl1 as GrcControl,
      );
      changeControlRepository.findOne.mockResolvedValue({
        id: 'existing',
      } as ItsmChangeControl);

      await expect(
        service.linkControl(TENANT_ID, CHANGE_ID, CONTROL_ID_1, USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when control does not exist', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      grcControlRepository.findOne.mockResolvedValue(null);

      await expect(
        service.linkControl(TENANT_ID, CHANGE_ID, 'non-existent', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when change does not exist', async () => {
      changeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.linkControl(TENANT_ID, 'non-existent', CONTROL_ID_1, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // unlinkControl
  // ===========================================================================
  describe('unlinkControl', () => {
    it('unlinks a control from a change', async () => {
      const link = {
        id: 'link-1',
        tenantId: TENANT_ID,
        changeId: CHANGE_ID,
        controlId: CONTROL_ID_1,
      } as ItsmChangeControl;
      changeControlRepository.findOne.mockResolvedValue(link);
      changeControlRepository.remove.mockResolvedValue(link);

      await service.unlinkControl(TENANT_ID, CHANGE_ID, CONTROL_ID_1);

      expect(changeControlRepository.remove).toHaveBeenCalledWith(link);
    });

    it('throws NotFoundException when link does not exist', async () => {
      changeControlRepository.findOne.mockResolvedValue(null);

      await expect(
        service.unlinkControl(TENANT_ID, CHANGE_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // Response envelope shape verification
  // ===========================================================================
  describe('Response envelope compatibility', () => {
    it('getLinkedRisks returns plain array (controller wraps in { success: true, data: [...] })', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      changeRiskRepository.find.mockResolvedValue([]);

      const result = await service.getLinkedRisks(TENANT_ID, CHANGE_ID);

      expect(Array.isArray(result)).toBe(true);
    });

    it('getLinkedControls returns plain array (controller wraps in { success: true, data: [...] })', async () => {
      changeRepository.findOne.mockResolvedValue(mockChange as ItsmChange);
      changeControlRepository.find.mockResolvedValue([]);

      const result = await service.getLinkedControls(TENANT_ID, CHANGE_ID);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
