import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ListView,
  ListViewColumn,
  ListViewScope,
} from '../entities/list-view.entity';

/**
 * List View Service
 *
 * Manages list view configurations for tables.
 * Supports user, role, tenant, and system scoped views.
 *
 * Precedence (highest to lowest):
 * 1. User-specific view (scope=user, owner_user_id matches)
 * 2. Role-specific view (scope=role, role_id matches)
 * 3. Tenant-wide view (scope=tenant)
 * 4. System default view (scope=system)
 */
@Injectable()
export class ListViewService {
  private readonly allowedTables = new Set([
    'grc_risks',
    'grc_policies',
    'grc_requirements',
    'grc_controls',
    'grc_audits',
    'grc_issues',
    'grc_capas',
    'grc_evidence',
    'grc_processes',
    'grc_process_violations',
  ]);

  constructor(
    @InjectRepository(ListView)
    private readonly listViewRepository: Repository<ListView>,
    @InjectRepository(ListViewColumn)
    private readonly listViewColumnRepository: Repository<ListViewColumn>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private validateTableName(tableName: string): void {
    if (!this.allowedTables.has(tableName)) {
      throw new BadRequestException(
        `Invalid table name: ${tableName}. Allowed tables: ${Array.from(this.allowedTables).join(', ')}`,
      );
    }
  }

  async listByTable(
    tenantId: string,
    tableName: string,
    userId?: string,
    roleId?: string,
  ): Promise<{ views: ListView[]; defaultView: ListView | null }> {
    this.validateTableName(tableName);

    const views = await this.listViewRepository.find({
      where: { tenantId, tableName },
      order: { scope: 'ASC', name: 'ASC' },
      relations: ['columns'],
    });

    const filteredViews = views.filter((view) => {
      if (view.scope === ListViewScope.USER) {
        return view.ownerUserId === userId;
      }
      if (view.scope === ListViewScope.ROLE) {
        return view.roleId === roleId;
      }
      return true;
    });

    const defaultView = this.findDefaultView(filteredViews, userId, roleId);

    return { views: filteredViews, defaultView };
  }

  private findDefaultView(
    views: ListView[],
    userId?: string,
    roleId?: string,
  ): ListView | null {
    const userDefault = views.find(
      (v) =>
        v.scope === ListViewScope.USER &&
        v.ownerUserId === userId &&
        v.isDefault,
    );
    if (userDefault) return userDefault;

    const roleDefault = views.find(
      (v) =>
        v.scope === ListViewScope.ROLE && v.roleId === roleId && v.isDefault,
    );
    if (roleDefault) return roleDefault;

    const tenantDefault = views.find(
      (v) => v.scope === ListViewScope.TENANT && v.isDefault,
    );
    if (tenantDefault) return tenantDefault;

    const systemDefault = views.find(
      (v) => v.scope === ListViewScope.SYSTEM && v.isDefault,
    );
    if (systemDefault) return systemDefault;

    return views.length > 0 ? views[0] : null;
  }

  async getById(tenantId: string, id: string): Promise<ListView> {
    const view = await this.listViewRepository.findOne({
      where: { id, tenantId },
      relations: ['columns'],
    });

    if (!view) {
      throw new NotFoundException(`List view not found: ${id}`);
    }

    return view;
  }

  async create(
    tenantId: string,
    userId: string,
    data: {
      tableName: string;
      name: string;
      scope?: ListViewScope;
      roleId?: string;
      isDefault?: boolean;
      columns?: Array<{
        columnName: string;
        orderIndex: number;
        visible?: boolean;
        width?: number;
        pinned?: 'left' | 'right';
      }>;
    },
  ): Promise<ListView> {
    this.validateTableName(data.tableName);

    const view = this.listViewRepository.create({
      tenantId,
      tableName: data.tableName,
      name: data.name,
      scope: data.scope || ListViewScope.USER,
      ownerUserId: data.scope === ListViewScope.USER ? userId : null,
      roleId: data.scope === ListViewScope.ROLE ? data.roleId : null,
      isDefault: data.isDefault || false,
    });

    const savedView = await this.listViewRepository.save(view);

    if (data.columns && data.columns.length > 0) {
      const columns = data.columns.map((col) =>
        this.listViewColumnRepository.create({
          listViewId: savedView.id,
          columnName: col.columnName,
          orderIndex: col.orderIndex,
          visible: col.visible !== false,
          width: col.width || null,
          pinned: col.pinned || null,
        }),
      );

      await this.listViewColumnRepository.save(columns);
      savedView.columns = columns;
    }

    this.eventEmitter.emit('list-view.created', {
      tenantId,
      userId,
      viewId: savedView.id,
      tableName: data.tableName,
      scope: savedView.scope,
    });

    return savedView;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    data: {
      name?: string;
      isDefault?: boolean;
    },
  ): Promise<ListView> {
    const view = await this.getById(tenantId, id);

    this.checkEditPermission(view, userId);

    if (data.name !== undefined) {
      view.name = data.name;
    }

    if (data.isDefault !== undefined) {
      view.isDefault = data.isDefault;
    }

    const savedView = await this.listViewRepository.save(view);

    this.eventEmitter.emit('list-view.updated', {
      tenantId,
      userId,
      viewId: savedView.id,
      tableName: view.tableName,
    });

    return savedView;
  }

  async updateColumns(
    tenantId: string,
    userId: string,
    id: string,
    columns: Array<{
      columnName: string;
      orderIndex: number;
      visible?: boolean;
      width?: number;
      pinned?: 'left' | 'right';
    }>,
  ): Promise<ListView> {
    const view = await this.getById(tenantId, id);

    this.checkEditPermission(view, userId);

    await this.listViewColumnRepository.delete({ listViewId: id });

    const newColumns = columns.map((col) =>
      this.listViewColumnRepository.create({
        listViewId: id,
        columnName: col.columnName,
        orderIndex: col.orderIndex,
        visible: col.visible !== false,
        width: col.width || null,
        pinned: col.pinned || null,
      }),
    );

    await this.listViewColumnRepository.save(newColumns);

    this.eventEmitter.emit('list-view.columns-updated', {
      tenantId,
      userId,
      viewId: id,
      tableName: view.tableName,
      columnCount: columns.length,
    });

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, userId: string, id: string): Promise<void> {
    const view = await this.getById(tenantId, id);

    this.checkEditPermission(view, userId);

    await this.listViewRepository.remove(view);

    this.eventEmitter.emit('list-view.deleted', {
      tenantId,
      userId,
      viewId: id,
      tableName: view.tableName,
    });
  }

  private checkEditPermission(view: ListView, userId: string): void {
    if (view.scope === ListViewScope.USER && view.ownerUserId !== userId) {
      throw new ForbiddenException("Cannot edit another user's view");
    }

    if (view.scope === ListViewScope.SYSTEM) {
      throw new ForbiddenException('Cannot edit system views');
    }
  }
}
