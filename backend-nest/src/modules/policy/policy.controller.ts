import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PolicyService } from './policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@ApiTags('policy')
@Controller('policies')
export class PolicyController {
  constructor(private readonly service: PolicyService) {}

  @Get() list() { return this.service.findAll(); }
  @Get(':id') get(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreatePolicyDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdatePolicyDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}