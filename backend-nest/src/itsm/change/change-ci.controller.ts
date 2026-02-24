import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
  Request,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { ChangeCiService } from './change-ci.service';
import { ChangeCiFilterDto } from './dto/change-ci-filter.dto';
import { Perf } from '../../common/decorators';

@Controller('grc/itsm/changes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ChangeCiController {
  constructor(private readonly changeCiService: ChangeCiService) {}

  @Get(':changeId/affected-cis')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @ApiOperation({ summary: 'List affected CIs for a change' })
  @ApiResponse({ status: 200, description: 'Affected CIs retrieved' })
  @Perf()
  async listAffectedCis(
    @Headers('x-tenant-id') tenantId: string,
    @Param('changeId') changeId: string,
    @Query() filterDto: ChangeCiFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.changeCiService.findAffectedCis(
      tenantId,
      changeId,
      filterDto,
    );
    return { success: true, data: result };
  }

  @Post(':changeId/affected-cis')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @ApiOperation({ summary: 'Add an affected CI to a change' })
  @ApiResponse({ status: 201, description: 'CI linked to change' })
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async addAffectedCi(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('changeId') changeId: string,
    @Body()
    body: { ciId: string; relationshipType: string; impactScope?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    if (!body.ciId || !body.relationshipType) {
      throw new BadRequestException('ciId and relationshipType are required');
    }

    const link = await this.changeCiService.addAffectedCi(
      tenantId,
      req.user.id,
      changeId,
      body.ciId,
      body.relationshipType,
      body.impactScope,
    );
    return { success: true, data: link };
  }

  @Delete(':changeId/affected-cis/:linkId')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @ApiOperation({ summary: 'Remove an affected CI link from a change' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async removeAffectedCi(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('changeId') changeId: string,
    @Param('linkId') linkId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const deleted = await this.changeCiService.removeAffectedCi(
      tenantId,
      req.user.id,
      changeId,
      linkId,
    );

    if (!deleted) {
      throw new NotFoundException(`CI link with ID ${linkId} not found`);
    }
  }
}
