import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcessService } from './process.service';
import { Process } from '../entities/process.entity';
import { AuditService } from '../../audit/audit.service';

describe('ProcessService', () => {
  let service: ProcessService;
  let processRepository: jest.Mocked<Repository<Process>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let auditService: jest.Mocked<AuditService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockProcessId = '00000000-0000-0000-0000-000000000003';

  const mockProcess: Partial<Process> = {
    id: mockProcessId,
    tenantId: mockTenantId,
    name: 'Test Process',
    code: 'TEST-001',
    description: 'A test process for unit testing',
    category: 'Testing',
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockUserId,
  };

  beforeEach(async () => {
    const mockProcessRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
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
        ProcessService,
        {
          provide: getRepositoryToken(Process),
          useValue: mockProcessRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<ProcessService>(ProcessService);
    processRepository = module.get(getRepositoryToken(Process));
    eventEmitter = module.get(EventEmitter2);
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProcess', () => {
    it('should create a new process with tenant ID', async () => {
      const createData = {
        name: 'New Process',
        code: 'NEW-001',
        description: 'A new process',
        category: 'ITSM',
      };

      const createdProcess = {
        ...mockProcess,
        ...createData,
        id: mockProcessId,
        tenantId: mockTenantId,
        createdBy: mockUserId,
        isDeleted: false,
      };

      processRepository.create.mockReturnValue(createdProcess as Process);
      processRepository.save.mockResolvedValue(createdProcess as Process);

      const result = await service.createProcess(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result).toEqual(createdProcess);
      expect(processRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createData,
          tenantId: mockTenantId,
          createdBy: mockUserId,
          isDeleted: false,
        }),
      );
      expect(processRepository.save).toHaveBeenCalled();
      expect(auditService.recordCreate).toHaveBeenCalledWith(
        'Process',
        createdProcess,
        mockUserId,
        mockTenantId,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'process.created',
        expect.anything(),
      );
    });
  });

  describe('updateProcess', () => {
    it('should update an existing process', async () => {
      const updateData = {
        name: 'Updated Process Name',
        isActive: false,
      };

      const existingProcess = { ...mockProcess };
      const updatedProcess = { ...mockProcess, ...updateData };

      processRepository.findOne.mockResolvedValue(existingProcess as Process);
      processRepository.merge.mockReturnValue(updatedProcess as Process);
      processRepository.save.mockResolvedValue(updatedProcess as Process);

      const result = await service.updateProcess(
        mockTenantId,
        mockUserId,
        mockProcessId,
        updateData,
      );

      expect(result).toEqual(updatedProcess);
      expect(processRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockProcessId, tenantId: mockTenantId, isDeleted: false },
      });
      expect(auditService.recordUpdate).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'process.updated',
        expect.anything(),
      );
    });

    it('should return null when updating non-existent process', async () => {
      processRepository.findOne.mockResolvedValue(null);

      const result = await service.updateProcess(
        mockTenantId,
        mockUserId,
        'non-existent-id',
        { name: 'Updated' },
      );

      expect(result).toBeNull();
      expect(processRepository.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('softDeleteProcess', () => {
    it('should soft delete a process by setting isDeleted to true', async () => {
      const existingProcess = { ...mockProcess, isDeleted: false };
      const deletedProcess = { ...mockProcess, isDeleted: true };

      processRepository.findOne.mockResolvedValueOnce(existingProcess as Process);
      processRepository.merge.mockReturnValue(deletedProcess as Process);
      processRepository.save.mockResolvedValue(deletedProcess as Process);

      const result = await service.softDeleteProcess(
        mockTenantId,
        mockUserId,
        mockProcessId,
      );

      expect(result).toBe(true);
      expect(auditService.recordDelete).toHaveBeenCalledWith(
        'Process',
        existingProcess,
        mockUserId,
        mockTenantId,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'process.deleted',
        expect.anything(),
      );
    });

    it('should return false when soft deleting non-existent process', async () => {
      processRepository.findOne.mockResolvedValue(null);

      const result = await service.softDeleteProcess(
        mockTenantId,
        mockUserId,
        'non-existent-id',
      );

      expect(result).toBe(false);
      expect(auditService.recordDelete).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('findOneActiveForTenant', () => {
    it('should return process when found and not deleted', async () => {
      processRepository.findOne.mockResolvedValue(mockProcess as Process);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        mockProcessId,
      );

      expect(result).toEqual(mockProcess);
      expect(processRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockProcessId, tenantId: mockTenantId, isDeleted: false },
      });
    });

    it('should return null when process not found', async () => {
      processRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        'non-existent-id',
      );

      expect(result).toBeNull();
    });
  });

  describe('tenant isolation', () => {
    it('should not return processes from different tenant', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';
      processRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        differentTenantId,
        mockProcessId,
      );

      expect(result).toBeNull();
      expect(processRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockProcessId,
          tenantId: differentTenantId,
          isDeleted: false,
        },
      });
    });
  });
});
