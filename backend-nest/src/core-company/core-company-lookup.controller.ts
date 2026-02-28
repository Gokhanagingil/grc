import {
  Controller,
  Get,
  Headers,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { RequireAnyOf } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { CoreCompanyService } from './core-company.service';
import { CompanyLookupQueryDto } from './dto/company-lookup-query.dto';

/**
 * Tenant-scoped company lookup for ITSM selectors (service/incident/change/SLA).
 * GET /grc/companies/lookup — does not require admin; allows any of:
 * ITSM_SERVICE_READ, ITSM_INCIDENT_READ, ITSM_CHANGE_READ, ITSM_SLA_READ, ADMIN_COMPANY_READ.
 */
@Controller('grc/companies')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CoreCompanyLookupController {
  constructor(private readonly companyService: CoreCompanyService) {}

  @Get('lookup')
  @RequireAnyOf(
    Permission.ITSM_SERVICE_READ,
    Permission.ITSM_INCIDENT_READ,
    Permission.ITSM_CHANGE_READ,
    Permission.ITSM_SLA_READ,
    Permission.ADMIN_COMPANY_READ,
  )
  async lookup(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: CompanyLookupQueryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.companyService.lookup(tenantId, query);
  }
}
