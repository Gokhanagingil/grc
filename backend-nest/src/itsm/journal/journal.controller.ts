import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { JournalService } from './journal.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { JournalFilterDto } from './dto/journal-filter.dto';
import { JournalType } from './journal.entity';
import { Perf } from '../../common/decorators';

@Controller('grc/itsm')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get(':table/:recordId/journal')
  @Permissions(Permission.ITSM_JOURNAL_READ)
  @Perf()
  async findByRecord(
    @Headers('x-tenant-id') tenantId: string,
    @Param('table') table: string,
    @Param('recordId') recordId: string,
    @Query() filterDto: JournalFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!this.journalService.isAllowedTable(table)) {
      throw new BadRequestException(
        `Table '${table}' is not supported for journal entries`,
      );
    }

    return this.journalService.findByRecord(
      tenantId,
      table,
      recordId,
      filterDto,
    );
  }

  @Post(':table/:recordId/journal')
  @Permissions(Permission.ITSM_JOURNAL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('table') table: string,
    @Param('recordId') recordId: string,
    @Body() dto: CreateJournalDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!this.journalService.isAllowedTable(table)) {
      throw new BadRequestException(
        `Table '${table}' is not supported for journal entries`,
      );
    }

    return this.journalService.createJournalEntry(
      tenantId,
      req.user.id,
      table,
      recordId,
      dto,
    );
  }

  @Get(':table/:recordId/journal/count')
  @Permissions(Permission.ITSM_JOURNAL_READ)
  @Perf()
  async count(
    @Headers('x-tenant-id') tenantId: string,
    @Param('table') table: string,
    @Param('recordId') recordId: string,
    @Query('type') type?: JournalType,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!this.journalService.isAllowedTable(table)) {
      throw new BadRequestException(
        `Table '${table}' is not supported for journal entries`,
      );
    }

    if (type && !Object.values(JournalType).includes(type)) {
      throw new BadRequestException(`Invalid journal type '${type}'`);
    }

    const count = await this.journalService.countByRecord(
      tenantId,
      table,
      recordId,
      type,
    );

    return { count };
  }
}
