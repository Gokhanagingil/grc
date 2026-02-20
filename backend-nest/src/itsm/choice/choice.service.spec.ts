import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ChoiceService } from './choice.service';
import { SysChoice } from './sys-choice.entity';

describe('ChoiceService', () => {
  let service: ChoiceService;
  let repository: jest.Mocked<Repository<SysChoice>>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';

  const mockChoice: Partial<SysChoice> = {
    id: '00000000-0000-0000-0000-000000000100',
    tenantId: mockTenantId,
    tableName: 'itsm_incidents',
    fieldName: 'category',
    value: 'hardware',
    label: 'Hardware',
    sortOrder: 10,
    isActive: true,
    isDeleted: false,
    parentValue: null,
    metadata: null,
  };

  beforeEach(async () => {
    const mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      merge: jest
        .fn()
        .mockImplementation((entity, data) => ({ ...entity, ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChoiceService,
        { provide: getRepositoryToken(SysChoice), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ChoiceService>(ChoiceService);
    repository = module.get(getRepositoryToken(SysChoice));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getChoices', () => {
    it('should return active choices ordered by sortOrder', async () => {
      const choices = [
        { ...mockChoice, value: 'hardware', sortOrder: 10 },
        { ...mockChoice, value: 'software', sortOrder: 20 },
      ] as SysChoice[];

      repository.find.mockResolvedValue(choices);

      const result = await service.getChoices(
        mockTenantId,
        'itsm_incidents',
        'category',
      );

      expect(result).toHaveLength(2);
      expect(repository.find).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          tableName: 'itsm_incidents',
          fieldName: 'category',
          isActive: true,
          isDeleted: false,
        },
        order: { sortOrder: 'ASC', label: 'ASC' },
      });
    });
  });

  describe('getAllChoicesForTable', () => {
    it('should return choices grouped by field name', async () => {
      const choices = [
        { ...mockChoice, fieldName: 'category', value: 'hardware' },
        { ...mockChoice, fieldName: 'category', value: 'software' },
        { ...mockChoice, fieldName: 'impact', value: 'low' },
      ] as SysChoice[];

      repository.find.mockResolvedValue(choices);

      const result = await service.getAllChoicesForTable(
        mockTenantId,
        'itsm_incidents',
      );

      expect(result['category']).toHaveLength(2);
      expect(result['impact']).toHaveLength(1);
    });
  });

  describe('resolveCanonicalValue', () => {
    it('should return exact match value when found', async () => {
      repository.findOne.mockResolvedValue(mockChoice as SysChoice);

      const result = await service.resolveCanonicalValue(
        mockTenantId,
        'itsm_incidents',
        'category',
        'hardware',
      );

      expect(result).toBe('hardware');
    });

    it('should return canonical value for case-insensitive match', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.find.mockResolvedValue([
        { ...mockChoice, value: 'hardware' } as SysChoice,
        { ...mockChoice, value: 'software' } as SysChoice,
      ]);

      const result = await service.resolveCanonicalValue(
        mockTenantId,
        'itsm_incidents',
        'category',
        'Hardware',
      );

      expect(result).toBe('hardware');
    });

    it('should return canonical value for UPPERCASE input', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.find.mockResolvedValue([
        { ...mockChoice, value: 'hardware' } as SysChoice,
      ]);

      const result = await service.resolveCanonicalValue(
        mockTenantId,
        'itsm_incidents',
        'category',
        'HARDWARE',
      );

      expect(result).toBe('hardware');
    });

    it('should return null when no match exists', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.find.mockResolvedValue([
        { ...mockChoice, value: 'hardware' } as SysChoice,
      ]);

      const result = await service.resolveCanonicalValue(
        mockTenantId,
        'itsm_incidents',
        'category',
        'nonexistent',
      );

      expect(result).toBeNull();
    });
  });

  describe('validateChoice', () => {
    it('should return true for valid active choice (exact match)', async () => {
      repository.findOne.mockResolvedValue(mockChoice as SysChoice);

      const result = await service.validateChoice(
        mockTenantId,
        'itsm_incidents',
        'category',
        'hardware',
      );

      expect(result).toBe(true);
    });

    it('should return true for case-insensitive match', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.find.mockResolvedValue([
        { ...mockChoice, value: 'hardware' } as SysChoice,
      ]);

      const result = await service.validateChoice(
        mockTenantId,
        'itsm_incidents',
        'category',
        'HARDWARE',
      );

      expect(result).toBe(true);
    });

    it('should return false for invalid choice value', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.find.mockResolvedValue([
        { ...mockChoice, value: 'hardware' } as SysChoice,
      ]);

      const result = await service.validateChoice(
        mockTenantId,
        'itsm_incidents',
        'category',
        'nonexistent',
      );

      expect(result).toBe(false);
    });
  });

  describe('validateChoiceFields', () => {
    it('should return no errors when all values are valid (exact match)', async () => {
      repository.count.mockResolvedValue(1);
      repository.findOne.mockResolvedValue(mockChoice as SysChoice);

      const errors = await service.validateChoiceFields(
        mockTenantId,
        'itsm_incidents',
        { category: 'hardware', impact: 'medium' },
      );

      expect(errors).toHaveLength(0);
    });

    it('should normalize case-insensitive input to canonical value', async () => {
      repository.count.mockResolvedValue(1);
      repository.findOne.mockResolvedValue(null);
      repository.find.mockResolvedValue([
        { ...mockChoice, value: 'hardware' } as SysChoice,
      ]);

      const data: Record<string, unknown> = { category: 'HARDWARE' };
      const errors = await service.validateChoiceFields(
        mockTenantId,
        'itsm_incidents',
        data,
      );

      expect(errors).toHaveLength(0);
      expect(data.category).toBe('hardware');
    });

    it('should return errors for invalid values with valid values listed', async () => {
      repository.count.mockResolvedValue(5);
      repository.findOne.mockResolvedValue(null);
      repository.find.mockResolvedValue([
        { ...mockChoice, value: 'hardware' } as SysChoice,
        { ...mockChoice, value: 'software' } as SysChoice,
      ]);

      const errors = await service.validateChoiceFields(
        mockTenantId,
        'itsm_incidents',
        { category: 'invalid_cat' },
      );

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe('INVALID_CHOICE');
      expect(errors[0].field).toBe('category');
      expect(errors[0].value).toBe('invalid_cat');
      expect(errors[0].message).toContain('Valid values:');
    });

    it('should skip validation when no choices are seeded for a field', async () => {
      repository.count.mockResolvedValue(0);

      const errors = await service.validateChoiceFields(
        mockTenantId,
        'itsm_incidents',
        { category: 'anything', impact: 'whatever' },
      );

      expect(errors).toHaveLength(0);
    });

    it('should skip undefined/null fields', async () => {
      const errors = await service.validateChoiceFields(
        mockTenantId,
        'itsm_incidents',
        { shortDescription: 'test' },
      );

      expect(errors).toHaveLength(0);
      expect(repository.count).not.toHaveBeenCalled();
    });

    it('should return empty for unmanaged tables', async () => {
      const errors = await service.validateChoiceFields(
        mockTenantId,
        'unknown_table',
        { field: 'value' },
      );

      expect(errors).toHaveLength(0);
    });
  });

  describe('throwIfInvalidChoices', () => {
    it('should throw BadRequestException when errors exist', () => {
      const errors = [
        {
          error: 'INVALID_CHOICE' as const,
          field: 'category',
          value: 'bad',
          table: 'itsm_incidents',
          message: 'Invalid value',
        },
      ];

      expect(() => service.throwIfInvalidChoices(errors)).toThrow(
        BadRequestException,
      );
    });

    it('should not throw when no errors', () => {
      expect(() => service.throwIfInvalidChoices([])).not.toThrow();
    });
  });

  describe('createChoice', () => {
    it('should create a new choice', async () => {
      const data = {
        tableName: 'itsm_incidents',
        fieldName: 'category',
        value: 'database',
        label: 'Database',
        sortOrder: 60,
      };

      repository.create.mockReturnValue({
        ...data,
        id: '00000000-0000-0000-0000-000000000200',
        tenantId: mockTenantId,
        isActive: true,
        isDeleted: false,
        createdBy: mockUserId,
      } as SysChoice);
      repository.save.mockResolvedValue({
        ...data,
        id: '00000000-0000-0000-0000-000000000200',
        tenantId: mockTenantId,
        isActive: true,
        isDeleted: false,
        createdBy: mockUserId,
      } as SysChoice);

      const result = await service.createChoice(
        mockTenantId,
        mockUserId,
        data as Partial<SysChoice>,
      );

      expect(result).toBeDefined();
      expect(result.value).toBe('database');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          createdBy: mockUserId,
        }),
      );
    });
  });

  describe('updateChoice', () => {
    it('should update an existing choice', async () => {
      repository.findOne.mockResolvedValue(mockChoice as SysChoice);
      repository.save.mockResolvedValue({
        ...mockChoice,
        label: 'Updated Label',
      } as SysChoice);

      const result = await service.updateChoice(
        mockTenantId,
        mockUserId,
        mockChoice.id!,
        { label: 'Updated Label' },
      );

      expect(result).toBeDefined();
      expect(result!.label).toBe('Updated Label');
    });

    it('should return null when choice not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.updateChoice(
        mockTenantId,
        mockUserId,
        'nonexistent',
        { label: 'Updated' },
      );

      expect(result).toBeNull();
    });
  });

  describe('deactivateChoice', () => {
    it('should deactivate an existing choice', async () => {
      repository.findOne.mockResolvedValue(mockChoice as SysChoice);
      repository.save.mockResolvedValue({
        ...mockChoice,
        isActive: false,
      } as SysChoice);

      const result = await service.deactivateChoice(
        mockTenantId,
        mockUserId,
        mockChoice.id!,
      );

      expect(result).toBe(true);
    });

    it('should return false when choice not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.deactivateChoice(
        mockTenantId,
        mockUserId,
        'nonexistent',
      );

      expect(result).toBe(false);
    });
  });

  describe('isChoiceManagedTable', () => {
    it('should return true for managed tables', () => {
      expect(service.isChoiceManagedTable('itsm_incidents')).toBe(true);
      expect(service.isChoiceManagedTable('itsm_changes')).toBe(true);
      expect(service.isChoiceManagedTable('itsm_services')).toBe(true);
    });

    it('should return false for unmanaged tables', () => {
      expect(service.isChoiceManagedTable('unknown_table')).toBe(false);
    });
  });

  describe('getChoiceManagedFields', () => {
    it('should return fields for itsm_incidents', () => {
      const fields = service.getChoiceManagedFields('itsm_incidents');
      expect(fields).toContain('category');
      expect(fields).toContain('impact');
      expect(fields).toContain('urgency');
      expect(fields).toContain('status');
      expect(fields).toContain('source');
      expect(fields).toContain('priority');
    });

    it('should return fields for itsm_changes', () => {
      const fields = service.getChoiceManagedFields('itsm_changes');
      expect(fields).toContain('type');
      expect(fields).toContain('state');
      expect(fields).toContain('risk');
    });

    it('should return fields for itsm_services', () => {
      const fields = service.getChoiceManagedFields('itsm_services');
      expect(fields).toContain('criticality');
      expect(fields).toContain('status');
    });

    it('should return empty array for unknown table', () => {
      expect(service.getChoiceManagedFields('unknown')).toEqual([]);
    });
  });
});
