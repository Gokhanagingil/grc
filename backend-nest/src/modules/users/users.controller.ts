import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller({ path: 'users', version: '2' })
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  @ApiOkResponse({ description: 'List of users' })
  async list(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.svc.list({ page: Number(page), limit: Number(limit) });
  }

  @Get('owners')
  @ApiOkResponse({
    description: 'List of users for owner selection (simplified)',
  })
  async getOwners() {
    return this.svc.getOwners();
  }

  @Get('auditors')
  @ApiOkResponse({
    description: 'List of users for auditor selection (simplified)',
  })
  async getAuditors() {
    return this.svc.getAuditors();
  }
}
