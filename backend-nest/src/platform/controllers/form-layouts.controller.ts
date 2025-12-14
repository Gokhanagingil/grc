import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/**
 * Form Layouts Controller (Stub)
 *
 * Provides minimal stub endpoints for form layout management.
 * Returns safe defaults to prevent 404 errors on staging.
 */
@Controller('platform/form-layouts')
@UseGuards(JwtAuthGuard)
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
   */
  @Post()
  create(
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
    return {
      message: 'Form layout created',
      layout: {
        id: 1,
        table_name: body.table_name,
        role: body.role,
        layout_json: body.layout_json,
        is_active: true,
      },
    };
  }

  /**
   * Update a form layout (stub - returns success)
   */
  @Put(':id')
  update(@Param('id') id: string, @Body() updates: Record<string, unknown>) {
    return {
      message: 'Form layout updated',
      id: parseInt(id, 10),
      ...updates,
    };
  }

  /**
   * Delete a form layout (stub - returns success)
   */
  @Delete(':id')
  delete(@Param('id') id: string) {
    return {
      message: 'Form layout deleted',
      id: parseInt(id, 10),
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
