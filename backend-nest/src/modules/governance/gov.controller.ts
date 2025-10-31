import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GovService } from './gov.service';
import { CreateGovPolicyDto, UpdateGovPolicyDto, QueryGovDto } from './gov.dto';

@ApiTags('governance')
@Controller({ path: 'governance', version: '2' })
export class GovController {
  constructor(private readonly service: GovService) {}

  @Get('policies')
  @ApiOkResponse({ description: 'List of governance policies with paging' })
  list(@Query() q: QueryGovDto) { return this.service.list(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.get(id); }

  @Post()
  create(@Body() dto: CreateGovPolicyDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGovPolicyDto) { return this.service.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}


