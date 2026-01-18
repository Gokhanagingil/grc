import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { DynamicRecord } from '../entities/dynamic-record.entity';
import { SysDictionary } from '../entities/sys-dictionary.entity';
import { PlatformBuilderService } from './platform-builder.service';
import {
  CreateRecordDto,
  UpdateRecordDto,
  RecordFilterDto,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';
import { PlatformBuilderFieldType } from '../enums';
import { AuditService } from '../../audit/audit.service';

/**
 * Dynamic Data Service
 *
 * Manages CRUD operations for dynamic records stored in the dynamic_records table.
 * Validates data against field definitions in SysDictionary.
 */
@Injectable()
export class DynamicDataService {
  constructor(
    @InjectRepository(DynamicRecord)
    private readonly recordRepository: Repository<DynamicRecord>,
    private readonly platformBuilderService: PlatformBuilderService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  /**
   * Create a new dynamic record
   */
  async createRecord(
    tenantId: string,
    userId: string,
    tableName: string,
    dto: CreateRecordDto,
  ): Promise<DynamicRecord> {
    // Validate table exists and is active
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    // Get field definitions
    const fields = await this.platformBuilderService.getActiveFieldsForTable(
      tenantId,
      tableName,
    );

    // Validate and coerce data
    const validatedData = this.validateAndCoerceData(dto.data, fields);

    // Generate a unique record ID
    const recordId = randomUUID();

    const record = this.recordRepository.create({
      tenantId,
      tableName,
      recordId,
      data: validatedData,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.recordRepository.save(record);

    // Record audit log
    await this.auditService?.recordCreate(
      'DynamicRecord',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  /**
   * Update an existing dynamic record
   */
  async updateRecord(
    tenantId: string,
    userId: string,
    tableName: string,
    recordId: string,
    dto: UpdateRecordDto,
  ): Promise<DynamicRecord> {
    // Validate table exists and is active
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    // Find the record
    const record = await this.findRecordById(tenantId, tableName, recordId);

    // Get field definitions
    const fields = await this.platformBuilderService.getActiveFieldsForTable(
      tenantId,
      tableName,
    );

    // Validate and coerce data (merge with existing data)
    const mergedData = { ...record.data, ...dto.data };
    const validatedData = this.validateAndCoerceData(mergedData, fields);

    const beforeState = { ...record };

    record.data = validatedData;
    record.updatedBy = userId;

    const saved = await this.recordRepository.save(record);

    // Record audit log
    await this.auditService?.recordUpdate(
      'DynamicRecord',
      record.id,
      beforeState as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  /**
   * Soft delete a dynamic record
   */
  async deleteRecord(
    tenantId: string,
    userId: string,
    tableName: string,
    recordId: string,
  ): Promise<void> {
    // Validate table exists
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    // Find the record
    const record = await this.findRecordById(tenantId, tableName, recordId);

    record.isDeleted = true;
    record.updatedBy = userId;
    await this.recordRepository.save(record);

    // Record audit log
    await this.auditService?.recordDelete(
      'DynamicRecord',
      record,
      userId,
      tenantId,
    );
  }

  /**
   * Find a record by ID
   */
  async findRecordById(
    tenantId: string,
    tableName: string,
    recordId: string,
  ): Promise<DynamicRecord> {
    const record = await this.recordRepository.findOne({
      where: { tenantId, tableName, recordId, isDeleted: false },
    });

    if (!record) {
      throw new NotFoundException(
        `Record with ID '${recordId}' not found in table '${tableName}'`,
      );
    }

    return record;
  }

  /**
   * Get a single record with field metadata
   */
  async getRecord(
    tenantId: string,
    tableName: string,
    recordId: string,
  ): Promise<{ record: DynamicRecord; fields: SysDictionary[] }> {
    // Validate table exists
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    const record = await this.findRecordById(tenantId, tableName, recordId);
    const fields = await this.platformBuilderService.getActiveFieldsForTable(
      tenantId,
      tableName,
    );

    return { record, fields };
  }

  /**
   * List records with filtering and pagination
   */
  async listRecords(
    tenantId: string,
    tableName: string,
    filterDto: RecordFilterDto,
  ): Promise<PaginatedResponse<DynamicRecord>> {
    // Validate table exists
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search,
      filter,
    } = filterDto;

    const qb = this.recordRepository.createQueryBuilder('record');

    qb.where('record.tenantId = :tenantId', { tenantId });
    qb.andWhere('record.tableName = :tableName', { tableName });
    qb.andWhere('record.isDeleted = :isDeleted', { isDeleted: false });

    // Apply search across all JSONB data fields
    if (search) {
      qb.andWhere('record.data::text ILIKE :search', {
        search: `%${search}%`,
      });
    }

    // Apply filter (expects JSON format: {"fieldName": "value"})
    if (filter) {
      try {
        const filterObj = JSON.parse(filter) as Record<string, unknown>;
        for (const [key, value] of Object.entries(filterObj)) {
          // Sanitize key to prevent SQL injection
          const sanitizedKey = key.replace(/[^a-z0-9_]/gi, '');
          if (sanitizedKey !== key) {
            throw new BadRequestException(`Invalid filter key: ${key}`);
          }
          const stringValue =
            typeof value === 'string'
              ? value
              : typeof value === 'number' || typeof value === 'boolean'
                ? String(value)
                : JSON.stringify(value);
          qb.andWhere(
            `record.data->>'${sanitizedKey}' = :filterValue_${sanitizedKey}`,
            {
              [`filterValue_${sanitizedKey}`]: stringValue,
            },
          );
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        throw new BadRequestException(
          'Invalid filter format. Expected JSON object.',
        );
      }
    }

    const total = await qb.getCount();

    // Handle sorting - can sort by createdAt, updatedAt, or JSONB fields
    const validSortBy = ['createdAt', 'updatedAt', 'recordId'].includes(sortBy)
      ? `record.${sortBy}`
      : `record.data->>'${sortBy.replace(/[^a-z0-9_]/gi, '')}'`;
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(validSortBy, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const records = await qb.getMany();

    return createPaginatedResponse(records, total, page, pageSize);
  }

  /**
   * Get records with field metadata for UI rendering
   */
  async listRecordsWithMetadata(
    tenantId: string,
    tableName: string,
    filterDto: RecordFilterDto,
  ): Promise<{
    records: PaginatedResponse<DynamicRecord>;
    fields: SysDictionary[];
  }> {
    const [records, fields] = await Promise.all([
      this.listRecords(tenantId, tableName, filterDto),
      this.platformBuilderService.getActiveFieldsForTable(tenantId, tableName),
    ]);

    return { records, fields };
  }

  /**
   * Validate and coerce data against field definitions
   */
  private validateAndCoerceData(
    data: Record<string, unknown>,
    fields: SysDictionary[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const field of fields) {
      const value = data[field.fieldName];

      // Check required fields
      if (
        field.isRequired &&
        (value === undefined || value === null || value === '')
      ) {
        errors.push(`Field '${field.fieldName}' is required`);
        continue;
      }

      // Skip if value is not provided and not required
      if (value === undefined || value === null) {
        if (field.defaultValue !== null) {
          result[field.fieldName] = this.coerceValue(
            field.defaultValue,
            field.type,
          );
        }
        continue;
      }

      // Coerce and validate value based on type
      try {
        result[field.fieldName] = this.coerceValue(value, field.type);

        // Validate choice options
        if (
          field.type === PlatformBuilderFieldType.CHOICE &&
          field.choiceOptions
        ) {
          const validValues = field.choiceOptions.map((opt) => opt.value);
          if (!validValues.includes(String(result[field.fieldName]))) {
            errors.push(
              `Field '${field.fieldName}' must be one of: ${validValues.join(', ')}`,
            );
          }
        }
      } catch (e) {
        errors.push(`Field '${field.fieldName}': ${(e as Error).message}`);
      }
    }

    // Include any extra fields that aren't in the schema (for flexibility)
    for (const [key, value] of Object.entries(data)) {
      if (!fields.find((f) => f.fieldName === key)) {
        result[key] = value;
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }

    return result;
  }

  /**
   * Coerce a value to the expected type
   */
  private coerceValue(value: unknown, type: PlatformBuilderFieldType): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    // Convert value to string safely
    const stringValue =
      typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);

    switch (type) {
      case PlatformBuilderFieldType.STRING:
      case PlatformBuilderFieldType.TEXT:
      case PlatformBuilderFieldType.CHOICE:
        return stringValue;

      case PlatformBuilderFieldType.INTEGER: {
        const intVal = parseInt(stringValue, 10);
        if (isNaN(intVal)) {
          throw new Error('Invalid integer value');
        }
        return intVal;
      }

      case PlatformBuilderFieldType.DECIMAL: {
        const floatVal = parseFloat(stringValue);
        if (isNaN(floatVal)) {
          throw new Error('Invalid decimal value');
        }
        return floatVal;
      }

      case PlatformBuilderFieldType.BOOLEAN:
        if (typeof value === 'boolean') return value;
        if (stringValue === 'true' || stringValue === '1') return true;
        if (stringValue === 'false' || stringValue === '0') return false;
        throw new Error('Invalid boolean value');

      case PlatformBuilderFieldType.DATE: {
        const dateVal = new Date(stringValue);
        if (isNaN(dateVal.getTime())) {
          throw new Error('Invalid date value');
        }
        return dateVal.toISOString().split('T')[0];
      }

      case PlatformBuilderFieldType.DATETIME: {
        const datetimeVal = new Date(stringValue);
        if (isNaN(datetimeVal.getTime())) {
          throw new Error('Invalid datetime value');
        }
        return datetimeVal.toISOString();
      }

      case PlatformBuilderFieldType.REFERENCE:
        // For references, just store the ID as string
        return stringValue;

      default:
        return value;
    }
  }
}
