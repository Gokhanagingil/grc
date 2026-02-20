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

@Injectable()
export class DynamicDataService {
  constructor(
    @InjectRepository(DynamicRecord)
    private readonly recordRepository: Repository<DynamicRecord>,
    private readonly platformBuilderService: PlatformBuilderService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  async createRecord(
    tenantId: string,
    userId: string,
    tableName: string,
    dto: CreateRecordDto,
  ): Promise<DynamicRecord> {
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    const fields = await this.platformBuilderService.getActiveFieldsForTable(
      tenantId,
      tableName,
    );

    const validatedData = this.validateAndCoerceData(dto.data, fields, false);

    await this.validateReferenceIntegrity(tenantId, validatedData, fields);
    await this.validateUniqueness(tenantId, tableName, validatedData, fields);

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

    await this.auditService?.createAuditLog({
      action: 'create',
      entityName: 'DynamicRecord',
      entityId: saved.id,
      resource: `dynamic_records.${tableName}`,
      resourceId: saved.recordId,
      afterState: validatedData,
      beforeState: null,
      userId,
      tenantId,
      metadata: { tableName, recordId: saved.recordId },
    });

    return saved;
  }

  async updateRecord(
    tenantId: string,
    userId: string,
    tableName: string,
    recordId: string,
    dto: UpdateRecordDto,
  ): Promise<DynamicRecord> {
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    const record = await this.findRecordById(tenantId, tableName, recordId);

    const fields = await this.platformBuilderService.getActiveFieldsForTable(
      tenantId,
      tableName,
    );

    this.enforceReadOnly(dto.data, fields);

    const mergedData = { ...record.data, ...dto.data };
    const validatedData = this.validateAndCoerceData(mergedData, fields, true);

    await this.validateReferenceIntegrity(tenantId, validatedData, fields);
    await this.validateUniqueness(
      tenantId,
      tableName,
      validatedData,
      fields,
      recordId,
    );

    const beforeData = { ...record.data };
    record.data = validatedData;
    record.updatedBy = userId;

    const saved = await this.recordRepository.save(record);

    const changedFields = this.computeFieldChanges(beforeData, validatedData);

    await this.auditService?.createAuditLog({
      action: 'update',
      entityName: 'DynamicRecord',
      entityId: saved.id,
      resource: `dynamic_records.${tableName}`,
      resourceId: saved.recordId,
      beforeState: beforeData,
      afterState: validatedData,
      userId,
      tenantId,
      metadata: {
        tableName,
        recordId: saved.recordId,
        changedFields,
      },
    });

    return saved;
  }

  async deleteRecord(
    tenantId: string,
    userId: string,
    tableName: string,
    recordId: string,
  ): Promise<void> {
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    const record = await this.findRecordById(tenantId, tableName, recordId);

    const beforeData = { ...record.data };
    record.isDeleted = true;
    record.updatedBy = userId;
    await this.recordRepository.save(record);

    await this.auditService?.createAuditLog({
      action: 'delete',
      entityName: 'DynamicRecord',
      entityId: record.id,
      resource: `dynamic_records.${tableName}`,
      resourceId: record.recordId,
      beforeState: beforeData,
      afterState: null,
      userId,
      tenantId,
      metadata: { tableName, recordId: record.recordId },
    });
  }

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

  async listRecords(
    tenantId: string,
    tableName: string,
    filterDto: RecordFilterDto,
  ): Promise<PaginatedResponse<DynamicRecord>> {
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

    if (search) {
      qb.andWhere('record.data::text ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (filter) {
      try {
        const filterObj = JSON.parse(filter) as Record<string, unknown>;
        for (const [key, value] of Object.entries(filterObj)) {
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

  private validateAndCoerceData(
    data: Record<string, unknown>,
    fields: SysDictionary[],
    isUpdate: boolean,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const field of fields) {
      const value = data[field.fieldName];

      if (
        field.isRequired &&
        !isUpdate &&
        (value === undefined || value === null || value === '')
      ) {
        errors.push(`Field '${field.fieldName}' is required`);
        continue;
      }

      if (value === undefined || value === null) {
        if (field.defaultValue !== null && !isUpdate) {
          result[field.fieldName] = this.coerceValue(
            field.defaultValue,
            field.type,
          );
        } else if (value !== undefined) {
          result[field.fieldName] = null;
        }
        continue;
      }

      try {
        const coerced = this.coerceValue(value, field.type);
        result[field.fieldName] = coerced;

        if (
          field.maxLength !== null &&
          field.maxLength !== undefined &&
          typeof coerced === 'string' &&
          coerced.length > field.maxLength
        ) {
          errors.push(
            `Field '${field.fieldName}' exceeds max length of ${field.maxLength} (got ${coerced.length})`,
          );
        }

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

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }

    return result;
  }

  private enforceReadOnly(
    data: Record<string, unknown>,
    fields: SysDictionary[],
  ): void {
    const readOnlyViolations: string[] = [];

    for (const field of fields) {
      if (field.readOnly && data[field.fieldName] !== undefined) {
        readOnlyViolations.push(field.fieldName);
      }
    }

    if (readOnlyViolations.length > 0) {
      throw new BadRequestException(
        `Cannot update read-only field(s): ${readOnlyViolations.join(', ')}`,
      );
    }
  }

  private async validateReferenceIntegrity(
    tenantId: string,
    data: Record<string, unknown>,
    fields: SysDictionary[],
  ): Promise<void> {
    const errors: string[] = [];

    const refChecks = fields.filter(
      (f) =>
        f.type === PlatformBuilderFieldType.REFERENCE &&
        f.referenceTable &&
        data[f.fieldName] !== undefined &&
        data[f.fieldName] !== null,
    );

    for (const field of refChecks) {
      const refValue = String(data[field.fieldName]);
      const exists = await this.recordRepository.findOne({
        where: {
          tenantId,
          tableName: field.referenceTable as string,
          recordId: refValue,
          isDeleted: false,
        },
      });

      if (!exists) {
        errors.push(
          `Field '${field.fieldName}': referenced record '${refValue}' not found in table '${field.referenceTable}'`,
        );
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }
  }

  private async validateUniqueness(
    tenantId: string,
    tableName: string,
    data: Record<string, unknown>,
    fields: SysDictionary[],
    excludeRecordId?: string,
  ): Promise<void> {
    const errors: string[] = [];

    const uniqueFields = fields.filter(
      (f) =>
        f.isUnique &&
        data[f.fieldName] !== undefined &&
        data[f.fieldName] !== null,
    );

    for (const field of uniqueFields) {
      const fieldValue = String(data[field.fieldName]);
      const sanitizedFieldName = field.fieldName.replace(/[^a-z0-9_]/gi, '');

      const qb = this.recordRepository
        .createQueryBuilder('record')
        .where('record.tenantId = :tenantId', { tenantId })
        .andWhere('record.tableName = :tableName', { tableName })
        .andWhere('record.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere(`record.data->>'${sanitizedFieldName}' = :fieldValue`, {
          fieldValue,
        });

      if (excludeRecordId) {
        qb.andWhere('record.recordId != :excludeRecordId', {
          excludeRecordId,
        });
      }

      const existing = await qb.getOne();

      if (existing) {
        errors.push(
          `Field '${field.fieldName}' must be unique: value '${fieldValue}' already exists`,
        );
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }
  }

  private computeFieldChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Array<{ field: string; from: unknown; to: unknown }> {
    const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      const fromVal = before[key];
      const toVal = after[key];
      if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
        changes.push({ field: key, from: fromVal ?? null, to: toVal ?? null });
      }
    }

    return changes;
  }

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
