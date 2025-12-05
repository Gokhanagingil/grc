/**
 * Domain Events
 *
 * Typed event classes for the event bus.
 * These events are emitted by various parts of the application
 * and handled by event listeners for audit logging, notifications, etc.
 */

/**
 * Base event class with common properties
 */
export abstract class BaseDomainEvent {
  readonly timestamp: Date;

  constructor() {
    this.timestamp = new Date();
  }
}

/**
 * Emitted when a user successfully logs in
 */
export class UserLoggedInEvent extends BaseDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly tenantId: string | null,
    public readonly ipAddress?: string,
  ) {
    super();
  }
}

/**
 * Emitted when a user accesses a tenant-protected resource
 */
export class TenantAccessedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly endpoint: string,
    public readonly method: string,
  ) {
    super();
  }
}

/**
 * Emitted by the audit interceptor for general API access logging
 */
export class AuditLogEvent extends BaseDomainEvent {
  constructor(
    public readonly userId: string | null,
    public readonly tenantId: string | null,
    public readonly action: string,
    public readonly resource: string,
    public readonly resourceId: string | null,
    public readonly metadata: Record<string, unknown>,
    public readonly statusCode: number,
    public readonly ipAddress?: string,
    public readonly correlationId?: string,
    public readonly latencyMs?: number,
  ) {
    super();
  }
}

/**
 * Event names as constants for type safety
 */
export const DomainEventNames = {
  USER_LOGGED_IN: 'user.logged_in',
  TENANT_ACCESSED: 'tenant.accessed',
  AUDIT_LOG: 'audit.log',
} as const;
