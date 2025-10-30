import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PolicyService } from './policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { QueryPolicyDto } from './dto/query-policy.dto';
import { Policy } from './policy.entity';

@ApiTags('policies')
@ApiBearerAuth()
@Controller({ path: 'policies', version: '2' })
export class PolicyController {
  constructor(private readonly service: PolicyService) {}

  @Post()
  @ApiOkResponse({ type: Policy })
  create(@Body() dto: CreatePolicyDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query() q: QueryPolicyDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  @ApiOkResponse({ type: Policy })
  get(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: Policy })
  update(@Param('id') id: string, @Body() dto: UpdatePolicyDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
