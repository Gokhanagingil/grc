/**
 * Test Data Factories
 *
 * Deterministic factory utilities for creating test data.
 * All factories use fixed values (no randomness) for reproducible tests.
 */

import { RiskSeverity, RiskLikelihood, RiskStatus, PolicyStatus, ComplianceFramework } from '../../src/grc/enums';

// ============================================
// Tenant Factory
// ============================================

export interface TenantFactoryData {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

/**
 * Create a deterministic tenant for testing
 */
export function tenantFactory(overrides: Partial<TenantFactoryData> = {}): TenantFactoryData {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Test Tenant',
    description: 'A test tenant for e2e testing',
    isActive: true,
    ...overrides,
  };
}

// ============================================
// User Factory
// ============================================

export interface UserFactoryData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  tenantId: string;
  isActive: boolean;
}

/**
 * Create a deterministic user for testing
 */
export function userFactory(overrides: Partial<UserFactoryData> = {}): UserFactoryData {
  return {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'test.user@grc-platform.local',
    firstName: 'Test',
    lastName: 'User',
    role: 'ADMIN',
    tenantId: '00000000-0000-0000-0000-000000000001',
    isActive: true,
    ...overrides,
  };
}

/**
 * Create an admin user for testing
 */
export function adminUserFactory(overrides: Partial<UserFactoryData> = {}): UserFactoryData {
  return userFactory({
    id: '00000000-0000-0000-0000-000000000003',
    email: 'admin@grc-platform.local',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    ...overrides,
  });
}

/**
 * Create a manager user for testing
 */
export function managerUserFactory(overrides: Partial<UserFactoryData> = {}): UserFactoryData {
  return userFactory({
    id: '00000000-0000-0000-0000-000000000004',
    email: 'manager@grc-platform.local',
    firstName: 'Manager',
    lastName: 'User',
    role: 'MANAGER',
    ...overrides,
  });
}

/**
 * Create a regular user for testing
 */
export function regularUserFactory(overrides: Partial<UserFactoryData> = {}): UserFactoryData {
  return userFactory({
    id: '00000000-0000-0000-0000-000000000005',
    email: 'user@grc-platform.local',
    firstName: 'Regular',
    lastName: 'User',
    role: 'USER',
    ...overrides,
  });
}

// ============================================
// Risk Factory
// ============================================

