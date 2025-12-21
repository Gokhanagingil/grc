import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { RequestWithUser } from '../common/types';
import { QueryAuditLogsDto } from './dto';

/**
 * Audit Controller
 *
 * Provides endpoints for retrieving audit logs.
 * Admin-only access for security and compliance.
 */
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Get audit logs with pagination and filtering
   * Admin-only endpoint
   */
  @Get()
  async findAll(
    @Query() query: QueryAuditLogsDto,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    const { page = 1, limit = 20, action, actor } = query;
    // Note: startDate and endDate are available in query but not yet implemented in findAll
    const skip = (page - 1) * limit;

    // Build options for findAll
    const options: {
      tenantId?: string;
      userId?: string;
      action?: string;
      skip?: number;
      take?: number;
    } = {
      tenantId: effectiveTenantId,
      skip,
      take: limit,
    };

    if (action) {
      options.action = action;
    }

    // If actor is provided, try to resolve it to userId
    // For now, we'll filter by userId if it looks like a UUID, otherwise we'll need to join with users table
    // Simple approach: if actor is provided and looks like UUID, use as userId
    if (actor) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(actor)) {
        options.userId = actor;
      }
      // Note: If actor is an email, we'd need to join with users table
      // For MVP, we'll support UUID userId filtering only
    }

    const logs = await this.auditService.findAll(options);

    // Get total count for pagination
    const total = await this.auditService.countForTenant(effectiveTenantId, {
      userId: options.userId,
      action: options.action,
    });

    // Transform logs to match frontend expectations
    const transformedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityName || log.resource,
      entityId: log.entityId || log.resourceId,
      userId: log.userId,
      changes: log.afterState
        ? {
            before: log.beforeState,
            after: log.afterState,
          }
        : undefined,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
    }));

    // Return in standard NestJS response format (will be wrapped by ResponseTransformInterceptor)
    return {
      logs: transformedLogs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
