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

/**
 * Audit Service
 *
 * Handles persistence of audit log entries.
 * Listens to domain events and creates audit records.
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
