import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request as NestRequest,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { RequestWithUser } from '../common/types';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysWebhookEndpoint } from './entities/sys-webhook-endpoint.entity';
import {
  CreateWebhookEndpointDto,
  UpdateWebhookEndpointDto,
  WebhookEndpointFilterDto,
} from './dto/webhook-endpoint.dto';

@Controller('grc/webhook-endpoints')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WebhookEndpointController {
  constructor(
    @InjectRepository(SysWebhookEndpoint)
    private readonly repo: Repository<SysWebhookEndpoint>,
  ) {}

  @Get()
  @Permissions(Permission.WEBHOOK_ENDPOINT_READ)
  async list(
    @NestRequest() req: RequestWithUser,
    @Query() filter: WebhookEndpointFilterDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const page = filter.page || 1;
    const pageSize = Math.min(filter.pageSize || 50, 100);

    const qb = this.repo
      .createQueryBuilder('w')
      .where('w.tenantId = :tenantId', { tenantId });

    if (filter.isActive !== undefined) {
      qb.andWhere('w.isActive = :isActive', { isActive: filter.isActive });
    }

    const total = await qb.getCount();
    qb.orderBy('w.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return { items, total, page, pageSize };
  }

  @Get(':id')
  @Permissions(Permission.WEBHOOK_ENDPOINT_READ)
  async get(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const endpoint = await this.repo.findOne({ where: { id, tenantId } });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    return endpoint;
  }

  @Post()
  @Permissions(Permission.WEBHOOK_ENDPOINT_WRITE)
  async create(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreateWebhookEndpointDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const endpoint = this.repo.create({
      tenantId,
      name: dto.name,
      url: dto.url,
      secret: dto.secret || crypto.randomBytes(32).toString('hex'),
      headers: dto.headers || {},
      eventFilters: dto.eventFilters || [],
      isActive: dto.isActive ?? false,
      description: dto.description || null,
    });

    return this.repo.save(endpoint);
  }

  @Put(':id')
  @Permissions(Permission.WEBHOOK_ENDPOINT_WRITE)
  async update(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const endpoint = await this.repo.findOne({ where: { id, tenantId } });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');

    if (dto.name !== undefined) endpoint.name = dto.name;
    if (dto.url !== undefined) endpoint.url = dto.url;
    if (dto.headers !== undefined) endpoint.headers = dto.headers;
    if (dto.eventFilters !== undefined) endpoint.eventFilters = dto.eventFilters;
    if (dto.isActive !== undefined) endpoint.isActive = dto.isActive;
    if (dto.description !== undefined) endpoint.description = dto.description;

    return this.repo.save(endpoint);
  }

  @Post(':id/rotate-secret')
  @Permissions(Permission.WEBHOOK_ENDPOINT_WRITE)
  async rotateSecret(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const endpoint = await this.repo.findOne({ where: { id, tenantId } });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');

    endpoint.secret = crypto.randomBytes(32).toString('hex');
    const saved = await this.repo.save(endpoint);
    return { id: saved.id, secret: saved.secret };
  }

  @Delete(':id')
  @Permissions(Permission.WEBHOOK_ENDPOINT_WRITE)
  async delete(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const result = await this.repo.delete({ id, tenantId });
    if (!result.affected) throw new NotFoundException('Webhook endpoint not found');
    return { deleted: true };
  }
}
