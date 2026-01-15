import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import {
  Attachment,
  AttachmentStatus,
  StorageProvider,
} from '../entities/attachment.entity';
import { StorageAdapter, STORAGE_ADAPTER } from '../storage';

/**
 * Attachment Upload DTO
 */
export interface UploadAttachmentDto {
  refTable: string;
  refId: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

/**
 * Attachment Response DTO
 */
export interface AttachmentResponse {
  id: string;
  refTable: string;
  refId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: AttachmentStatus;
  createdAt: Date;
  createdBy: string | null;
}

/**
 * Default allowed tables for attachments
 * Security: Only these tables can have attachments
 * Can be overridden via ATTACHMENT_ALLOWED_TABLES env var (comma-separated)
 */
const DEFAULT_ALLOWED_REF_TABLES = [
  'grc_risks',
  'grc_policies',
  'grc_requirements',
  'grc_controls',
  'grc_audits',
  'grc_issues',
  'grc_capas',
  'grc_evidence',
  'grc_processes',
  'grc_process_violations',
];

/**
 * Default allowed MIME types
 */
const DEFAULT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/json',
  'application/xml',
];

/**
 * Default max file size (10MB)
 */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Attachment Service
 *
 * Manages file attachments for any record in the platform.
 * Features:
 * - Multi-tenant isolation
 * - Configurable MIME type allowlist
 * - Configurable max file size
 * - SHA256 hash computation
 * - Audit logging
 * - Soft delete support
 */
