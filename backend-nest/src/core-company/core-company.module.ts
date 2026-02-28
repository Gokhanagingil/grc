import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreCompany } from './core-company.entity';
import { CoreCompanyService } from './core-company.service';
import { CoreCompanyController } from './core-company.controller';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';

/**
 * Core Company Module
 *
 * Provides shared company dimension management:
 * - CRUD operations for companies (CUSTOMER, VENDOR, INTERNAL)
 * - Admin endpoints for company management
 * - Exports CoreCompanyService for cross-module usage
 *
 * Used by: ITSM, GRC, SLA, Contracts modules
 */
@Module({
  imports: [TypeOrmModule.forFeature([CoreCompany]), AuthModule, TenantsModule],
  controllers: [CoreCompanyController],
  providers: [CoreCompanyService],
  exports: [CoreCompanyService],
})
export class CoreCompanyModule {}
