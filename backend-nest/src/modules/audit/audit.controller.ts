import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audits')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiOkResponse({ description: 'List of audits' })
  list() {
    return this.service.findAll();
  }
}
