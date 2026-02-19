import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { DynamicRecord } from '../entities/dynamic-record.entity';
import { SysDictionary } from '../entities/sys-dictionary.entity';
import { PlatformBuilderService } from './platform-builder.service';
import {
  FilterGroupDto,
  FilterConditionDto,
  GenericQueryDto,
  GenericQueryResult,
  GenericFilterOperator,
} from '../dto/generic-query.dto';
import { LogicalOperator, PlatformBuilderFieldType } from '../enums';

type RefJoin = {
  alias: string;
  tableName: string;
  fieldByName: Map<string, SysDictionary>;
};

@Injectable()
export class GenericQueryService {
  constructor(
    @InjectRepository(DynamicRecord)
    private readonly recordRepository: Repository<DynamicRecord>,
    private readonly platformBuilderService: PlatformBuilderService,
  ) {}

  async query(
    tenantId: string,
    tableName: string,
    dto: GenericQueryDto,
  ): Promise<GenericQueryResult> {
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    const fields = await this.platformBuilderService.getActiveFieldsForTable(
      tenantId,
      tableName,
    );

    const mainFieldByName = new Map(fields.map((f) => [f.fieldName, f]));
    const mainFieldNameSet = new Set(fields.map((f) => f.fieldName));

    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const qb = this.recordRepository.createQueryBuilder('r');
    qb.where('r.tenantId = :tenantId', { tenantId });
    qb.andWhere('r.tableName = :tableName', { tableName });
    qb.andWhere('r.isDeleted = :isDeleted', { isDeleted: false });

    if (dto.q) {
      qb.andWhere('r.data::text ILIKE :q', { q: `%${dto.q}%` });
    }

    const joinsByRefField = new Map<string, RefJoin>();

    if (dto.filter) {
      const filterTree = this.parseFilter(dto.filter);
      const paramIndex = { value: 0 };
      const whereClause = await this.buildFilterGroup(
        qb,
        tenantId,
        filterTree,
        mainFieldByName,
        mainFieldNameSet,
        joinsByRefField,
        paramIndex,
      );
      if (whereClause) {
        qb.andWhere(whereClause);
      }
    }

    const total = await qb.getCount();

    this.applySorting(qb, dto.sort, mainFieldNameSet);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const records = await qb.getMany();

    const items = records.map((rec) => ({
      _id: rec.id,
      _recordId: rec.recordId,
      _createdAt: rec.createdAt,
      _updatedAt: rec.updatedAt,
      _createdBy: rec.createdBy,
      _updatedBy: rec.updatedBy,
      ...rec.data,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async count(
    tenantId: string,
    tableName: string,
    dto: GenericQueryDto,
  ): Promise<{ count: number }> {
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    const fields = await this.platformBuilderService.getActiveFieldsForTable(
      tenantId,
      tableName,
    );

    const mainFieldByName = new Map(fields.map((f) => [f.fieldName, f]));
    const mainFieldNameSet = new Set(fields.map((f) => f.fieldName));

    const qb = this.recordRepository.createQueryBuilder('r');
    qb.where('r.tenantId = :tenantId', { tenantId });
    qb.andWhere('r.tableName = :tableName', { tableName });
    qb.andWhere('r.isDeleted = :isDeleted', { isDeleted: false });

    if (dto.q) {
      qb.andWhere('r.data::text ILIKE :q', { q: `%${dto.q}%` });
    }

    const joinsByRefField = new Map<string, RefJoin>();

    if (dto.filter) {
      const filterTree = this.parseFilter(dto.filter);
      const paramIndex = { value: 0 };
      const whereClause = await this.buildFilterGroup(
        qb,
        tenantId,
        filterTree,
        mainFieldByName,
        mainFieldNameSet,
        joinsByRefField,
        paramIndex,
      );
      if (whereClause) {
        qb.andWhere(whereClause);
      }
    }

    const count = await qb.getCount();
    return { count };
  }

  async dotWalk(
    tenantId: string,
    tableName: string,
    recordId: string,
    refField: string,
    targetFields?: string[],
  ): Promise<Record<string, unknown> | null> {
    await this.platformBuilderService.validateTableExists(tenantId, tableName);

    const fields = await this.platformBuilderService.getActiveFieldsForTable(
      tenantId,
      tableName,
    );
    const refFieldDef = fields.find(
      (f) =>
        f.fieldName === refField &&
        f.type === PlatformBuilderFieldType.REFERENCE,
    );

    if (!refFieldDef) {
      throw new BadRequestException(
        `Field '${refField}' is not a reference field on table '${tableName}'`,
      );
    }

    const sourceRecord = await this.recordRepository.findOne({
      where: { tenantId, tableName, recordId, isDeleted: false },
    });

    if (!sourceRecord) {
      return null;
    }

    const refRecordId = sourceRecord.data[refField];
    if (!refRecordId || typeof refRecordId !== 'string') {
      return null;
    }

    const targetTableName = refFieldDef.referenceTable;
    if (!targetTableName) {
      throw new BadRequestException(
        `Reference field '${refField}' has no referenceTable configured`,
      );
    }

    const targetRecord = await this.recordRepository.findOne({
      where: {
        tenantId,
        tableName: targetTableName,
        recordId: refRecordId,
        isDeleted: false,
      },
    });

    if (!targetRecord) {
      return null;
    }

    if (targetFields && targetFields.length > 0) {
      const result: Record<string, unknown> = {
        _recordId: targetRecord.recordId,
      };
      for (const tf of targetFields) {
        if (!this.isValidFieldName(tf)) continue;
        result[tf] = targetRecord.data[tf] ?? null;
      }
      return result;
    }

    return {
      _recordId: targetRecord.recordId,
      ...targetRecord.data,
    };
  }

  private parseFilter(filter: string): FilterGroupDto {
    try {
      return JSON.parse(filter) as FilterGroupDto;
    } catch {
      throw new BadRequestException(
        'Invalid filter format. Expected JSON filter tree.',
      );
    }
  }

  private async buildFilterGroup(
    qb: SelectQueryBuilder<DynamicRecord>,
    tenantId: string,
    group: FilterGroupDto,
    mainFieldByName: Map<string, SysDictionary>,
    mainFieldNameSet: Set<string>,
    joinsByRefField: Map<string, RefJoin>,
    paramIndex: { value: number },
  ): Promise<string> {
    const logic = group.logic ?? LogicalOperator.AND;
    const parts: string[] = [];

    if (group.conditions) {
      for (const cond of group.conditions) {
        const clause = await this.buildFilterCondition(
          qb,
          tenantId,
          cond,
          mainFieldByName,
          mainFieldNameSet,
          joinsByRefField,
          paramIndex,
        );
        if (clause) {
          parts.push(clause);
        }
      }
    }

    if (group.groups) {
      for (const sub of group.groups) {
        const subClause = await this.buildFilterGroup(
          qb,
          tenantId,
          sub,
          mainFieldByName,
          mainFieldNameSet,
          joinsByRefField,
          paramIndex,
        );
        if (subClause) {
          parts.push(`(${subClause})`);
        }
      }
    }

    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];

    const joiner = logic === LogicalOperator.OR ? ' OR ' : ' AND ';
    return parts.join(joiner);
  }

  private async buildFilterCondition(
    qb: SelectQueryBuilder<DynamicRecord>,
    tenantId: string,
    cond: FilterConditionDto,
    mainFieldByName: Map<string, SysDictionary>,
    mainFieldNameSet: Set<string>,
    joinsByRefField: Map<string, RefJoin>,
    paramIndex: { value: number },
  ): Promise<string> {
    const field = cond.field;

    const { jsonPath, fieldType } = await this.resolveFieldJsonPath(
      qb,
      tenantId,
      field,
      mainFieldByName,
      mainFieldNameSet,
      joinsByRefField,
    );

    const idx = paramIndex.value++;

    const isEmptyExpr = `(${jsonPath} IS NULL OR ${jsonPath} = '')`;

    switch (cond.operator) {
      case GenericFilterOperator.IS_EMPTY:
        return isEmptyExpr;

      case GenericFilterOperator.EQUALS: {
        const p = `fv_${idx}`;
        qb.setParameter(p, this.coerceParam(fieldType, cond.value));
        return `${this.getComparableExpr(fieldType, jsonPath)} = :${p}`;
      }

      case GenericFilterOperator.NOT_EQUALS: {
        const p = `fv_${idx}`;
        qb.setParameter(p, this.coerceParam(fieldType, cond.value));
        return `(${jsonPath} IS NULL OR ${this.getComparableExpr(fieldType, jsonPath)} != :${p})`;
      }

      case GenericFilterOperator.CONTAINS: {
        const p = `fv_${idx}`;
        const cv = cond.value == null ? '' : String(cond.value as string);
        qb.setParameter(p, `%${cv}%`);
        return `${jsonPath} ILIKE :${p}`;
      }

      case GenericFilterOperator.STARTS_WITH: {
        const p = `fv_${idx}`;
        const sv = cond.value == null ? '' : String(cond.value as string);
        qb.setParameter(p, `${sv}%`);
        return `${jsonPath} ILIKE :${p}`;
      }

      case GenericFilterOperator.IN: {
        if (!Array.isArray(cond.value)) {
          throw new BadRequestException(
            `Operator 'in' requires an array value for field '${field}'`,
          );
        }
        const p = `fv_${idx}`;
        qb.setParameter(
          p,
          (cond.value as unknown[]).map((v) => this.coerceParam(fieldType, v)),
        );
        return `${this.getComparableExpr(fieldType, jsonPath)} IN (:...${p})`;
      }

      case GenericFilterOperator.GT:
      case GenericFilterOperator.AFTER: {
        const p = `fv_${idx}`;
        qb.setParameter(p, this.coerceParam(fieldType, cond.value));
        return `${this.getComparableExpr(fieldType, jsonPath)} > :${p}`;
      }

      case GenericFilterOperator.GTE: {
        const p = `fv_${idx}`;
        qb.setParameter(p, this.coerceParam(fieldType, cond.value));
        return `${this.getComparableExpr(fieldType, jsonPath)} >= :${p}`;
      }

      case GenericFilterOperator.LT:
      case GenericFilterOperator.BEFORE: {
        const p = `fv_${idx}`;
        qb.setParameter(p, this.coerceParam(fieldType, cond.value));
        return `${this.getComparableExpr(fieldType, jsonPath)} < :${p}`;
      }

      case GenericFilterOperator.LTE: {
        const p = `fv_${idx}`;
        qb.setParameter(p, this.coerceParam(fieldType, cond.value));
        return `${this.getComparableExpr(fieldType, jsonPath)} <= :${p}`;
      }

      default:
        throw new BadRequestException(
          `Unsupported operator: '${String(cond.operator)}'`,
        );
    }
  }

  private async resolveFieldJsonPath(
    qb: SelectQueryBuilder<DynamicRecord>,
    tenantId: string,
    field: string,
    mainFieldByName: Map<string, SysDictionary>,
    mainFieldNameSet: Set<string>,
    joinsByRefField: Map<string, RefJoin>,
  ): Promise<{ jsonPath: string; fieldType: PlatformBuilderFieldType }> {
    if (field.includes('.')) {
      const parts = field.split('.');
      if (parts.length !== 2) {
        throw new BadRequestException(`Invalid dot-walk field: '${field}'`);
      }

      const [refField, targetField] = parts;

      if (
        !this.isValidFieldName(refField) ||
        !this.isValidFieldName(targetField)
      ) {
        throw new BadRequestException(`Invalid field name: '${field}'`);
      }

      const refFieldDef = mainFieldByName.get(refField);
      if (!refFieldDef) {
        throw new BadRequestException(
          `Field '${refField}' does not exist in this table's dictionary`,
        );
      }

      if (refFieldDef.type !== PlatformBuilderFieldType.REFERENCE) {
        throw new BadRequestException(
          `Field '${refField}' is not a reference field and cannot be dot-walked`,
        );
      }

      const refTableName = refFieldDef.referenceTable;
      if (!refTableName) {
        throw new BadRequestException(
          `Reference field '${refField}' has no referenceTable configured`,
        );
      }

      let join = joinsByRefField.get(refField);
      if (!join) {
        const refFields =
          await this.platformBuilderService.getActiveFieldsForTable(
            tenantId,
            refTableName,
          );
        const refFieldByName = new Map(refFields.map((f) => [f.fieldName, f]));

        const alias = `ref_${joinsByRefField.size + 1}`;
        const refTableParam = `refTable_${alias}`;

        qb.leftJoin(
          DynamicRecord,
          alias,
          `${alias}.tenant_id = :tenantId AND ${alias}.table_name = :${refTableParam} AND ${alias}.record_id::text = r.data->>'${refField}' AND ${alias}.is_deleted = false`,
          { [refTableParam]: refTableName },
        );

        join = { alias, tableName: refTableName, fieldByName: refFieldByName };
        joinsByRefField.set(refField, join);
      }

      const targetFieldDef = join.fieldByName.get(targetField);
      if (!targetFieldDef) {
        throw new BadRequestException(
          `Field '${targetField}' does not exist in table '${join.tableName}'`,
        );
      }

      return {
        jsonPath: `${join.alias}.data->>'${targetField}'`,
        fieldType: targetFieldDef.type,
      };
    }

    if (!this.isValidFieldName(field)) {
      throw new BadRequestException(`Invalid field name: '${field}'`);
    }

    if (!mainFieldNameSet.has(field)) {
      throw new BadRequestException(
        `Field '${field}' does not exist in this table's dictionary`,
      );
    }

    const fieldDef = mainFieldByName.get(field);
    if (!fieldDef) {
      throw new BadRequestException(
        `Field '${field}' does not exist in this table's dictionary`,
      );
    }

    return { jsonPath: `r.data->>'${field}'`, fieldType: fieldDef.type };
  }

  private isValidFieldName(fieldName: string): boolean {
    return /^[a-z][a-z0-9_]*$/.test(fieldName);
  }

  private coerceParam(type: PlatformBuilderFieldType, value: unknown): unknown {
    if (value === undefined) return null;

    switch (type) {
      case PlatformBuilderFieldType.INTEGER: {
        const n =
          typeof value === 'number'
            ? value
            : parseInt(String(value as string), 10);
        if (!Number.isFinite(n)) {
          throw new BadRequestException('Invalid integer value');
        }
        return Math.trunc(n);
      }

      case PlatformBuilderFieldType.DECIMAL: {
        const n =
          typeof value === 'number'
            ? value
            : parseFloat(String(value as string));
        if (!Number.isFinite(n)) {
          throw new BadRequestException('Invalid decimal value');
        }
        return n;
      }

      case PlatformBuilderFieldType.BOOLEAN: {
        if (typeof value === 'boolean') return value;
        const s = String(value as string).toLowerCase();
        if (s === 'true' || s === '1') return true;
        if (s === 'false' || s === '0') return false;
        throw new BadRequestException('Invalid boolean value');
      }

      case PlatformBuilderFieldType.DATE:
      case PlatformBuilderFieldType.DATETIME:
        return String(value as string);

      default:
        return String(value as string);
    }
  }

  private getComparableExpr(
    type: PlatformBuilderFieldType,
    jsonPath: string,
  ): string {
    switch (type) {
      case PlatformBuilderFieldType.INTEGER:
        return `NULLIF(${jsonPath}, '')::int`;
      case PlatformBuilderFieldType.DECIMAL:
        return `NULLIF(${jsonPath}, '')::numeric`;
      case PlatformBuilderFieldType.DATE:
        return `NULLIF(${jsonPath}, '')::date`;
      case PlatformBuilderFieldType.DATETIME:
        return `NULLIF(${jsonPath}, '')::timestamptz`;
      case PlatformBuilderFieldType.BOOLEAN:
        return `NULLIF(${jsonPath}, '')::boolean`;
      default:
        return jsonPath;
    }
  }

  private applySorting(
    qb: SelectQueryBuilder<DynamicRecord>,
    sort: string | undefined,
    fieldNameSet: Set<string>,
  ): void {
    if (!sort) {
      qb.orderBy('r.createdAt', 'DESC');
      return;
    }

    const parts = sort.split(',');
    let isFirst = true;

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const [rawField, rawDir] = trimmed.split(':');
      const direction = rawDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const systemFields: Record<string, string> = {
        createdAt: 'r.createdAt',
        updatedAt: 'r.updatedAt',
        recordId: 'r.recordId',
      };

      let orderExpr: string;
      if (systemFields[rawField]) {
        orderExpr = systemFields[rawField];
      } else {
        if (!this.isValidFieldName(rawField) || !fieldNameSet.has(rawField)) {
          continue;
        }
        orderExpr = `r.data->>'${rawField}'`;
      }

      if (isFirst) {
        qb.orderBy(orderExpr, direction);
        isFirst = false;
      } else {
        qb.addOrderBy(orderExpr, direction);
      }
    }

    if (isFirst) {
      qb.orderBy('r.createdAt', 'DESC');
    }
  }
}
