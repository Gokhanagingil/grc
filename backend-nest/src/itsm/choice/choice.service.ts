import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysChoice } from './sys-choice.entity';

export interface ChoiceValidationError {
  error: 'INVALID_CHOICE';
  field: string;
  value: string;
  table: string;
  message: string;
}

export interface ChoiceFieldMapping {
  tableName: string;
  fieldName: string;
}

const CHOICE_MANAGED_FIELDS: Record<string, string[]> = {
  itsm_incidents: [
    'category',
    'impact',
    'urgency',
    'status',
    'source',
    'priority',
  ],
  itsm_changes: ['type', 'state', 'risk'],
  itsm_services: ['criticality', 'status'],
};

@Injectable()
export class ChoiceService {
  constructor(
    @InjectRepository(SysChoice)
    private readonly repository: Repository<SysChoice>,
  ) {}

  async getChoices(
    tenantId: string,
    tableName: string,
    fieldName: string,
  ): Promise<SysChoice[]> {
    return this.repository.find({
      where: {
        tenantId,
        tableName,
        fieldName,
        isActive: true,
        isDeleted: false,
      },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  async getAllChoicesForTable(
    tenantId: string,
    tableName: string,
  ): Promise<Record<string, SysChoice[]>> {
    const choices = await this.repository.find({
      where: {
        tenantId,
        tableName,
        isActive: true,
        isDeleted: false,
      },
      order: { fieldName: 'ASC', sortOrder: 'ASC', label: 'ASC' },
    });

    const grouped: Record<string, SysChoice[]> = {};
    for (const choice of choices) {
      if (!grouped[choice.fieldName]) {
        grouped[choice.fieldName] = [];
      }
      grouped[choice.fieldName].push(choice);
    }
    return grouped;
  }

  async validateChoice(
    tenantId: string,
    tableName: string,
    fieldName: string,
    value: string,
  ): Promise<boolean> {
    const count = await this.repository.count({
      where: {
        tenantId,
        tableName,
        fieldName,
        value,
        isActive: true,
        isDeleted: false,
      },
    });
    return count > 0;
  }

  async validateChoiceFields(
    tenantId: string,
    tableName: string,
    data: Record<string, unknown>,
  ): Promise<ChoiceValidationError[]> {
    const managedFields = CHOICE_MANAGED_FIELDS[tableName];
    if (!managedFields) {
      return [];
    }

    const errors: ChoiceValidationError[] = [];

    for (const field of managedFields) {
      const raw = data[field];
      if (raw === undefined || raw === null) {
        continue;
      }

      const strValue = typeof raw === 'string' ? raw : JSON.stringify(raw);

      const totalForField = await this.repository.count({
        where: {
          tenantId,
          tableName,
          fieldName: field,
          isDeleted: false,
        },
      });

      if (totalForField === 0) {
        continue;
      }

      const isValid = await this.validateChoice(
        tenantId,
        tableName,
        field,
        strValue,
      );

      if (!isValid) {
        errors.push({
          error: 'INVALID_CHOICE',
          field,
          value: strValue,
          table: tableName,
          message: `Invalid value '${strValue}' for choice field '${field}' on table '${tableName}'`,
        });
      }
    }

    return errors;
  }

  throwIfInvalidChoices(errors: ChoiceValidationError[]): void {
    if (errors.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_CHOICE',
        message: 'One or more choice field values are invalid',
        details: errors,
      });
    }
  }

  async findById(tenantId: string, id: string): Promise<SysChoice | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async createChoice(
    tenantId: string,
    userId: string,
    data: Partial<SysChoice>,
  ): Promise<SysChoice> {
    const entity = this.repository.create({
      ...data,
      tenantId,
      createdBy: userId,
      isDeleted: false,
    });
    return this.repository.save(entity);
  }

  async updateChoice(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<
      Pick<
        SysChoice,
        'label' | 'sortOrder' | 'isActive' | 'parentValue' | 'metadata'
      >
    >,
  ): Promise<SysChoice | null> {
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      return null;
    }
    const updated = this.repository.merge(existing, {
      ...data,
      updatedBy: userId,
    });
    return this.repository.save(updated);
  }

  async deactivateChoice(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      return false;
    }
    await this.repository.save(
      this.repository.merge(existing, {
        isActive: false,
        updatedBy: userId,
      }),
    );
    return true;
  }

  isChoiceManagedTable(tableName: string): boolean {
    return tableName in CHOICE_MANAGED_FIELDS;
  }

  getChoiceManagedFields(tableName: string): string[] {
    return CHOICE_MANAGED_FIELDS[tableName] || [];
  }
}
