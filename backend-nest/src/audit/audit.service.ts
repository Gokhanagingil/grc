import { Injectable } from '@nestjs/common';
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
import { ConfigService } from '@nestjs/config';
import { AuditAction } from '../grc/enums';

/**
 * Audit Service
 *
 * Handles persistence of audit log entries.
 * Listens to domain events and creates audit records.
 * Provides methods for recording entity-level changes (create, update, delete).
 */
@Injectable()
export class AuditService {
  private readonly isEnabled: boolean;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {
    this.isEnabled =
      this.configService.get<string>('audit.enabled', 'true') === 'true';
  }

  /**
   * Create an audit log entry directly
   */
  async createAuditLog(data: Partial<AuditLog>): Promise<AuditLog | null> {
    if (!this.isEnabled) {
      return null;
    }

    const auditLog = this.auditLogRepository.create(data);
    return this.auditLogRepository.save(auditLog);
  }

  /**
   * Record a CREATE action for an entity
   * @param entityName - Name of the entity class (e.g., 'GrcRisk', 'GrcPolicy')
   * @param entity - The created entity object
   * @param actorId - ID of the user who performed the action
   * @param tenantId - Optional tenant ID
   */
  async recordCreate(
    entityName: string,
    entity: { id: string; [key: string]: unknown },
    actorId: string | null,
    tenantId?: string | null,
  ): Promise<AuditLog | null> {
    if (!this.isEnabled) {
      return null;
    }

    return this.createAuditLog({
      action: AuditAction.CREATE,
      entityName,
      entityId: entity.id,
      resource: this.entityNameToResource(entityName),
      resourceId: entity.id,
      afterState: this.sanitizeEntity(entity),
      beforeState: null,
      userId: actorId,
      tenantId: tenantId ?? null,
    });
  }

  /**
   * Record an UPDATE action for an entity
   * @param entityName - Name of the entity class (e.g., 'GrcRisk', 'GrcPolicy')
   * @param entityId - ID of the entity being updated
   * @param before - State of the entity before the update
   * @param after - State of the entity after the update
   * @param actorId - ID of the user who performed the action
   * @param tenantId - Optional tenant ID
   */
  async recordUpdate(
    entityName: string,
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    actorId: string | null,
    tenantId?: string | null,
  ): Promise<AuditLog | null> {
    if (!this.isEnabled) {
      return null;
    }

    return this.createAuditLog({
      action: AuditAction.UPDATE,
      entityName,
      entityId,
      resource: this.entityNameToResource(entityName),
      resourceId: entityId,
      beforeState: this.sanitizeEntity(before),
      afterState: this.sanitizeEntity(after),
      userId: actorId,
      tenantId: tenantId ?? null,
    });
  }

  /**
   * Record a DELETE action for an entity
   * @param entityName - Name of the entity class (e.g., 'GrcRisk', 'GrcPolicy')
   * @param entity - The entity being deleted
   * @param actorId - ID of the user who performed the action
   * @param tenantId - Optional tenant ID
   */
  async recordDelete(
    entityName: string,
    entity: { id: string; [key: string]: unknown },
    actorId: string | null,
    tenantId?: string | null,
  ): Promise<AuditLog | null> {
    if (!this.isEnabled) {
      return null;
    }

    return this.createAuditLog({
      action: AuditAction.DELETE,
      entityName,
      entityId: entity.id,
      resource: this.entityNameToResource(entityName),
      resourceId: entity.id,
      beforeState: this.sanitizeEntity(entity),
      afterState: null,
      userId: actorId,
      tenantId: tenantId ?? null,
    });
  }

  /**
   * Convert entity class name to resource name
   * e.g., 'GrcRisk' -> 'risks', 'GrcPolicy' -> 'policies'
   */
  private entityNameToResource(entityName: string): string {
    const mapping: Record<string, string> = {
      GrcRisk: 'risks',
      GrcPolicy: 'policies',
      GrcRequirement: 'requirements',
      GrcControl: 'controls',
      GrcIssue: 'issues',
      GrcCapa: 'capas',
      GrcEvidence: 'evidence',
      User: 'users',
      Tenant: 'tenants',
    };
    return mapping[entityName] || entityName.toLowerCase();
  }

  /**
   * Sanitize entity for storage in audit log
   * Removes sensitive fields and circular references
   */
  private sanitizeEntity(
    entity: Record<string, unknown>,
  ): Record<string, unknown> {
    const sensitiveFields = ['passwordHash', 'password', 'token', 'secret'];
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(entity)) {
      if (sensitiveFields.includes(key)) {
        result[key] = '[REDACTED]';
      } else if (value instanceof Date) {
        result[key] = value.toISOString();
      } else if (typeof value === 'object' && value !== null) {
        if (
          'id' in value &&
          typeof (value as { id: unknown }).id === 'string'
        ) {
          result[key] = { id: (value as { id: string }).id };
        }
      } else {
        result[key] = value;
      }
    }

    return result;
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
      correlationId: event.correlationId,
      latencyMs: event.latencyMs,
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
}
