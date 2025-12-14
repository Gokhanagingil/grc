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
 * UI Policies Controller (Stub)
 *
 * Provides minimal stub endpoints for UI policy management.
 * Returns safe defaults to prevent 404 errors on staging.
 */
@Controller('platform/ui-policies')
@UseGuards(JwtAuthGuard)
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
   */
  @Post()
  create(
    @Body()
    body: {
      name: string;
      table_name: string;
      condition: Record<string, unknown>;
      actions: unknown[];
      priority: number;
    },
  ) {
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
      },
    };
  }

  /**
   * Update a UI policy (stub - returns success)
   */
  @Put(':id')
  update(@Param('id') id: string, @Body() updates: Record<string, unknown>) {
    return {
      message: 'UI policy updated',
      id: parseInt(id, 10),
      ...updates,
    };
  }

  /**
   * Delete a UI policy (stub - returns success)
   */
  @Delete(':id')
  delete(@Param('id') id: string) {
    return {
      message: 'UI policy deleted',
      id: parseInt(id, 10),
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
