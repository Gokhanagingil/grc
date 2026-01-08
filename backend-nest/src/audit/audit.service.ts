import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLog } from './audit-log.entity';
import {
  AuditLogEvent,
  UserLoggedInEvent,
  TenantAccessedEvent,
  LoginFailedEvent,
  MfaEnabledEvent,
  MfaDisabledEvent,
  MfaChallengeFailedEvent,
  LdapAuthAttemptEvent,
  RoleChangedEvent,
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
  async recordCreate<T extends { id: string }>(
    entityName: string,
    entity: T,
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
      afterState: this.sanitizeEntity(
        entity as unknown as Record<string, unknown>,
      ),
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
  async recordDelete<T extends { id: string }>(
    entityName: string,
    entity: T,
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
      beforeState: this.sanitizeEntity(
        entity as unknown as Record<string, unknown>,
      ),
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
      const sanitizedValue = this.sanitizeValue(key, value, sensitiveFields);
      if (sanitizedValue !== undefined) {
        Object.defineProperty(result, key, {
          value: sanitizedValue,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }

    return result;
  }

  /**
   * Sanitize a single value for audit logging
   * Returns undefined if the value should be skipped
   */
  private sanitizeValue(
    key: string,
    value: unknown,
    sensitiveFields: string[],
  ): unknown {
    if (sensitiveFields.includes(key)) {
      return '[REDACTED]';
    } else if (value instanceof Date) {
      return value.toISOString();
    } else if (typeof value === 'object' && value !== null) {
      if (
        'id' in value &&
        typeof (value as { id: unknown }).id === 'string'
      ) {
        return { id: (value as { id: string }).id };
      }
      return undefined;
    } else {
      return value;
    }
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

  // ==================== Security Event Handlers (FAZ 3) ====================

  /**
   * Handle LoginFailedEvent
   */
  @OnEvent(DomainEventNames.LOGIN_FAILED)
  async handleLoginFailed(event: LoginFailedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: null,
      tenantId: event.tenantId,
      action: 'LOGIN_FAILED',
      resource: 'auth',
      resourceId: null,
      metadata: {
        email: event.email,
        reason: event.reason,
        timestamp: event.timestamp.toISOString(),
      },
      ipAddress: event.ipAddress,
    });
  }

  /**
   * Handle MfaEnabledEvent
   */
  @OnEvent(DomainEventNames.MFA_ENABLED)
  async handleMfaEnabled(event: MfaEnabledEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'MFA_ENABLED',
      resource: 'auth',
      resourceId: event.userId,
      metadata: {
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle MfaDisabledEvent
   */
  @OnEvent(DomainEventNames.MFA_DISABLED)
  async handleMfaDisabled(event: MfaDisabledEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'MFA_DISABLED',
      resource: 'auth',
      resourceId: event.userId,
      metadata: {
        disabledBy: event.disabledBy,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle MfaChallengeFailedEvent
   */
  @OnEvent(DomainEventNames.MFA_CHALLENGE_FAILED)
  async handleMfaChallengeFailed(
    event: MfaChallengeFailedEvent,
  ): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'MFA_CHALLENGE_FAILED',
      resource: 'auth',
      resourceId: event.userId,
      metadata: {
        context: event.context,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle LdapAuthAttemptEvent
   */
  @OnEvent(DomainEventNames.LDAP_AUTH_ATTEMPT)
  async handleLdapAuthAttempt(event: LdapAuthAttemptEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: null,
      tenantId: event.tenantId,
      action: event.success ? 'LDAP_AUTH_SUCCESS' : 'LDAP_AUTH_FAILED',
      resource: 'auth',
      resourceId: null,
      metadata: {
        username: event.username,
        success: event.success,
        errorMessage: event.errorMessage,
        timestamp: event.timestamp.toISOString(),
      },
    });
  }

  /**
   * Handle RoleChangedEvent
   */
  @OnEvent(DomainEventNames.ROLE_CHANGED)
  async handleRoleChanged(event: RoleChangedEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.createAuditLog({
      userId: event.userId,
      tenantId: event.tenantId,
      action: 'ROLE_CHANGED',
      resource: 'users',
      resourceId: event.userId,
      metadata: {
        oldRole: event.oldRole,
        newRole: event.newRole,
        changedBy: event.changedBy,
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
   * Count audit logs for a tenant with optional filters
   */
  async countForTenant(
    tenantId: string,
    filters?: { userId?: string; action?: string },
  ): Promise<number> {
    const query = this.auditLogRepository.createQueryBuilder('audit');
    query.where('audit.tenantId = :tenantId', { tenantId });

    if (filters?.userId) {
      query.andWhere('audit.userId = :userId', { userId: filters.userId });
    }

    if (filters?.action) {
      query.andWhere('audit.action = :action', { action: filters.action });
    }

    return query.getCount();
  }
}
