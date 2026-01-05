import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { GrcFrameworksService } from '../services/grc-frameworks.service';
import { Perf } from '../../common/decorators';

@Controller('grc/frameworks')
@UseGuards(JwtAuthGuard)
export class GrcFrameworksController {
  constructor(private readonly frameworksService: GrcFrameworksService) {}

  @Get()
  @Perf()
  async findAllActive() {
    return this.frameworksService.findAllActive();
  }
}

@Controller('tenants/me/frameworks')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TenantFrameworksController {
  constructor(private readonly frameworksService: GrcFrameworksService) {}

  @Get()
  @Perf()
  async getTenantFrameworks(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.frameworksService.getTenantFrameworkKeys(tenantId);
  }

  @Put()
  @Perf()
  async setTenantFrameworks(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { activeKeys: string[] },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.frameworksService.setTenantFrameworks(
      tenantId,
      body.activeKeys,
    );
  }
}
