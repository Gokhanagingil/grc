import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ApplyService } from './apply.service';
import { ServiceNowClientService } from '../servicenow';

describe('ApplyService', () => {
  let service: ApplyService;
  let snClient: jest.Mocked<ServiceNowClientService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockSysId = 'abc123';

  beforeEach(async () => {
    const mockSnClient = {
      postComment: jest.fn().mockResolvedValue({ sys_id: mockSysId }),
      getTenantConfig: jest.fn(),
      listIncidents: jest.fn(),
      getIncident: jest.fn(),
      listKbArticles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplyService,
        { provide: ServiceNowClientService, useValue: mockSnClient },
      ],
    }).compile();

    service = module.get<ApplyService>(ApplyService);
    snClient = module.get(ServiceNowClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('allowlist validation', () => {
    it('should allow work_notes field', async () => {
      const result = await service.apply(
        mockTenantId,
        mockSysId,
        'work_notes_draft',
        'work_notes',
        'Test note',
      );
      expect(result.success).toBe(true);
      expect(result.targetField).toBe('work_notes');
      expect(snClient.postComment).toHaveBeenCalledWith(
        mockTenantId,
        mockSysId,
        'work_notes',
        'Test note',
      );
    });

    it('should allow additional_comments field', async () => {
      const result = await service.apply(
        mockTenantId,
        mockSysId,
        'customer_update_draft',
        'additional_comments',
        'Customer update',
      );
      expect(result.success).toBe(true);
      expect(result.targetField).toBe('additional_comments');
      expect(snClient.postComment).toHaveBeenCalledWith(
        mockTenantId,
        mockSysId,
        'comments',
        'Customer update',
      );
    });

    it('should reject disallowed field "category"', async () => {
      await expect(
        service.apply(
          mockTenantId,
          mockSysId,
          'test',
          'category' as 'work_notes',
          'value',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject disallowed field "assignment_group"', async () => {
      await expect(
        service.apply(
          mockTenantId,
          mockSysId,
          'test',
          'assignment_group' as 'work_notes',
          'value',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject disallowed field "priority"', async () => {
      await expect(
        service.apply(
          mockTenantId,
          mockSysId,
          'test',
          'priority' as 'work_notes',
          'value',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject disallowed field "state"', async () => {
      await expect(
        service.apply(
          mockTenantId,
          mockSysId,
          'test',
          'state' as 'work_notes',
          'value',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('text validation', () => {
    it('should reject empty text', async () => {
      await expect(
        service.apply(
          mockTenantId,
          mockSysId,
          'work_notes_draft',
          'work_notes',
          '',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject whitespace-only text', async () => {
      await expect(
        service.apply(
          mockTenantId,
          mockSysId,
          'work_notes_draft',
          'work_notes',
          '   ',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid text', async () => {
      const result = await service.apply(
        mockTenantId,
        mockSysId,
        'work_notes_draft',
        'work_notes',
        'Valid note content',
      );
      expect(result.success).toBe(true);
    });
  });

  describe('response schema', () => {
    it('should return stable response schema on success', async () => {
      const result = await service.apply(
        mockTenantId,
        mockSysId,
        'work_notes_draft',
        'work_notes',
        'Test note',
      );
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('incidentSysId', mockSysId);
      expect(result).toHaveProperty('targetField', 'work_notes');
      expect(result).toHaveProperty('appliedAt');
      expect(typeof result.appliedAt).toBe('string');
      expect(new Date(result.appliedAt).getTime()).not.toBeNaN();
    });
  });

  describe('field mapping', () => {
    it('should map work_notes to work_notes ServiceNow field', async () => {
      await service.apply(
        mockTenantId,
        mockSysId,
        'test',
        'work_notes',
        'note',
      );
      expect(snClient.postComment).toHaveBeenCalledWith(
        mockTenantId,
        mockSysId,
        'work_notes',
        'note',
      );
    });

    it('should map additional_comments to comments ServiceNow field', async () => {
      await service.apply(
        mockTenantId,
        mockSysId,
        'test',
        'additional_comments',
        'comment',
      );
      expect(snClient.postComment).toHaveBeenCalledWith(
        mockTenantId,
        mockSysId,
        'comments',
        'comment',
      );
    });
  });

  describe('error propagation', () => {
    it('should propagate ServiceNow client errors', async () => {
      snClient.postComment.mockRejectedValue(
        new Error('ServiceNow API error: 500'),
      );
      await expect(
        service.apply(mockTenantId, mockSysId, 'test', 'work_notes', 'note'),
      ).rejects.toThrow('ServiceNow API error: 500');
    });
  });
});