@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  private readonly allowedRefTables: Set<string>;
  private readonly allowedMimeTypes: Set<string>;
  private readonly maxFileSize: number;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @Inject(STORAGE_ADAPTER)
    private readonly storageAdapter: StorageAdapter,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const configuredTables = this.configService.get<string>(
      'ATTACHMENT_ALLOWED_TABLES',
    );
    this.allowedRefTables = new Set(
      configuredTables
        ? configuredTables.split(',').map((t) => t.trim())
        : DEFAULT_ALLOWED_REF_TABLES,
    );

    const configuredMimeTypes = this.configService.get<string>(
      'ATTACHMENT_ALLOWED_MIME_TYPES',
    );
    this.allowedMimeTypes = new Set(
      configuredMimeTypes
        ? configuredMimeTypes.split(',').map((t) => t.trim())
        : DEFAULT_ALLOWED_MIME_TYPES,
    );

    this.maxFileSize = this.configService.get<number>(
      'ATTACHMENT_MAX_FILE_SIZE',
      DEFAULT_MAX_FILE_SIZE,
    );
  }

  /**
   * Validate ref_table against allowlist
   */
  private validateRefTable(refTable: string): void {
    if (!this.allowedRefTables.has(refTable)) {
      throw new BadRequestException(
        `Invalid ref_table: '${refTable}'. Attachments are not supported for this table.`,
      );
    }
  }

  /**
   * Validate MIME type against allowlist
   */
  private validateMimeType(contentType: string): void {
    if (!this.allowedMimeTypes.has(contentType)) {
      throw new BadRequestException(
        `File type '${contentType}' is not allowed. Allowed types: ${Array.from(this.allowedMimeTypes).join(', ')}`,
      );
    }
  }

  /**
   * Validate file size
   */
  private validateFileSize(size: number): void {
    if (size > this.maxFileSize) {
      const maxSizeMB = Math.round(this.maxFileSize / (1024 * 1024));
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
      );
    }
  }

  /**
   * Sanitize file name to prevent path traversal
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[/\\]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/\0/g, '')
      .substring(0, 255);
  }

  /**
   * Compute SHA256 hash of file content
   */
  private computeSha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generate storage key for a file
   */
  private generateStorageKey(
    tenantId: string,
    refTable: string,
    refId: string,
    fileName: string,
  ): string {
    const timestamp = Date.now();
    const sanitizedFileName = this.sanitizeFileName(fileName);
    return `${tenantId}/${refTable}/${refId}/${timestamp}_${sanitizedFileName}`;
  }

  /**
   * Upload a new attachment
   */
  async upload(
    tenantId: string,
    userId: string | null,
    dto: UploadAttachmentDto,
  ): Promise<AttachmentResponse> {
    this.validateRefTable(dto.refTable);
    this.validateMimeType(dto.contentType);
    this.validateFileSize(dto.buffer.length);

    const sha256 = this.computeSha256(dto.buffer);
    const storageKey = this.generateStorageKey(
      tenantId,
      dto.refTable,
      dto.refId,
      dto.fileName,
    );

    await this.storageAdapter.put(dto.buffer, storageKey, dto.contentType);

    const attachment = this.attachmentRepository.create({
      tenantId,
      refTable: dto.refTable,
      refId: dto.refId,
      fileName: this.sanitizeFileName(dto.fileName),
      contentType: dto.contentType,
      sizeBytes: dto.buffer.length,
      sha256,
      storageProvider: StorageProvider.LOCAL,
      storageKey,
      status: AttachmentStatus.UPLOADED,
      createdBy: userId,
    });

    const saved = await this.attachmentRepository.save(attachment);

    this.eventEmitter.emit('attachment.uploaded', {
      attachmentId: saved.id,
      tenantId,
      userId,
      refTable: dto.refTable,
      refId: dto.refId,
      fileName: saved.fileName,
      contentType: saved.contentType,
      sizeBytes: saved.sizeBytes,
      timestamp: new Date(),
    });

    this.logger.log(
      `Attachment uploaded: ${saved.id} for ${dto.refTable}/${dto.refId}`,
    );

    return this.toResponse(saved);
  }

  /**
   * List attachments for a record
   */
  async listByRecord(
    tenantId: string,
    refTable: string,
    refId: string,
  ): Promise<AttachmentResponse[]> {
    this.validateRefTable(refTable);

    const attachments = await this.attachmentRepository.find({
      where: {
        tenantId,
        refTable,
        refId,
        deletedAt: IsNull(),
        status: AttachmentStatus.UPLOADED,
      },
      order: { createdAt: 'DESC' },
    });

    return attachments.map((a) => this.toResponse(a));
  }

  /**
   * Get attachment metadata by ID
   */
  async getById(
    tenantId: string,
    attachmentId: string,
  ): Promise<AttachmentResponse> {
    const attachment = await this.attachmentRepository.findOne({
      where: {
        id: attachmentId,
        tenantId,
        deletedAt: IsNull(),
      },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment not found: ${attachmentId}`);
    }

    return this.toResponse(attachment);
  }

  /**
   * Download attachment content as stream
   */
  async download(
    tenantId: string,
    userId: string | null,
    attachmentId: string,
  ): Promise<{ stream: Readable; attachment: AttachmentResponse }> {
    const attachment = await this.attachmentRepository.findOne({
      where: {
        id: attachmentId,
        tenantId,
        deletedAt: IsNull(),
      },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment not found: ${attachmentId}`);
    }

    if (attachment.status === AttachmentStatus.BLOCKED) {
      throw new ForbiddenException('This attachment has been blocked');
    }

    const stream = await this.storageAdapter.getStream(attachment.storageKey);

    this.eventEmitter.emit('attachment.downloaded', {
      attachmentId: attachment.id,
      tenantId,
      userId,
      refTable: attachment.refTable,
      refId: attachment.refId,
      fileName: attachment.fileName,
      timestamp: new Date(),
    });

    return {
      stream,
      attachment: this.toResponse(attachment),
    };
  }

  /**
   * Soft delete an attachment
   */
  async delete(
    tenantId: string,
    userId: string | null,
    attachmentId: string,
  ): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({
      where: {
        id: attachmentId,
        tenantId,
        deletedAt: IsNull(),
      },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment not found: ${attachmentId}`);
    }

    attachment.deletedAt = new Date();
    attachment.status = AttachmentStatus.DELETED;
    await this.attachmentRepository.save(attachment);

    this.eventEmitter.emit('attachment.deleted', {
      attachmentId: attachment.id,
      tenantId,
      userId,
      refTable: attachment.refTable,
      refId: attachment.refId,
      fileName: attachment.fileName,
      timestamp: new Date(),
    });

    this.logger.log(`Attachment deleted: ${attachmentId}`);
  }

  /**
   * Convert entity to response DTO
   */
  private toResponse(attachment: Attachment): AttachmentResponse {
    return {
      id: attachment.id,
      refTable: attachment.refTable,
      refId: attachment.refId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      status: attachment.status,
      createdAt: attachment.createdAt,
      createdBy: attachment.createdBy,
    };
  }
}
