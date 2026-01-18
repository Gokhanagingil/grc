import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysDbObject } from '../entities/sys-db-object.entity';
import { SysDictionary } from '../entities/sys-dictionary.entity';
import { DynamicRecord } from '../entities/dynamic-record.entity';
import {
  CreateTableDto,
  UpdateTableDto,
  TableFilterDto,
  CreateFieldDto,
  UpdateFieldDto,
  FieldFilterDto,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';
import { AuditService } from '../../audit/audit.service';

/**
 * Platform Builder Service
 *
 * Manages dynamic table definitions (SysDbObject) and field definitions (SysDictionary).
 * This is the admin-facing service for the Platform Builder feature.
 */
@Injectable()
export class PlatformBuilderService {
  constructor(
    @InjectRepository(SysDbObject)
    private readonly tableRepository: Repository<SysDbObject>,
    @InjectRepository(SysDictionary)
    private readonly fieldRepository: Repository<SysDictionary>,
    @InjectRepository(DynamicRecord)
    private readonly recordRepository: Repository<DynamicRecord>,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  // ============================================================================
  // Table (SysDbObject) Methods
  // ============================================================================

  /**
   * Create a new dynamic table definition
   */
  async createTable(
    tenantId: string,
    userId: string,
    dto: CreateTableDto,
  ): Promise<SysDbObject> {
    // Validate table name pattern
    if (!/^u_[a-z0-9_]+$/.test(dto.name)) {
      throw new BadRequestException(
        'Table name must match pattern: u_[a-z0-9_]+',
      );
    }

    // Check for existing table with same name
    const existing = await this.tableRepository.findOne({
      where: { tenantId, name: dto.name, isDeleted: false },
    });

    if (existing) {
      throw new ConflictException(
        `Table with name '${dto.name}' already exists`,
      );
    }

    const table = this.tableRepository.create({
      tenantId,
      name: dto.name,
      label: dto.label,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.tableRepository.save(table);

    // Record audit log
    await this.auditService?.recordCreate(
      'SysDbObject',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  /**
   * Update an existing table definition
   */
  async updateTable(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateTableDto,
  ): Promise<SysDbObject> {
    const table = await this.findTableById(tenantId, id);

    const beforeState = { ...table };

    if (dto.label !== undefined) table.label = dto.label;
    if (dto.description !== undefined) table.description = dto.description;
    if (dto.isActive !== undefined) table.isActive = dto.isActive;
    table.updatedBy = userId;

    const saved = await this.tableRepository.save(table);

    // Record audit log
    await this.auditService?.recordUpdate(
      'SysDbObject',
      id,
      beforeState as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  /**
   * Soft delete a table definition
   */
  async deleteTable(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<void> {
    const table = await this.findTableById(tenantId, id);

    // Check if table has any records
    const recordCount = await this.recordRepository.count({
      where: { tenantId, tableName: table.name, isDeleted: false },
    });

    if (recordCount > 0) {
      throw new BadRequestException(
        `Cannot delete table '${table.name}' because it has ${recordCount} record(s). Delete all records first.`,
      );
    }

    // Soft delete all fields
    await this.fieldRepository.update(
      { tenantId, tableName: table.name, isDeleted: false },
      { isDeleted: true, updatedBy: userId },
    );

    // Soft delete the table
    table.isDeleted = true;
    table.updatedBy = userId;
    await this.tableRepository.save(table);

    // Record audit log
    await this.auditService?.recordDelete(
      'SysDbObject',
      table,
      userId,
      tenantId,
    );
  }

  /**
   * Find a table by ID
   */
  async findTableById(tenantId: string, id: string): Promise<SysDbObject> {
    const table = await this.tableRepository.findOne({
      where: { id, tenantId, isDeleted: false },
    });

    if (!table) {
      throw new NotFoundException(`Table with ID '${id}' not found`);
    }

    return table;
  }

  /**
   * Find a table by name
   */
  async findTableByName(
    tenantId: string,
    name: string,
  ): Promise<SysDbObject | null> {
    return this.tableRepository.findOne({
      where: { tenantId, name, isDeleted: false },
    });
  }

  /**
   * List tables with filtering and pagination
   */
  async listTables(
    tenantId: string,
    filterDto: TableFilterDto,
  ): Promise<
    PaginatedResponse<SysDbObject & { fieldCount: number; recordCount: number }>
  > {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search,
      isActive,
    } = filterDto;

    const qb = this.tableRepository.createQueryBuilder('table');

    qb.where('table.tenantId = :tenantId', { tenantId });
    qb.andWhere('table.isDeleted = :isDeleted', { isDeleted: false });

    if (search) {
      qb.andWhere(
        '(table.name ILIKE :search OR table.label ILIKE :search OR table.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isActive !== undefined) {
      qb.andWhere('table.isActive = :isActive', { isActive });
    }

    const total = await qb.getCount();

    const validSortBy = [
      'name',
      'label',
      'createdAt',
      'updatedAt',
      'isActive',
    ].includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`table.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const tables = await qb.getMany();

    // Get field and record counts for each table
    const tablesWithCounts = await Promise.all(
      tables.map(async (table) => {
        const [fieldCount, recordCount] = await Promise.all([
          this.fieldRepository.count({
            where: { tenantId, tableName: table.name, isDeleted: false },
          }),
          this.recordRepository.count({
            where: { tenantId, tableName: table.name, isDeleted: false },
          }),
        ]);
        return { ...table, fieldCount, recordCount };
      }),
    );

    return createPaginatedResponse(tablesWithCounts, total, page, pageSize);
  }

  /**
   * Get a single table with field and record counts
   */
  async getTableWithCounts(
    tenantId: string,
    id: string,
  ): Promise<SysDbObject & { fieldCount: number; recordCount: number }> {
    const table = await this.findTableById(tenantId, id);

    const [fieldCount, recordCount] = await Promise.all([
      this.fieldRepository.count({
        where: { tenantId, tableName: table.name, isDeleted: false },
      }),
      this.recordRepository.count({
        where: { tenantId, tableName: table.name, isDeleted: false },
      }),
    ]);

    return { ...table, fieldCount, recordCount };
  }

  // ============================================================================
  // Field (SysDictionary) Methods
  // ============================================================================

  /**
   * Create a new field definition
   */
  async createField(
    tenantId: string,
    userId: string,
    tableId: string,
    dto: CreateFieldDto,
  ): Promise<SysDictionary> {
    // Validate field name pattern
    if (!/^[a-z][a-z0-9_]*$/.test(dto.fieldName)) {
      throw new BadRequestException(
        'Field name must match pattern: [a-z][a-z0-9_]*',
      );
    }

    // Get the table
    const table = await this.findTableById(tenantId, tableId);

    // Check for existing field with same name
    const existing = await this.fieldRepository.findOne({
      where: {
        tenantId,
        tableName: table.name,
        fieldName: dto.fieldName,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Field '${dto.fieldName}' already exists in table '${table.name}'`,
      );
    }

    // Get the next field order if not provided
    let fieldOrder = dto.fieldOrder;
    if (fieldOrder === undefined) {
      const maxOrderResult = await this.fieldRepository
        .createQueryBuilder('field')
        .select('MAX(field.fieldOrder)', 'max')
        .where('field.tenantId = :tenantId', { tenantId })
        .andWhere('field.tableName = :tableName', { tableName: table.name })
        .andWhere('field.isDeleted = :isDeleted', { isDeleted: false })
        .getRawOne<{ max: number | null }>();
      fieldOrder = ((maxOrderResult?.max as number | null) ?? -1) + 1;
    }

    const field = this.fieldRepository.create({
      tenantId,
      tableName: table.name,
      fieldName: dto.fieldName,
      label: dto.label,
      type: dto.type,
      isRequired: dto.isRequired ?? false,
      isUnique: dto.isUnique ?? false,
      referenceTable: dto.referenceTable ?? null,
      choiceOptions: dto.choiceOptions ?? null,
      defaultValue: dto.defaultValue ?? null,
      fieldOrder,
      isActive: dto.isActive ?? true,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.fieldRepository.save(field);

    // Record audit log
    await this.auditService?.recordCreate(
      'SysDictionary',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  /**
   * Update an existing field definition
   */
  async updateField(
    tenantId: string,
    userId: string,
    fieldId: string,
    dto: UpdateFieldDto,
  ): Promise<SysDictionary> {
    const field = await this.findFieldById(tenantId, fieldId);

    const beforeState = { ...field };

    if (dto.label !== undefined) field.label = dto.label;
    if (dto.type !== undefined) field.type = dto.type;
    if (dto.isRequired !== undefined) field.isRequired = dto.isRequired;
    if (dto.isUnique !== undefined) field.isUnique = dto.isUnique;
    if (dto.referenceTable !== undefined)
      field.referenceTable = dto.referenceTable;
    if (dto.choiceOptions !== undefined)
      field.choiceOptions = dto.choiceOptions;
    if (dto.defaultValue !== undefined) field.defaultValue = dto.defaultValue;
    if (dto.fieldOrder !== undefined) field.fieldOrder = dto.fieldOrder;
    if (dto.isActive !== undefined) field.isActive = dto.isActive;
    field.updatedBy = userId;

    const saved = await this.fieldRepository.save(field);

    // Record audit log
    await this.auditService?.recordUpdate(
      'SysDictionary',
      fieldId,
      beforeState as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  /**
   * Soft delete a field definition
   */
  async deleteField(
    tenantId: string,
    userId: string,
    fieldId: string,
  ): Promise<void> {
    const field = await this.findFieldById(tenantId, fieldId);

    field.isDeleted = true;
    field.updatedBy = userId;
    await this.fieldRepository.save(field);

    // Record audit log
    await this.auditService?.recordDelete(
      'SysDictionary',
      field,
      userId,
      tenantId,
    );
  }

  /**
   * Find a field by ID
   */
  async findFieldById(
    tenantId: string,
    fieldId: string,
  ): Promise<SysDictionary> {
    const field = await this.fieldRepository.findOne({
      where: { id: fieldId, tenantId, isDeleted: false },
    });

    if (!field) {
      throw new NotFoundException(`Field with ID '${fieldId}' not found`);
    }

    return field;
  }

  /**
   * List fields for a table with filtering and pagination
   */
  async listFields(
    tenantId: string,
    tableId: string,
    filterDto: FieldFilterDto,
  ): Promise<PaginatedResponse<SysDictionary>> {
    const table = await this.findTableById(tenantId, tableId);

    const {
      page = 1,
      pageSize = 100,
      sortBy = 'fieldOrder',
      sortOrder = 'ASC',
      search,
      isActive,
      type,
    } = filterDto;

    const qb = this.fieldRepository.createQueryBuilder('field');

    qb.where('field.tenantId = :tenantId', { tenantId });
    qb.andWhere('field.tableName = :tableName', { tableName: table.name });
    qb.andWhere('field.isDeleted = :isDeleted', { isDeleted: false });

    if (search) {
      qb.andWhere(
        '(field.fieldName ILIKE :search OR field.label ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isActive !== undefined) {
      qb.andWhere('field.isActive = :isActive', { isActive });
    }

    if (type) {
      qb.andWhere('field.type = :type', { type });
    }

    const total = await qb.getCount();

    const validSortBy = [
      'fieldName',
      'label',
      'type',
      'fieldOrder',
      'createdAt',
    ].includes(sortBy)
      ? sortBy
      : 'fieldOrder';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`field.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const fields = await qb.getMany();

    return createPaginatedResponse(fields, total, page, pageSize);
  }

  /**
   * Get all active fields for a table (for validation and form generation)
   */
  async getActiveFieldsForTable(
    tenantId: string,
    tableName: string,
  ): Promise<SysDictionary[]> {
    return this.fieldRepository.find({
      where: {
        tenantId,
        tableName,
        isActive: true,
        isDeleted: false,
      },
      order: { fieldOrder: 'ASC' },
    });
  }

  /**
   * Validate that a table exists and is active
   */
  async validateTableExists(
    tenantId: string,
    tableName: string,
  ): Promise<SysDbObject> {
    const table = await this.tableRepository.findOne({
      where: { tenantId, name: tableName, isDeleted: false },
    });

    if (!table) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    if (!table.isActive) {
      throw new BadRequestException(`Table '${tableName}' is not active`);
    }

    return table;
  }
}
