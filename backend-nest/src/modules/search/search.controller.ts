import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller({ path: 'search', version: '2' })
@UseGuards(TenantGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('query')
  @ApiOperation({
    summary: 'Boolean search query',
    description: 'Execute a boolean search query with AND/OR/NOT operators',
  })
  @ApiOkResponse({ description: 'Search results' })
  async query(
    @Query('q') queryString: string,
    @Query('table') table: string,
    @Tenant() tenantId: string,
  ) {
    if (!queryString || !table) {
      throw new BadRequestException('Query string (q) and table are required');
    }

    return this.searchService.executeQuery(queryString, table, tenantId);
  }
}