export interface RiskFactoryData {
  title: string;
  description: string;
  category: string;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  status: RiskStatus;
  owner: string;
  impactScore: number;
  riskScore: number;
  mitigationPlan: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

/**
 * Create a deterministic risk for testing
 */
export function riskFactory(overrides: Partial<RiskFactoryData> = {}): RiskFactoryData {
  return {
    title: 'Test Risk - Data Breach',
    description: 'Risk of unauthorized access to sensitive customer data through phishing attacks',
    category: 'Information Security',
    severity: RiskSeverity.HIGH,
    likelihood: RiskLikelihood.POSSIBLE,
    status: RiskStatus.IDENTIFIED,
    owner: 'security-team@company.com',
    impactScore: 8,
    riskScore: 64,
    mitigationPlan: 'Implement multi-factor authentication and security awareness training',
    tags: ['security', 'data-protection', 'phishing'],
    metadata: { source: 'internal-audit', reviewedBy: 'security-team' },
    ...overrides,
  };
}

/**
 * Create a high-severity risk for testing
 */
export function highSeverityRiskFactory(overrides: Partial<RiskFactoryData> = {}): RiskFactoryData {
  return riskFactory({
    title: 'Critical Infrastructure Failure',
    description: 'Risk of complete system outage due to single point of failure',
    severity: RiskSeverity.CRITICAL,
    likelihood: RiskLikelihood.LIKELY,
    impactScore: 10,
    riskScore: 100,
    ...overrides,
  });
}

/**
 * Create a low-severity risk for testing
 */
export function lowSeverityRiskFactory(overrides: Partial<RiskFactoryData> = {}): RiskFactoryData {
  return riskFactory({
    title: 'Minor Documentation Gap',
    description: 'Some internal procedures are not fully documented',
    severity: RiskSeverity.LOW,
    likelihood: RiskLikelihood.UNLIKELY,
    impactScore: 2,
    riskScore: 4,
    ...overrides,
  });
}

// ============================================
// Policy Factory
// ============================================

export interface PolicyFactoryData {
  name: string;
  code: string;
  version: string;
  status: PolicyStatus;
  category: string;
  summary: string;
  content: string;
  owner: string;
  effectiveDate: string;
  reviewDate: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

/**
 * Create a deterministic policy for testing
 */
export function policyFactory(overrides: Partial<PolicyFactoryData> = {}): PolicyFactoryData {
  return {
    name: 'Information Security Policy',
    code: 'POL-SEC-001',
    version: '1.0.0',
    status: PolicyStatus.DRAFT,
    category: 'Security',
    summary: 'Establishes the framework for protecting company information assets',
    content: 'This policy defines the requirements for protecting information assets...',
    owner: 'ciso@company.com',
    effectiveDate: '2025-01-01',
    reviewDate: '2026-01-01',
    tags: ['security', 'compliance', 'mandatory'],
    metadata: { department: 'IT', classification: 'internal' },
    ...overrides,
  };
}

/**
 * Create an active policy for testing
 */
export function activePolicyFactory(overrides: Partial<PolicyFactoryData> = {}): PolicyFactoryData {
  return policyFactory({
    name: 'Active Security Policy',
    code: 'POL-SEC-002',
    status: PolicyStatus.ACTIVE,
    ...overrides,
  });
}

/**
 * Create a policy due for review
 */
export function policyDueForReviewFactory(overrides: Partial<PolicyFactoryData> = {}): PolicyFactoryData {
  const pastDate = new Date();
  pastDate.setMonth(pastDate.getMonth() - 1);
  
  return policyFactory({
    name: 'Policy Due for Review',
    code: 'POL-REV-001',
    status: PolicyStatus.ACTIVE,
    reviewDate: pastDate.toISOString().split('T')[0],
    ...overrides,
  });
}

// ============================================
// Requirement Factory
// ============================================

export interface RequirementFactoryData {
  framework: ComplianceFramework;
  referenceCode: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  owner: string;
  dueDate: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

/**
 * Create a deterministic requirement for testing
 */
export function requirementFactory(overrides: Partial<RequirementFactoryData> = {}): RequirementFactoryData {
  return {
    framework: ComplianceFramework.ISO_27001,
    referenceCode: 'A.5.1.1',
    title: 'Information Security Policies',
    description: 'A set of policies for information security shall be defined, approved by management, published and communicated to employees and relevant external parties.',
    category: 'Policies',
    priority: 'High',
    status: 'Not Started',
    owner: 'compliance-team@company.com',
    dueDate: '2025-06-30',
    tags: ['iso27001', 'policies', 'mandatory'],
    metadata: { auditYear: '2025', assessor: 'external-auditor' },
    ...overrides,
  };
}

/**
 * Create a SOC2 requirement for testing
 */
export function soc2RequirementFactory(overrides: Partial<RequirementFactoryData> = {}): RequirementFactoryData {
  return requirementFactory({
    framework: ComplianceFramework.SOC2,
    referenceCode: 'CC1.1',
    title: 'Control Environment',
    description: 'The entity demonstrates a commitment to integrity and ethical values.',
    category: 'Common Criteria',
    ...overrides,
  });
}

/**
 * Create a GDPR requirement for testing
 */
export function gdprRequirementFactory(overrides: Partial<RequirementFactoryData> = {}): RequirementFactoryData {
  return requirementFactory({
    framework: ComplianceFramework.GDPR,
    referenceCode: 'Art.5',
    title: 'Principles relating to processing of personal data',
    description: 'Personal data shall be processed lawfully, fairly and in a transparent manner.',
    category: 'Data Protection Principles',
    ...overrides,
  });
}

/**
 * Create a compliant requirement for testing
 */
export function compliantRequirementFactory(overrides: Partial<RequirementFactoryData> = {}): RequirementFactoryData {
  return requirementFactory({
    title: 'Compliant Requirement',
    referenceCode: 'A.5.1.2',
    status: 'Compliant',
    ...overrides,
  });
}

// ============================================
// Invalid Data Factories (for validation testing)
// ============================================

/**
 * Create invalid risk data for validation testing
 */
export function invalidRiskFactory(): Record<string, unknown> {
  return {
    title: '', // Empty title (should fail MinLength validation)
    description: 'Valid description',
    severity: 'INVALID_SEVERITY', // Invalid enum value
    likelihood: 'INVALID_LIKELIHOOD', // Invalid enum value
    status: 'INVALID_STATUS', // Invalid enum value
    impactScore: 15, // Out of range (should be 1-10)
    riskScore: -5, // Negative value (should be positive)
  };
}

/**
 * Create invalid policy data for validation testing
 */
export function invalidPolicyFactory(): Record<string, unknown> {
  return {
    name: '', // Empty name (should fail MinLength validation)
    code: 'invalid code with spaces', // Invalid format
    version: 'not-semver', // Invalid version format
    status: 'INVALID_STATUS', // Invalid enum value
    effectiveDate: 'not-a-date', // Invalid date format
    reviewDate: '2020-01-01', // Review date before effective date
  };
}

/**
 * Create invalid requirement data for validation testing
 */
export function invalidRequirementFactory(): Record<string, unknown> {
  return {
    framework: 'INVALID_FRAMEWORK', // Invalid enum value
    referenceCode: '', // Empty reference code
    title: '', // Empty title (should fail MinLength validation)
    priority: 'INVALID_PRIORITY', // Invalid priority value
    status: 'INVALID_STATUS', // Invalid status value
  };
}

// ============================================
// Batch Factories
// ============================================

/**
 * Create multiple risks with sequential IDs
 */
export function riskBatchFactory(count: number, baseOverrides: Partial<RiskFactoryData> = {}): RiskFactoryData[] {
  return Array.from({ length: count }, (_, index) =>
    riskFactory({
      title: `Test Risk ${index + 1}`,
      ...baseOverrides,
    }),
  );
}

/**
 * Create multiple policies with sequential IDs
 */
export function policyBatchFactory(count: number, baseOverrides: Partial<PolicyFactoryData> = {}): PolicyFactoryData[] {
  return Array.from({ length: count }, (_, index) =>
    policyFactory({
      name: `Test Policy ${index + 1}`,
      code: `POL-TEST-${String(index + 1).padStart(3, '0')}`,
      ...baseOverrides,
    }),
  );
}

/**
 * Create multiple requirements with sequential IDs
 */
export function requirementBatchFactory(count: number, baseOverrides: Partial<RequirementFactoryData> = {}): RequirementFactoryData[] {
  return Array.from({ length: count }, (_, index) =>
    requirementFactory({
      title: `Test Requirement ${index + 1}`,
      referenceCode: `A.TEST.${index + 1}`,
      ...baseOverrides,
    }),
  );
}
