import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user.entity';

/**
 * Metadata key for roles
 */
export const ROLES_KEY = 'roles';

/**
 * Roles Decorator
 *
 * Use this decorator to specify which roles are allowed to access a route.
 * Must be used in conjunction with RolesGuard.
 *
 * @example
 * ```typescript
 * @Roles(UserRole.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('admin-only')
 * adminOnly() { ... }
 * ```
 *
 * @example
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.MANAGER)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('managers')
 * forManagers() { ... }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
