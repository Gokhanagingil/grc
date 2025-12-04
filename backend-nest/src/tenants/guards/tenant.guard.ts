import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantsService } from '../tenants.service';
import { TenantAccessedEvent, DomainEventNames } from '../../events/domain-events';

/**
 * Tenant Guard
 * 
 * Ensures the authenticated user belongs to the tenant specified in the request header.
 * 
 * This guard should be applied AFTER JwtAuthGuard to ensure the user is authenticated.
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard, TenantGuard)
 * 
 * The tenant ID is read from the 'x-tenant-id' header.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated (JwtAuthGuard should run first)
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get tenant ID from header
    const tenantId = request.headers['x-tenant-id'];

    if (!tenantId) {
      throw new BadRequestException('Missing x-tenant-id header');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new BadRequestException('Invalid x-tenant-id format. Must be a valid UUID.');
    }

    // Check if user belongs to the tenant
    const userBelongsToTenant = await this.tenantsService.userBelongsToTenant(
      user.sub,
      tenantId,
    );

    if (!userBelongsToTenant) {
      throw new ForbiddenException(
        `Access denied. User does not belong to tenant ${tenantId}`,
      );
    }

    // Attach tenant ID to request for use in controllers
    request.tenantId = tenantId;

    // Emit tenant access event for audit logging
    this.eventEmitter.emit(
      DomainEventNames.TENANT_ACCESSED,
      new TenantAccessedEvent(
        tenantId,
        user.sub,
        request.path,
        request.method,
      ),
    );

    return true;
  }
}
