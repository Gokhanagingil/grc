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
 * Form Layouts Controller (Stub)
 *
 * Provides minimal stub endpoints for form layout management.
 * Returns safe defaults to prevent 404 errors on staging.
 *
 * Security:
 * - All routes require JWT authentication (JwtAuthGuard)
 * - All routes require valid tenant access (TenantGuard validates x-tenant-id header)
 * - Write operations require ADMIN_SETTINGS_WRITE permission
 */
@Controller('platform/form-layouts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FormLayoutsController {
  /**
   * Get all form layouts
   * Returns empty list (no custom layouts configured)
   */
  @Get()
  getAll() {
    return {
      layouts: [],
    };
  }

  /**
   * Get available tables for form layouts
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
   * Get form layouts for a specific table
   * Returns empty list (no custom layouts)
   */
  @Get('table/:tableName')
  getForTable(@Param('tableName') tableName: string) {
    return {
      tableName,
      layouts: [],
    };
  }

  /**
   * Resolve form layout for a table (returns default layout)
   * This is the key endpoint called by the frontend
   */
  @Get('resolve/:tableName')
  resolve(@Param('tableName') tableName: string) {
    return {
      tableName,
      role: 'default',
      layout: this.getDefaultLayout(tableName),
      isDefault: true,
    };
  }

  /**
   * Get default form layout for a table
   */
  @Get('default/:tableName')
  getDefault(@Param('tableName') tableName: string) {
    return {
      tableName,
      layout: this.getDefaultLayout(tableName),
    };
  }

  /**
   * Create a form layout (stub - returns success with mock data)
   * Requires ADMIN_SETTINGS_WRITE permission
   */
  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  create(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      table_name: string;
      role: string;
      layout_json: {
        sections: unknown[];
        hiddenFields: string[];
        readonlyFields: string[];
      };
    },
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return {
      message: 'Form layout created',
      layout: {
        id: 1,
        table_name: body.table_name,
        role: body.role,
        layout_json: body.layout_json,
        is_active: true,
        tenantId,
      },
    };
  }

  /**
   * Update a form layout (stub - returns success)
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
      message: 'Form layout updated',
      id: parseInt(id, 10),
      tenantId,
      ...updates,
    };
  }

  /**
   * Delete a form layout (stub - returns success)
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
      message: 'Form layout deleted',
      id: parseInt(id, 10),
      tenantId,
    };
  }

  /**
   * Apply form layout to data (stub - returns data as-is)
   */
  @Post('apply')
  apply(
    @Body()
    body: {
      tableName: string;
      formData: Record<string, unknown>;
      mode?: 'view' | 'edit';
    },
  ) {
    return {
      sections: [],
      hiddenFields: [],
      readonlyFields: [],
      data: body.formData,
    };
  }

  /**
   * Generate default layout based on table name
   */
  private getDefaultLayout(tableName: string): {
    sections: { title: string; fields: string[] }[];
    hiddenFields: string[];
    readonlyFields: string[];
  } {
    const tableLayouts: Record<
      string,
      {
        sections: { title: string; fields: string[] }[];
        hiddenFields: string[];
        readonlyFields: string[];
      }
    > = {
      risks: {
        sections: [
          {
            title: 'Basic Information',
            fields: ['name', 'description', 'category'],
          },
          { title: 'Assessment', fields: ['severity', 'likelihood', 'score'] },
          { title: 'Status', fields: ['status', 'owner'] },
        ],
        hiddenFields: [],
        readonlyFields: ['score'],
      },
      audits: {
        sections: [
          {
            title: 'Audit Details',
            fields: ['name', 'description', 'auditType'],
          },
          { title: 'Schedule', fields: ['plannedStartDate', 'plannedEndDate'] },
          { title: 'Status', fields: ['status', 'riskLevel'] },
        ],
        hiddenFields: [],
        readonlyFields: [],
      },
      controls: {
        sections: [
          {
            title: 'Control Information',
            fields: ['name', 'description', 'type'],
          },
          {
            title: 'Implementation',
            fields: ['implementationType', 'status', 'frequency'],
          },
        ],
        hiddenFields: [],
        readonlyFields: [],
      },
      policies: {
        sections: [
          { title: 'Policy Details', fields: ['name', 'code', 'description'] },
          {
            title: 'Lifecycle',
            fields: ['status', 'version', 'effectiveDate', 'reviewDate'],
          },
        ],
        hiddenFields: [],
        readonlyFields: ['version'],
      },
      requirements: {
        sections: [
          {
            title: 'Requirement Details',
            fields: ['title', 'referenceCode', 'framework'],
          },
          { title: 'Status', fields: ['status', 'description'] },
        ],
        hiddenFields: [],
        readonlyFields: [],
      },
      incidents: {
        sections: [
          {
            title: 'Incident Details',
            fields: ['title', 'description', 'category'],
          },
          { title: 'Priority', fields: ['priority', 'status', 'assignee'] },
        ],
        hiddenFields: [],
        readonlyFields: [],
      },
    };

    return (
      tableLayouts[tableName] || {
        sections: [{ title: 'Details', fields: ['name', 'description'] }],
        hiddenFields: [],
        readonlyFields: [],
      }
    );
  }
}
