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
 * Emitted when MFA is enabled for a user
 */
export class MfaEnabledEvent extends BaseDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly tenantId: string | null,
  ) {
    super();
  }
}

/**
 * Emitted when MFA is disabled for a user
 */
export class MfaDisabledEvent extends BaseDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly tenantId: string | null,
    public readonly disabledBy: string,
  ) {
    super();
  }
}

/**
 * Emitted when MFA challenge fails
 */
export class MfaChallengeFailedEvent extends BaseDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly tenantId: string | null,
    public readonly context: string,
  ) {
    super();
  }
}

/**
 * Emitted when a user login fails
 */
export class LoginFailedEvent extends BaseDomainEvent {
  constructor(
    public readonly email: string,
    public readonly tenantId: string | null,
    public readonly reason: string,
    public readonly ipAddress?: string,
  ) {
    super();
  }
}

/**
 * Emitted when LDAP authentication is attempted
 */
export class LdapAuthAttemptEvent extends BaseDomainEvent {
  constructor(
    public readonly username: string,
    public readonly tenantId: string,
    public readonly success: boolean,
    public readonly errorMessage?: string,
  ) {
    super();
  }
}

/**
 * Emitted when a user's role is changed
 */
export class RoleChangedEvent extends BaseDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly tenantId: string | null,
    public readonly oldRole: string,
    public readonly newRole: string,
    public readonly changedBy: string,
  ) {
    super();
  }
}

/**
 * Event names as constants for type safety
 */
export const DomainEventNames = {
  USER_LOGGED_IN: 'user.logged_in',
  LOGIN_FAILED: 'user.login_failed',
  TENANT_ACCESSED: 'tenant.accessed',
  AUDIT_LOG: 'audit.log',
  MFA_ENABLED: 'mfa.enabled',
  MFA_DISABLED: 'mfa.disabled',
  MFA_CHALLENGE_FAILED: 'mfa.challenge_failed',
  LDAP_AUTH_ATTEMPT: 'ldap.auth_attempt',
  ROLE_CHANGED: 'user.role_changed',
} as const;
