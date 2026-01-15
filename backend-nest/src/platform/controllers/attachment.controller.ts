import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { CurrentUser } from '../../common/decorators';
import { AttachmentService } from '../services/attachment.service';

interface UploadedFileInfo {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/**
 * Attachment Controller
 *
 * Universal attachment management for any record in the platform.
 * All endpoints require JWT authentication and tenant context.
 *
 * Routes:
 * - POST /grc/attachments - Upload attachment
 * - GET /grc/attachments - List attachments for a record
 * - GET /grc/attachments/:id - Get attachment metadata
 * - GET /grc/attachments/:id/download - Download attachment
 * - DELETE /grc/attachments/:id - Soft delete attachment
 */
@Controller('grc/attachments')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  /**
   * Upload a new attachment
   *
   * Multipart form data:
   * - file: The file to upload
   * - refTable: The table name of the parent record
   * - refId: The UUID of the parent record
   */
  @Post()
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: UploadedFileInfo,
    @Query('refTable') refTable: string,
    @Query('refId') refId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!refTable) {
      throw new BadRequestException('refTable query parameter is required');
    }

    if (!refId) {
      throw new BadRequestException('refId query parameter is required');
    }

    const attachment = await this.attachmentService.upload(tenantId, userId, {
      refTable,
      refId,
      fileName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    });

    return { data: attachment };
  }

  /**
   * List attachments for a record
   */
  @Get()
  @Permissions(Permission.GRC_EVIDENCE_READ)
  async list(
    @Headers('x-tenant-id') tenantId: string,
    @Query('refTable') refTable: string,
    @Query('refId') refId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!refTable) {
      throw new BadRequestException('refTable query parameter is required');
    }

    if (!refId) {
      throw new BadRequestException('refId query parameter is required');
    }

    const attachments = await this.attachmentService.listByRecord(
      tenantId,
      refTable,
      refId,
    );

    return { data: attachments };
  }

  /**
   * Get attachment metadata by ID
   */
  @Get(':id')
  @Permissions(Permission.GRC_EVIDENCE_READ)
  async getById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const attachment = await this.attachmentService.getById(tenantId, id);

    return { data: attachment };
  }

  /**
   * Download attachment content
   */
  @Get(':id/download')
  @Permissions(Permission.GRC_EVIDENCE_READ)
  async download(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { stream, attachment } = await this.attachmentService.download(
      tenantId,
      userId,
      id,
    );

    res.set({
      'Content-Type': attachment.contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
      'Content-Length': attachment.sizeBytes.toString(),
    });

    return new StreamableFile(stream);
  }

  /**
   * Soft delete an attachment
   */
  @Delete(':id')
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.attachmentService.delete(tenantId, userId, id);

    return { data: { success: true } };
  }
}
