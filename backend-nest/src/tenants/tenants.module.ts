import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { User } from '../users/user.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantGuard } from './guards/tenant.guard';

/**
 * Tenants Module
 * 
 * Provides multi-tenancy support for the NestJS backend.
 * 
 * Features:
 * - Tenant entity and repository
 * - TenantGuard for protecting tenant-aware routes
 * - TenantsService for tenant operations
 * - Demo endpoints for testing multi-tenancy
 * 
 * Usage:
 * 1. Import TenantsModule in AppModule
 * 2. Use @UseGuards(JwtAuthGuard, TenantGuard) on routes
 * 3. Pass x-tenant-id header in requests
 */
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, User])],
  controllers: [TenantsController],
  providers: [TenantsService, TenantGuard],
  exports: [TenantsService, TenantGuard],
})
export class TenantsModule {}
