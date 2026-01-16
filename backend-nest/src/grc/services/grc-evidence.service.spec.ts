import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GrcEvidenceService } from './grc-evidence.service';
import {
  GrcEvidence,
  GrcControl,
  GrcControlEvidence,
  GrcTestResult,
  GrcEvidenceTestResult,
  GrcIssue,
  GrcIssueEvidence,
} from '../entities';
import { AuditService } from '../../audit/audit.service';
import {
  EvidenceType,
  EvidenceSourceType,
  EvidenceStatus,
  ControlEvidenceType,
} from '../enums';

describe('GrcEvidenceService', () => {
  let service: GrcEvidenceService;
  let evidenceRepository: jest.Mocked<Repository<GrcEvidence>>;
  let controlRepository: jest.Mocked<Repository<GrcControl>>;
  let controlEvidenceRepository: jest.Mocked<Repository<GrcControlEvidence>>;
  let auditService: jest.Mocked<AuditService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockEvidenceId = '00000000-0000-0000-0000-000000000003';
  const mockControlId = '00000000-0000-0000-0000-000000000004';

  const mockEvidence: Partial<GrcEvidence> = {
    id: mockEvidenceId,
    tenantId: mockTenantId,
    name: 'Test Evidence',
    description: 'A test evidence for unit testing',
    type: EvidenceType.DOCUMENT,
    sourceType: EvidenceSourceType.MANUAL,
    status: EvidenceStatus.DRAFT,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockUserId,
  };

  const mockControl: Partial<GrcControl> = {
    id: mockControlId,
    tenantId: mockTenantId,
    name: 'Test Control',
    isDeleted: false,
  };

  const mockControlEvidence: Partial<GrcControlEvidence> = {
    id: '00000000-0000-0000-0000-000000000005',
    tenantId: mockTenantId,
    evidenceId: mockEvidenceId,
    controlId: mockControlId,
    evidenceType: ControlEvidenceType.BASELINE,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockEvidenceRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockControlRepository = {
      findOne: jest.fn(),
    };

    const mockControlEvidenceRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockTestResultRepository = {
      findOne: jest.fn(),
    };

    const mockEvidenceTestResultRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockIssueRepository = {
      findOne: jest.fn(),
    };

    const mockIssueEvidenceRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockAuditService = {
      recordCreate: jest.fn(),
      recordUpdate: jest.fn(),
      recordDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrcEvidenceService,
        {
          provide: getRepositoryToken(GrcEvidence),
          useValue: mockEvidenceRepository,
        },
        {
          provide: getRepositoryToken(GrcControl),
          useValue: mockControlRepository,
        },
        {
          provide: getRepositoryToken(GrcControlEvidence),
          useValue: mockControlEvidenceRepository,
        },
        {
          provide: getRepositoryToken(GrcTestResult),
          useValue: mockTestResultRepository,
        },
        {
          provide: getRepositoryToken(GrcEvidenceTestResult),
          useValue: mockEvidenceTestResultRepository,
        },
        {
          provide: getRepositoryToken(GrcIssue),
          useValue: mockIssueRepository,
        },
        {
          provide: getRepositoryToken(GrcIssueEvidence),
          useValue: mockIssueEvidenceRepository,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<GrcEvidenceService>(GrcEvidenceService);
    evidenceRepository = module.get(getRepositoryToken(GrcEvidence));
    controlRepository = module.get(getRepositoryToken(GrcControl));
    controlEvidenceRepository = module.get(
      getRepositoryToken(GrcControlEvidence),
    );
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('linkToControl', () => {
    it('should link evidence to control successfully', async () => {
      evidenceRepository.findOne.mockResolvedValue(mockEvidence as GrcEvidence);
      controlRepository.findOne.mockResolvedValue(mockControl as GrcControl);
      controlEvidenceRepository.findOne.mockResolvedValue(null);
      controlEvidenceRepository.create.mockReturnValue(
        mockControlEvidence as GrcControlEvidence,
      );
      controlEvidenceRepository.save.mockResolvedValue(
        mockControlEvidence as GrcControlEvidence,
      );

      const result = await service.linkToControl(
        mockTenantId,
        mockEvidenceId,
        mockControlId,
        mockUserId,
      );

      expect(result).toEqual(mockControlEvidence);
      expect(evidenceRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockEvidenceId, tenantId: mockTenantId, isDeleted: false },
      });
      expect(controlRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockControlId, tenantId: mockTenantId, isDeleted: false },
      });
      expect(controlEvidenceRepository.findOne).toHaveBeenCalledWith({
        where: {
          evidenceId: mockEvidenceId,
          controlId: mockControlId,
          tenantId: mockTenantId,
        },
      });
      expect(controlEvidenceRepository.create).toHaveBeenCalledWith({
        evidenceId: mockEvidenceId,
        controlId: mockControlId,
        tenantId: mockTenantId,
        evidenceType: ControlEvidenceType.BASELINE,
      });
      expect(controlEvidenceRepository.save).toHaveBeenCalled();
      expect(auditService.recordCreate).toHaveBeenCalledWith(
        'GrcControlEvidence',
        mockControlEvidence,
        mockUserId,
        mockTenantId,
      );
    });

    it('should throw NotFoundException when evidence not found', async () => {
      evidenceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.linkToControl(
          mockTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(controlRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when control not found', async () => {
      evidenceRepository.findOne.mockResolvedValue(mockEvidence as GrcEvidence);
      controlRepository.findOne.mockResolvedValue(null);

      await expect(
        service.linkToControl(
          mockTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(controlEvidenceRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when link already exists', async () => {
      evidenceRepository.findOne.mockResolvedValue(mockEvidence as GrcEvidence);
      controlRepository.findOne.mockResolvedValue(mockControl as GrcControl);
      controlEvidenceRepository.findOne.mockResolvedValue(
        mockControlEvidence as GrcControlEvidence,
      );

      await expect(
        service.linkToControl(
          mockTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(controlEvidenceRepository.create).not.toHaveBeenCalled();
    });

    it('should enforce tenant isolation', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';
      evidenceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.linkToControl(
          differentTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(evidenceRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockEvidenceId,
          tenantId: differentTenantId,
          isDeleted: false,
        },
      });
    });
  });

  describe('unlinkFromControl', () => {
    it('should unlink evidence from control successfully', async () => {
      controlEvidenceRepository.findOne.mockResolvedValue(
        mockControlEvidence as GrcControlEvidence,
      );
      controlEvidenceRepository.remove.mockResolvedValue(
        mockControlEvidence as GrcControlEvidence,
      );

      await service.unlinkFromControl(
        mockTenantId,
        mockEvidenceId,
        mockControlId,
        mockUserId,
      );

      expect(controlEvidenceRepository.findOne).toHaveBeenCalledWith({
        where: {
          evidenceId: mockEvidenceId,
          controlId: mockControlId,
          tenantId: mockTenantId,
        },
      });
      expect(controlEvidenceRepository.remove).toHaveBeenCalledWith(
        mockControlEvidence,
      );
      expect(auditService.recordDelete).toHaveBeenCalledWith(
        'GrcControlEvidence',
        mockControlEvidence,
        mockUserId,
        mockTenantId,
      );
    });

    it('should throw NotFoundException when link not found', async () => {
      controlEvidenceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.unlinkFromControl(
          mockTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(controlEvidenceRepository.remove).not.toHaveBeenCalled();
    });

    it('should enforce tenant isolation', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';
      controlEvidenceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.unlinkFromControl(
          differentTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(controlEvidenceRepository.findOne).toHaveBeenCalledWith({
        where: {
          evidenceId: mockEvidenceId,
          controlId: mockControlId,
          tenantId: differentTenantId,
        },
      });
    });
  });

  describe('getLinkedControls', () => {
    it('should return linked controls for evidence', async () => {
      const linkedControls = [{ ...mockControlEvidence, control: mockControl }];
      evidenceRepository.findOne.mockResolvedValue(mockEvidence as GrcEvidence);
      controlEvidenceRepository.find.mockResolvedValue(
        linkedControls as GrcControlEvidence[],
      );

      const result = await service.getLinkedControls(
        mockTenantId,
        mockEvidenceId,
      );

      expect(result).toEqual(linkedControls);
      expect(controlEvidenceRepository.find).toHaveBeenCalledWith({
        where: { evidenceId: mockEvidenceId, tenantId: mockTenantId },
        relations: ['control'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should throw NotFoundException when evidence not found', async () => {
      evidenceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getLinkedControls(mockTenantId, mockEvidenceId),
      ).rejects.toThrow(NotFoundException);
      expect(controlEvidenceRepository.find).not.toHaveBeenCalled();
    });

    it('should return empty array when no controls linked', async () => {
      evidenceRepository.findOne.mockResolvedValue(mockEvidence as GrcEvidence);
      controlEvidenceRepository.find.mockResolvedValue([]);

      const result = await service.getLinkedControls(
        mockTenantId,
        mockEvidenceId,
      );

      expect(result).toEqual([]);
    });
  });

  describe('tenant isolation', () => {
    it('should not allow linking evidence from different tenant', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';
      evidenceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.linkToControl(
          differentTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow unlinking evidence from different tenant', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';
      controlEvidenceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.unlinkFromControl(
          differentTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
