import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RiskService } from './risk.service';
import { CreateRiskDto, UpdateRiskDto, QueryRiskDto } from './risk.dto';

@ApiTags('risk')
@Controller({ path: 'risk/risks', version: '2' })
export class RiskController {
  constructor(private readonly service: RiskService) {}

  @Get()
  @ApiOkResponse({ description: 'List of risks with paging' })
  list(@Query() q: QueryRiskDto) { return this.service.list(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.get(id); }

  @Post()
  create(@Body() dto: CreateRiskDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRiskDto) { return this.service.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}


