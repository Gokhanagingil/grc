import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { RequestWithUser } from '../../common/types';

/**
 * UI Policies Controller (Stub)
 *
 * Provides minimal stub endpoints for UI policy management.
 * Returns safe defaults to prevent 404 errors on staging.
 *
 * Security:
 * - All routes require JWT authentication (JwtAuthGuard)
 * - All routes require valid tenant access (TenantGuard validates x-tenant-id header)
 * - Write operations require ADMIN_SETTINGS_WRITE permission
 */
@Controller('platform/ui-policies')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UiPoliciesController {
  /**
   * Get all UI policies
   * Returns empty list (no policies configured)
   */
  @Get()
  getAll() {
    return {
      policies: [],
    };
  }

  /**
   * Get available tables for UI policies
   * Returns list of GRC tables
   */
  @Get('tables')
  getTables() {
    return {
      tables: [
        'risks',
        'controls',
        'policies',
        'requirements',
        'audits',
        'incidents',
      ],
    };
  }

  /**
   * Get UI policies for a specific table
   * Returns empty list (no policies configured)
   */
  @Get('table/:tableName')
  getForTable(@Param('tableName') tableName: string) {
    return {
      tableName,
      policies: [],
    };
  }

  /**
   * Get UI policy by ID
   * Returns a stub policy
   */
  @Get(':id')
  getById(@Param('id') id: string) {
    return {
      policy: {
        id: parseInt(id, 10),
        name: 'Default Policy',
        table_name: 'default',
        condition: { always: true },
        actions: [],
        priority: 0,
        is_active: true,
      },
    };
  }

  /**
   * Create a UI policy (stub - returns success with mock data)
   * Requires ADMIN_SETTINGS_WRITE permission
   */
  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  create(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      name: string;
      table_name: string;
      condition: Record<string, unknown>;
      actions: unknown[];
      priority: number;
    },
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return {
      message: 'UI policy created',
      policy: {
        id: 1,
        name: body.name,
        table_name: body.table_name,
        condition: body.condition,
        actions: body.actions,
        priority: body.priority,
        is_active: true,
        tenantId,
      },
    };
  }

  /**
   * Update a UI policy (stub - returns success)
   * Requires ADMIN_SETTINGS_WRITE permission
   */
  @Put(':id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  update(
    @Param('id') id: string,
    @Body() updates: Record<string, unknown>,
    @Request() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return {
      message: 'UI policy updated',
      id: parseInt(id, 10),
      tenantId,
      ...updates,
    };
  }

  /**
   * Delete a UI policy (stub - returns success)
   * Requires ADMIN_SETTINGS_WRITE permission
   */
  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  delete(@Param('id') id: string, @Request() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return {
      message: 'UI policy deleted',
      id: parseInt(id, 10),
      tenantId,
    };
  }

  /**
   * Evaluate UI policies for a table
   * This is the key endpoint called by the frontend
   * Returns no-op actions (no fields hidden/readonly/etc)
   */
  @Post('evaluate')
  evaluate(
    @Body()
    body: {
      tableName: string;
      formData?: Record<string, unknown>;
    },
  ) {
    return {
      tableName: body.tableName,
      actions: {
        hiddenFields: [],
        shownFields: [],
        readonlyFields: [],
        editableFields: [],
        mandatoryFields: [],
        optionalFields: [],
        disabledFields: [],
      },
    };
  }

  /**
   * Test a UI policy condition (stub - always returns true)
   */
  @Post('test')
  test(
    @Body()
    body: {
      condition: Record<string, unknown>;
      formData?: Record<string, unknown>;
    },
  ) {
    return {
      condition: body.condition,
      formData: body.formData || {},
      result: true,
      message: 'Condition evaluated successfully (stub)',
    };
  }
}
