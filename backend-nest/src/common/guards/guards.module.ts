/**
 * Guards Module
 *
 * Shared module that provides all guard dependencies for feature modules.
 * Import this module in any feature module that uses protected routes with
 * JwtAuthGuard, TenantGuard, or PermissionsGuard.
 *
 * This module re-exports AuthModule and TenantsModule to make their
 * guard-related providers available in the importing module's DI context.
 *
 * Usage:
 * ```typescript
 * @Module({
 *   imports: [GuardsModule],
 *   controllers: [MyController],
 * })
 * export class MyModule {}
 * ```
 *
 * The controller can then use:
 * ```typescript
 * @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
 * @Permissions(Permission.GRC_RISK_READ)
 * @Get()
 * findAll() { ... }
 * ```
 */

import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { TenantsModule } from '../../tenants/tenants.module';

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => TenantsModule)],
  exports: [AuthModule, TenantsModule],
})
export class GuardsModule {}
