import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CiAttributeValidationService } from './ci-attribute-validation.service';
import { CiClassInheritanceService } from '../ci-class/ci-class-inheritance.service';
import { EffectiveFieldDefinition } from '../ci-class/ci-class.entity';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLASS_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const ROOT_CLASS_ID = 'aaaaaaaa-0000-0000-0000-000000000099';

// ---------------------------------------------------------------------------
// Helper to build effective fields
// ---------------------------------------------------------------------------

function makeField(
  overrides: Partial<EffectiveFieldDefinition> & { key: string },
): EffectiveFieldDefinition {
  return {
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    dataType: overrides.dataType ?? 'string',
    required: overrides.required ?? false,
    readOnly: overrides.readOnly ?? false,
    maxLength: overrides.maxLength,
    choices: overrides.choices,
    order: overrides.order ?? 0,
    sourceClassId: overrides.sourceClassId ?? CLASS_ID,
    sourceClassName: overrides.sourceClassName ?? 'test_class',
    inherited: overrides.inherited ?? false,
    inheritanceDepth: overrides.inheritanceDepth ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Default effective schema response
// ---------------------------------------------------------------------------

function makeSchemaResponse(fields: EffectiveFieldDefinition[]) {
  return {
    classId: CLASS_ID,
    className: 'test_class',
    classLabel: 'Test Class',
    ancestors: [],
    effectiveFields: fields,
    totalFieldCount: fields.length,
    inheritedFieldCount: fields.filter((f) => f.inherited).length,
    localFieldCount: fields.filter((f) => !f.inherited).length,
  };
}

// ---------------------------------------------------------------------------
// Mock inheritance service
// ---------------------------------------------------------------------------

const mockInheritanceService = {
  getEffectiveSchema: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CiAttributeValidationService', () => {
  let service: CiAttributeValidationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CiAttributeValidationService,
        {
          provide: CiClassInheritanceService,
          useValue: mockInheritanceService,
        },
      ],
    }).compile();

    service = module.get<CiAttributeValidationService>(
      CiAttributeValidationService,
    );
  });

  // ========================================================================
  // Basic validation
  // ========================================================================

  describe('basic validation', () => {
    it('should pass when class has no fields defined', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        anything: 'goes',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when attributes is null and no required fields', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([makeField({ key: 'optional_field' })]),
      );

      const result = await service.validateAttributes(
        TENANT_ID,
        CLASS_ID,
        null,
      );
      expect(result.valid).toBe(true);
    });

    it('should pass when attributes is undefined and no required fields', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([makeField({ key: 'optional_field' })]),
      );

      const result = await service.validateAttributes(
        TENANT_ID,
        CLASS_ID,
        undefined,
      );
      expect(result.valid).toBe(true);
    });

    it('should pass when class not found (backward compat)', async () => {
      mockInheritanceService.getEffectiveSchema.mockRejectedValue(
        new BadRequestException('Class not found'),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        some: 'data',
      });
      expect(result.valid).toBe(true);
    });
  });

  // ========================================================================
  // Required field validation
  // ========================================================================

  describe('required field validation', () => {
    it('should fail when required field is missing on create', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'name', label: 'Name', required: true }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('name');
      expect(result.errors[0].code).toBe('REQUIRED');
    });

    it('should fail when required field is null on create', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'name', label: 'Name', required: true }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        name: null,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('REQUIRED');
    });

    it('should fail when required field is empty string on create', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'name', label: 'Name', required: true }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        name: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('REQUIRED');
    });

    it('should skip required check on update for missing keys', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'name', label: 'Name', required: true }),
          makeField({ key: 'description', label: 'Description' }),
        ]),
      );

      // Update with only description — name is required but not present in update payload
      const result = await service.validateAttributes(
        TENANT_ID,
        CLASS_ID,
        { description: 'updated' },
        true, // isUpdate
      );
      expect(result.valid).toBe(true);
    });

    it('should pass when required field is provided', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'name', label: 'Name', required: true }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        name: 'Server 1',
      });
      expect(result.valid).toBe(true);
    });
  });

  // ========================================================================
  // Type validation
  // ========================================================================

  describe('type validation', () => {
    it('should fail when string field gets a number', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'hostname', dataType: 'string' }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        hostname: 123,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('should fail when number field gets a string', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'cpu_count', dataType: 'number' }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        cpu_count: 'four',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('should fail when number field gets NaN', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'cpu_count', dataType: 'number' }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        cpu_count: NaN,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('should pass when number field gets a valid number', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'cpu_count', dataType: 'number' }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        cpu_count: 8,
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when boolean field gets a string', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'is_virtual', dataType: 'boolean' }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        is_virtual: 'yes',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('should pass when boolean field gets true/false', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'is_virtual', dataType: 'boolean' }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        is_virtual: true,
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when date field gets an invalid date', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'install_date', dataType: 'date' }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        install_date: 'not-a-date',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('should pass when date field gets a valid ISO date', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'install_date', dataType: 'date' }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        install_date: '2025-01-15T10:30:00Z',
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when json field gets a string', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([makeField({ key: 'config', dataType: 'json' })]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        config: 'not an object',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('should pass when json field gets an object', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([makeField({ key: 'config', dataType: 'json' })]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        config: { key: 'value' },
      });
      expect(result.valid).toBe(true);
    });
  });

  // ========================================================================
  // Enum validation
  // ========================================================================

  describe('enum validation', () => {
    it('should fail when enum value is not in choices', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({
            key: 'os_type',
            dataType: 'enum',
            choices: ['WINDOWS', 'LINUX', 'OTHER'],
          }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        os_type: 'MACOS',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_ENUM');
    });

    it('should pass when enum value is in choices', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({
            key: 'os_type',
            dataType: 'enum',
            choices: ['WINDOWS', 'LINUX', 'OTHER'],
          }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        os_type: 'LINUX',
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when enum field gets a non-string value', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({
            key: 'os_type',
            dataType: 'enum',
            choices: ['WINDOWS', 'LINUX'],
          }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        os_type: 42,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });
  });

  // ========================================================================
  // MaxLength validation
  // ========================================================================

  describe('maxLength validation', () => {
    it('should fail when string exceeds maxLength', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({
            key: 'hostname',
            dataType: 'string',
            maxLength: 10,
          }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        hostname: 'this-is-a-very-long-hostname',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MAX_LENGTH_EXCEEDED');
    });

    it('should pass when string is within maxLength', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({
            key: 'hostname',
            dataType: 'string',
            maxLength: 50,
          }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        hostname: 'srv-01',
      });
      expect(result.valid).toBe(true);
    });
  });

  // ========================================================================
  // Multiple errors
  // ========================================================================

  describe('multiple errors', () => {
    it('should report multiple field errors at once', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({ key: 'name', label: 'Name', required: true }),
          makeField({
            key: 'cpu_count',
            label: 'CPU Count',
            dataType: 'number',
          }),
          makeField({
            key: 'os_type',
            label: 'OS Type',
            dataType: 'enum',
            choices: ['WINDOWS', 'LINUX'],
          }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        cpu_count: 'not a number',
        os_type: 'MACOS',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);

      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('REQUIRED');
      expect(codes).toContain('INVALID_TYPE');
      expect(codes).toContain('INVALID_ENUM');
    });
  });

  // ========================================================================
  // Inherited fields validation
  // ========================================================================

  describe('inherited fields', () => {
    it('should validate inherited required fields too', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({
            key: 'name',
            label: 'Name',
            required: true,
            inherited: true,
            sourceClassId: ROOT_CLASS_ID,
            sourceClassName: 'cmdb_ci',
            inheritanceDepth: 2,
          }),
          makeField({
            key: 'serial_number',
            label: 'Serial Number',
            required: false,
          }),
        ]),
      );

      const result = await service.validateAttributes(TENANT_ID, CLASS_ID, {
        serial_number: 'SN-001',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('name');
      expect(result.errors[0].code).toBe('REQUIRED');
    });
  });

  // ========================================================================
  // validateAndThrow
  // ========================================================================

  describe('validateAndThrow', () => {
    it('should throw BadRequestException on validation failure', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({
            key: 'name',
            label: 'Name',
            required: true,
          }),
        ]),
      );

      await expect(
        service.validateAndThrow(TENANT_ID, CLASS_ID, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not throw when validation passes', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({
            key: 'name',
            label: 'Name',
            required: true,
          }),
        ]),
      );

      await expect(
        service.validateAndThrow(TENANT_ID, CLASS_ID, { name: 'Server 1' }),
      ).resolves.toBeUndefined();
    });

    it('should include validationErrors in thrown exception', async () => {
      mockInheritanceService.getEffectiveSchema.mockResolvedValue(
        makeSchemaResponse([
          makeField({
            key: 'name',
            label: 'Name',
            required: true,
          }),
        ]),
      );

      try {
        await service.validateAndThrow(TENANT_ID, CLASS_ID, {});
        fail('Expected BadRequestException');
      } catch (err) {
        const response = (err as BadRequestException).getResponse();
        expect(response).toHaveProperty('validationErrors');
        const valErrors = (
          response as { validationErrors: Array<{ field: string }> }
        ).validationErrors;
        expect(valErrors).toHaveLength(1);
        expect(valErrors[0].field).toBe('name');
      }
    });
  });
});
