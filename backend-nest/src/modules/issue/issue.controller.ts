import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IssueService } from './issue.service';

@ApiTags('issue')
@Controller('issues')
export class IssueController {
  constructor(private readonly service: IssueService) {}

  @Get()
  @ApiOkResponse({ description: 'List of issues' })
  list() {
    return this.service.findAll();
  }
}

