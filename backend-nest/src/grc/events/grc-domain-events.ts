/**
 * GRC Domain Events
 *
 * Events emitted when GRC entities are created, updated, or deleted.
 * These events integrate with the existing event bus infrastructure.
 */

export class RiskCreatedEvent {
  constructor(
    public readonly riskId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class RiskUpdatedEvent {
  constructor(
    public readonly riskId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly changes: Record<string, unknown>,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class RiskDeletedEvent {
  constructor(
    public readonly riskId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class PolicyCreatedEvent {
  constructor(
    public readonly policyId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class PolicyUpdatedEvent {
  constructor(
    public readonly policyId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly changes: Record<string, unknown>,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class PolicyDeletedEvent {
  constructor(
    public readonly policyId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class ControlCreatedEvent {
  constructor(
    public readonly controlId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class RequirementCreatedEvent {
  constructor(
    public readonly requirementId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly framework: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class RequirementUpdatedEvent {
  constructor(
    public readonly requirementId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly changes: Record<string, unknown>,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class RequirementDeletedEvent {
  constructor(
    public readonly requirementId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly framework: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class IssueCreatedEvent {
  constructor(
    public readonly issueId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly severity: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class IssueResolvedEvent {
  constructor(
    public readonly issueId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly resolution: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class CapaCreatedEvent {
  constructor(
    public readonly capaId: string,
    public readonly issueId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class EvidenceUploadedEvent {
  constructor(
    public readonly evidenceId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly location: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
