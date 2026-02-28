import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.enum';

/**
 * Metadata key for permissions
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Metadata key for "require any of" permissions (OR).
 * Used only by routes that accept one of several permissions (e.g. company lookup).
 */
export const REQUIRE_ANY_PERMISSIONS_KEY = 'require_any_permissions';

/**
 * Require any one of the given permissions (OR).
 * Must be used with PermissionsGuard. User needs at least one of the listed permissions.
 */
export const RequireAnyOf = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSIONS_KEY, permissions);

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
