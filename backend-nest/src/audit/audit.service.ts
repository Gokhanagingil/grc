import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLog } from './audit-log.entity';
import {
  AuditLogEvent,
  UserLoggedInEvent,
  TenantAccessedEvent,
  DomainEventNames,
} from '../events/domain-events';
import {
  RiskCreatedEvent,
  RiskUpdatedEvent,
  RiskDeletedEvent,
  PolicyCreatedEvent,
  PolicyUpdatedEvent,
  PolicyDeletedEvent,
  RequirementCreatedEvent,
  RequirementUpdatedEvent,
  RequirementDeletedEvent,
} from '../grc/events';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Sensitive keys to redact from audit payloads
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'jwt',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'private_key',
];

/**
 * Maximum size for metadata objects (in characters when stringified)
 */
const MAX_METADATA_SIZE = 10000;

/**
 * Audit Service
 *
 * Handles persistence of audit log entries.
 * Listens to domain events and creates audit records.
 *
 * Production Hardening:
 * - Retry logic with exponential backoff
 * - Fallback to local file on persistent failures
 * - Payload sanitization (redact secrets, limit size)
 * - In-flight tracking for graceful shutdown
 */
@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);
  private readonly isEnabled: boolean;
  private readonly retryAttempts: number;
  private readonly retryDelayMs: number;
  private readonly fallbackFile: string;
  private readonly inFlightWrites = new Set<Promise<unknown>>();

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {
    this.isEnabled =
      this.configService.get<string>('audit.enabled', 'true') === 'true';
    this.retryAttempts = this.configService.get<number>(
      'audit.retryAttempts',
      3,
    );
    this.retryDelayMs = this.configService.get<number>(
      'audit.retryDelayMs',
      100,
    );
    this.fallbackFile = this.configService.get<string>(
      'audit.fallbackFile',
      'audit-failures.log',
    );
  }

  onModuleInit() {
    const fallbackDir = path.dirname(this.fallbackFile);
    if (fallbackDir && fallbackDir !== '.') {
      try {
        fs.mkdirSync(fallbackDir, { recursive: true });
      } catch {
        // Directory may already exist
      }
    }
  }

  getInFlightCount(): number {
    return this.inFlightWrites.size;
  }

  async flushPendingWrites(): Promise<void> {
    if (this.inFlightWrites.size > 0) {
      this.logger.log(
        `Flushing ${this.inFlightWrites.size} pending audit writes...`,
      );
      await Promise.allSettled([...this.inFlightWrites]);
      this.logger.log('All pending audit writes flushed');
    }
  }

  private sanitizePayload(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }
    if (typeof data === 'string') {
      if (data.length > 1000) {
        return data.substring(0, 1000) + '...[truncated]';
      }
      return data;
    }
    if (Array.isArray(data)) {
      const limited = data.slice(0, 100);
      return limited.map((item) => this.sanitizePayload(item));
    }
    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(
        data as Record<string, unknown>,
      )) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizePayload(value);
        }
      }
      return sanitized;
    }
    return data;
  }

  private sanitizeMetadata(
    metadata: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!metadata) {
      return metadata;
    }
    const sanitized = this.sanitizePayload(metadata) as Record<string, unknown>;
    const stringified = JSON.stringify(sanitized);
    if (stringified.length > MAX_METADATA_SIZE) {
      return {
        _truncated: true,
        _originalSize: stringified.length,
        summary: 'Metadata truncated due to size limits',
      };
    }
    return sanitized;
  }

  private async writeToFallback(
    data: Partial<AuditLog>,
    error: Error,
  ): Promise<void> {
    try {
      const fallbackEntry = {
        timestamp: new Date().toISOString(),
        error: error.message,
        data: this.sanitizePayload(data),
      };
      const line = JSON.stringify(fallbackEntry) + '\n';
      await fs.promises.appendFile(this.fallbackFile, line);
      this.logger.warn(
        `Audit log written to fallback file: ${this.fallbackFile}`,
      );
    } catch (fallbackError) {
      this.logger.error(
        'Failed to write to audit fallback file',
        fallbackError instanceof Error
          ? fallbackError.stack
          : String(fallbackError),
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async writeWithRetry(
    data: Partial<AuditLog>,
  ): Promise<AuditLog | null> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const auditLog = this.auditLogRepository.create(data);
        return await this.auditLogRepository.save(auditLog);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Audit write failed (attempt ${attempt}/${this.retryAttempts}), retrying in ${delay}ms: ${lastError.message}`,
          );
          await this.sleep(delay);
        }
      }
    }
    this.logger.error(
      `Audit write failed after ${this.retryAttempts} attempts, writing to fallback`,
    );
    await this.writeToFallback(data, lastError!);
    return null;
  }

  /**
   * Create an audit log entry with retry and fallback
   */
  async createAuditLog(data: Partial<AuditLog>): Promise<AuditLog | null> {
    if (!this.isEnabled) {
      return null;
    }
    const sanitizedData = {
      ...data,
      metadata: this.sanitizeMetadata(
        data.metadata as Record<string, unknown> | undefined,
      ),
    };
    const writePromise = this.writeWithRetry(sanitizedData);
    this.inFlightWrites.add(writePromise);
    writePromise.finally(() => {
      this.inFlightWrites.delete(writePromise);
    });
    return writePromise;
  }

  /**
   * Handle AuditLogEvent from the interceptor
   */
  @OnEvent(DomainEventNames.AUDIT_LOG)
  async handleAuditLogEvent(event: AuditLogEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId,
      statusCode: event.statusCode,
      metadata: event.metadata,
      ipAddress: event.ipAddress,
    });
  }

  /**
   * Handle UserLoggedInEvent
   */
  @OnEvent(DomainEventNames.USER_LOGGED_IN)
  async handleUserLoggedIn(event: UserLoggedInEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'USER_LOGIN',
      resource: 'auth',
      resourceId: event.userId,
      metadata: {
        email: event.email,
        timestamp: event.timestamp.toISOString(),
      },
      ipAddress: event.ipAddress,
    });
  }

  /**
   * Handle TenantAccessedEvent
   */
  @OnEvent(DomainEventNames.TENANT_ACCESSED)
  async handleTenantAccessed(event: TenantAccessedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'TENANT_ACCESS',
      resource: 'tenants',
      resourceId: event.tenantId,
      metadata: {
        endpoint: event.endpoint,
        method: event.method,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Find audit logs with optional filters
   */
  async findAll(options?: {
    tenantId?: string;
    userId?: string;
    action?: string;
    resource?: string;
    skip?: number;
    take?: number;
  }): Promise<AuditLog[]> {
    const query = this.auditLogRepository.createQueryBuilder('audit');

    if (options?.tenantId) {
      query.andWhere('audit.tenantId = :tenantId', {
        tenantId: options.tenantId,
      });
    }

    if (options?.userId) {
      query.andWhere('audit.userId = :userId', { userId: options.userId });
    }

    if (options?.action) {
      query.andWhere('audit.action = :action', { action: options.action });
    }

    if (options?.resource) {
      query.andWhere('audit.resource = :resource', {
        resource: options.resource,
      });
    }

    query.orderBy('audit.createdAt', 'DESC');

    if (options?.skip) {
      query.skip(options.skip);
    }

    if (options?.take) {
      query.take(options.take);
    }

    return query.getMany();
  }

  /**
   * Count audit logs for a tenant
   */
  async countForTenant(tenantId: string): Promise<number> {
    return this.auditLogRepository.count({ where: { tenantId } });
  }

  // ============================================
  // GRC Domain Event Handlers
  // ============================================

  /**
   * Handle RiskCreatedEvent
   */
  @OnEvent('risk.created')
  async handleRiskCreated(event: RiskCreatedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'RISK_CREATED',
      resource: 'grc_risks',
      resourceId: event.riskId,
      metadata: {
        title: event.title,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle RiskUpdatedEvent
   */
  @OnEvent('risk.updated')
  async handleRiskUpdated(event: RiskUpdatedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'RISK_UPDATED',
      resource: 'grc_risks',
      resourceId: event.riskId,
      metadata: {
        changes: event.changes,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle RiskDeletedEvent
   */
  @OnEvent('risk.deleted')
  async handleRiskDeleted(event: RiskDeletedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'RISK_DELETED',
      resource: 'grc_risks',
      resourceId: event.riskId,
      metadata: {
        title: event.title,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle PolicyCreatedEvent
   */
  @OnEvent('policy.created')
  async handlePolicyCreated(event: PolicyCreatedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'POLICY_CREATED',
      resource: 'grc_policies',
      resourceId: event.policyId,
      metadata: {
        name: event.name,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle PolicyUpdatedEvent
   */
  @OnEvent('policy.updated')
  async handlePolicyUpdated(event: PolicyUpdatedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'POLICY_UPDATED',
      resource: 'grc_policies',
      resourceId: event.policyId,
      metadata: {
        changes: event.changes,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle PolicyDeletedEvent
   */
  @OnEvent('policy.deleted')
  async handlePolicyDeleted(event: PolicyDeletedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'POLICY_DELETED',
      resource: 'grc_policies',
      resourceId: event.policyId,
      metadata: {
        name: event.name,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle RequirementCreatedEvent
   */
  @OnEvent('requirement.created')
  async handleRequirementCreated(event: RequirementCreatedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'REQUIREMENT_CREATED',
      resource: 'grc_requirements',
      resourceId: event.requirementId,
      metadata: {
        title: event.title,
        framework: event.framework,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle RequirementUpdatedEvent
   */
  @OnEvent('requirement.updated')
  async handleRequirementUpdated(event: RequirementUpdatedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'REQUIREMENT_UPDATED',
      resource: 'grc_requirements',
      resourceId: event.requirementId,
      metadata: {
        changes: event.changes,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle RequirementDeletedEvent
   */
  @OnEvent('requirement.deleted')
  async handleRequirementDeleted(event: RequirementDeletedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'REQUIREMENT_DELETED',
      resource: 'grc_requirements',
      resourceId: event.requirementId,
      metadata: {
        title: event.title,
        framework: event.framework,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }
}
