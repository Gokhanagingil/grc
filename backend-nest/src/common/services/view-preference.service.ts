import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserViewPreference } from '../entities/user-view-preference.entity';
import {
  ViewPreference,
  SaveViewPreferenceDto,
  ViewPreferenceResponse,
} from '../dto/table-schema.dto';
import {
  isTableAllowed,
  getDefaultVisibleColumns,
  getTableSchema,
} from './table-schema.registry';

/**
 * View Preference Service
 *
 * Manages user view preferences for list pages.
 * Provides CRUD operations with tenant isolation.
 */
@Injectable()
export class ViewPreferenceService {
  constructor(
    @InjectRepository(UserViewPreference)
    private readonly repository: Repository<UserViewPreference>,
  ) {}

  /**
   * Get view preference for a user and table
   * Returns default preference if none exists
   */
  async getViewPreference(
    tenantId: string,
    userId: string,
    tableName: string,
  ): Promise<ViewPreferenceResponse> {
    // Validate table is allowed
    if (!isTableAllowed(tableName)) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    const preference = await this.repository.findOne({
      where: { tenantId, userId, tableName },
    });

    if (preference) {
      return {
        tableName,
        userId,
        tenantId,
        preference: preference.toViewPreference(),
        createdAt: preference.createdAt,
        updatedAt: preference.updatedAt,
      };
    }

    // Return default preference based on schema
    const defaultColumns = getDefaultVisibleColumns(tableName);
    const schema = getTableSchema(tableName);
    const defaultPreference: ViewPreference = {
      visibleColumns: defaultColumns,
      columnOrder: defaultColumns,
      sort: schema?.fields.find((f) => f.name === 'createdAt')
        ? { field: 'createdAt', direction: 'DESC' }
        : undefined,
      pageSize: 20,
    };

    return {
      tableName,
      userId,
      tenantId,
      preference: defaultPreference,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Save or update view preference for a user and table
   */
  async saveViewPreference(
    tenantId: string,
    userId: string,
    tableName: string,
    dto: SaveViewPreferenceDto,
  ): Promise<ViewPreferenceResponse> {
    // Validate table is allowed
    if (!isTableAllowed(tableName)) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    // Find existing preference or create new
    let preference = await this.repository.findOne({
      where: { tenantId, userId, tableName },
    });

    if (preference) {
      // Update existing preference
      if (dto.visibleColumns !== undefined) {
        preference.visibleColumns = dto.visibleColumns;
      }
      if (dto.columnOrder !== undefined) {
        preference.columnOrder = dto.columnOrder;
      }
      if (dto.columnWidths !== undefined) {
        preference.columnWidths = dto.columnWidths;
      }
      if (dto.sort !== undefined) {
        preference.sortField = dto.sort?.field || null;
        preference.sortDirection = dto.sort?.direction || null;
      }
      if (dto.filters !== undefined) {
        preference.filters = dto.filters as Record<string, unknown>;
      }
      if (dto.pageSize !== undefined) {
        preference.pageSize = dto.pageSize;
      }
    } else {
      // Create new preference
      const defaultColumns = getDefaultVisibleColumns(tableName);
      preference = this.repository.create({
        tenantId,
        userId,
        tableName,
        visibleColumns: dto.visibleColumns || defaultColumns,
        columnOrder: dto.columnOrder || defaultColumns,
        columnWidths: dto.columnWidths || null,
        sortField: dto.sort?.field || 'createdAt',
        sortDirection: dto.sort?.direction || 'DESC',
        filters: (dto.filters as Record<string, unknown>) || null,
        pageSize: dto.pageSize || 20,
      });
    }

    const saved = await this.repository.save(preference);

    return {
      tableName,
      userId,
      tenantId,
      preference: saved.toViewPreference(),
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * Delete view preference for a user and table
   */
  async deleteViewPreference(
    tenantId: string,
    userId: string,
    tableName: string,
  ): Promise<void> {
    await this.repository.delete({ tenantId, userId, tableName });
  }

  /**
   * Get all view preferences for a user
   */
  async getAllViewPreferences(
    tenantId: string,
    userId: string,
  ): Promise<ViewPreferenceResponse[]> {
    const preferences = await this.repository.find({
      where: { tenantId, userId },
    });

    return preferences.map((p) => ({
      tableName: p.tableName,
      userId: p.userId,
      tenantId: p.tenantId,
      preference: p.toViewPreference(),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }
}
