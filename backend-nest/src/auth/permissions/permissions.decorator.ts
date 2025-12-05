import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.enum';

/**
 * Metadata key for permissions
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Permissions Decorator
 *
 * Use this decorator to specify which permissions are required to access a route.
 * Must be used in conjunction with PermissionsGuard.
 *
 * The user must have ALL specified permissions to access the route.
 *
 * @example
 * ```typescript
 * @Permissions(Permission.GRC_RISK_READ)
 * @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
 * @Get()
 * findAll() { ... }
 * ```
 *
 * @example
 * ```typescript
 * @Permissions(Permission.GRC_RISK_WRITE)
 * @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
 * @Post()
 * create() { ... }
 * ```
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
