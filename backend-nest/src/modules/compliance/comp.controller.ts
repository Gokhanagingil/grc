import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ComplianceService } from './comp.service';
import { CreateRequirementDto, UpdateRequirementDto, QueryRequirementDto } from './comp.dto';

@ApiTags('compliance')
@Controller({ path: 'compliance', version: '2' })
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  @Get('requirements')
  @ApiOkResponse({ description: 'List of requirements with paging' })
  list(@Query() q: QueryRequirementDto) { return this.service.list(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.get(id); }

  @Post()
  create(@Body() dto: CreateRequirementDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRequirementDto) { return this.service.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}


