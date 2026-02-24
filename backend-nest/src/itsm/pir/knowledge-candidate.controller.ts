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
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { KnowledgeCandidateService } from './knowledge-candidate.service';
import {
  KnowledgeCandidateStatus,
  KnowledgeCandidateSourceType,
} from './pir.enums';

/**
 * ITSM Knowledge Candidate Controller
 *
 * REST API for managing knowledge article candidates:
 * - Generate from PIR, Known Error, or Problem
 * - List, detail, delete
 * - Status transitions (review, publish, reject)
 *
 * All endpoints require JWT + tenant context + permissions.
 */
@Controller('grc/itsm/knowledge-candidates')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class KnowledgeCandidateController {
  private readonly logger = new Logger(KnowledgeCandidateController.name);

  constructor(private readonly kcService: KnowledgeCandidateService) {}

  @Get()
  @Permissions(Permission.ITSM_KNOWLEDGE_CANDIDATE_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: KnowledgeCandidateStatus,
    @Query('sourceType') sourceType?: KnowledgeCandidateSourceType,
    @Query('search') search?: string,
  ) {
    return this.kcService.findWithFilters(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      status,
      sourceType,
      search,
    });
  }

  @Post('generate/pir/:pirId')
  @Permissions(Permission.ITSM_KNOWLEDGE_CANDIDATE_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async generateFromPir(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('pirId') pirId: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.kcService.generateFromPir(
      tenantId,
      userId,
      pirId,
    );
    return { data: result };
  }

  @Post('generate/known-error/:knownErrorId')
  @Permissions(Permission.ITSM_KNOWLEDGE_CANDIDATE_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async generateFromKnownError(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('knownErrorId') knownErrorId: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.kcService.generateFromKnownError(
      tenantId,
      userId,
      knownErrorId,
    );
    return { data: result };
  }

  @Post('generate/problem/:problemId')
  @Permissions(Permission.ITSM_KNOWLEDGE_CANDIDATE_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async generateFromProblem(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('problemId') problemId: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.kcService.generateFromProblem(
      tenantId,
      userId,
      problemId,
    );
    return { data: result };
  }

  @Get(':id')
  @Permissions(Permission.ITSM_KNOWLEDGE_CANDIDATE_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    const kc = await this.kcService.findOne(tenantId, id);
    if (!kc) {
      throw new NotFoundException(
        `Knowledge Candidate with ID ${id} not found`,
      );
    }
    return { data: kc };
  }

  @Post(':id/review')
  @Permissions(Permission.ITSM_KNOWLEDGE_CANDIDATE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async review(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.kcService.transitionStatus(
      tenantId,
      userId,
      id,
      KnowledgeCandidateStatus.REVIEWED,
    );
    return { data: result };
  }

  @Post(':id/publish')
  @Permissions(Permission.ITSM_KNOWLEDGE_CANDIDATE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async publish(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.kcService.transitionStatus(
      tenantId,
      userId,
      id,
      KnowledgeCandidateStatus.PUBLISHED,
    );
    return { data: result };
  }

  @Post(':id/reject')
  @Permissions(Permission.ITSM_KNOWLEDGE_CANDIDATE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async reject(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.kcService.transitionStatus(
      tenantId,
      userId,
      id,
      KnowledgeCandidateStatus.REJECTED,
    );
    return { data: result };
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_KNOWLEDGE_CANDIDATE_CREATE)
  @Perf()
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const deleted = await this.kcService.softDelete(tenantId, userId, id);
    if (!deleted) {
      throw new NotFoundException(
        `Knowledge Candidate with ID ${id} not found`,
      );
    }
    return { data: { deleted: true } };
  }
}
