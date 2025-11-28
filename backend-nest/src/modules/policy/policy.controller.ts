/**
 * @deprecated This controller is legacy and should not be used in new code.
 * Use GovernanceController instead, which provides tenant-safe policy operations.
 * 
 * This controller has been hardened with TenantGuard for security,
 * but the long-term goal is to fully migrate to GovernanceController.
 * 
 * @see GovernanceController for the recommended implementation
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiOperation } from '@nestjs/swagger';
import { PolicyService } from './policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { QueryPolicyDto } from './dto/query-policy.dto';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { getTenantId } from '../../common/tenant/tenant.util';
import { ConfigService } from '@nestjs/config';

@ApiTags('policies')
@ApiBearerAuth()
@Controller({ path: 'policies', version: '2' })
@UseGuards(TenantGuard)
export class PolicyController {
  constructor(
    private readonly service: PolicyService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create policy (deprecated)',
    description: '⚠️ DEPRECATED: Use POST /api/v2/governance/policies instead. This endpoint is maintained for backward compatibility only.',
    deprecated: true,
  })
  @ApiOkResponse({ type: PolicyEntity })
  create(@Body() dto: CreatePolicyDto, @Tenant() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Get()
  @ApiOperation({ 
    summary: 'List policies (deprecated)',
    description: '⚠️ DEPRECATED: Use GET /api/v2/governance/policies instead. This endpoint is maintained for backward compatibility only.',
    deprecated: true,
  })
  @ApiOkResponse({ type: [PolicyEntity] })
  list(@Query() q: QueryPolicyDto, @Req() req: Request) {
    const tenantId = getTenantId(req, this.config);
    return this.service.findAll(q, tenantId);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get policy (deprecated)',
    description: '⚠️ DEPRECATED: Use GET /api/v2/governance/policies/:id instead. This endpoint is maintained for backward compatibility only.',
    deprecated: true,
  })
  @ApiOkResponse({ type: PolicyEntity })
  get(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ 
    summary: 'Update policy (deprecated)',
    description: '⚠️ DEPRECATED: Use PATCH /api/v2/governance/policies/:id instead. This endpoint is maintained for backward compatibility only.',
    deprecated: true,
  })
  @ApiOkResponse({ type: PolicyEntity })
  update(@Param('id') id: string, @Body() dto: UpdatePolicyDto, @Tenant() tenantId: string) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete policy (deprecated)',
    description: '⚠️ DEPRECATED: Use DELETE /api/v2/governance/policies/:id instead. This endpoint is maintained for backward compatibility only.',
    deprecated: true,
  })
  @ApiOkResponse({ description: 'Policy deleted' })
  remove(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
