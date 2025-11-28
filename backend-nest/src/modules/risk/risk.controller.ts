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
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RiskService } from './risk.service';
import { CreateRiskDto, UpdateRiskDto, QueryRiskDto } from './risk.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@ApiTags('risk')
@Controller({ path: 'risk', version: '2' })
@UseGuards(TenantGuard)
export class RiskController {
  constructor(private readonly service: RiskService) {}

  @Get('ping')
  @ApiOkResponse({ description: 'Risk ping' })
  ping() {
    return { ok: true, mod: 'risk', ts: new Date().toISOString() };
  }

  @Get('risks')
  @ApiOkResponse({ description: 'List of risks with paging' })
  list(@Query() q: QueryRiskDto, @Tenant() tenantId: string) {
    return this.service.list(q, tenantId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.get(id, tenantId);
  }

  @Post()
  create(@Body() dto: CreateRiskDto, @Tenant() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRiskDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
