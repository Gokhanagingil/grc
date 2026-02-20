/**
 * Audit Detail Response Normalizer
 *
 * Centralizes normalization of audit detail API responses to prevent
 * "Something went wrong" crashes caused by missing/undefined arrays.
 *
 * This normalizer ensures all expected array fields are always arrays,
 * using `Array.isArray(x) ? x : []` pattern to handle malformed objects.
 */

/**
 * Audit permissions structure
 */
export interface AuditPermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  maskedFields: string[];
  deniedFields: string[];
}

/**
 * Finding structure with nested arrays
 */
export interface Finding {
  id: string;
  auditId: string;
  title: string;
  description: string | null;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  ownerUserId?: string;
  owner?: { firstName?: string; lastName?: string };
  dueDate?: string;
  capas?: Array<{ id: string }>;
  issueRequirements?: Array<{ id: string; requirementId: string }>;
  createdAt: string;
}

/**
 * Audit requirement structure
 */
export interface AuditRequirement {
  id: string;
  auditId: string;
  requirementId: string;
  status: 'planned' | 'in_scope' | 'sampled' | 'tested' | 'completed';
  notes?: string;
  framework?: string;
  referenceCode?: string;
  title?: string;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  requirement?: {
    id: string;
    framework: string;
    referenceCode: string;
    title: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
  };
  createdAt: string;
}

/**
 * Audit report structure
 */
export interface AuditReport {
  id: number;
  audit_id: number;
  version: number;
  status: 'draft' | 'under_review' | 'final' | 'archived';
  created_by: number;
  created_by_first_name?: string;
  created_by_last_name?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Available requirement structure (for adding to audit scope)
 */
export interface AvailableRequirement {
  id: string;
  framework: string;
  referenceCode: string;
  title: string;
}

/**
 * Ensures a value is an array, returning empty array if not.
 * Uses strict Array.isArray check to handle malformed objects.
 */
function ensureArrayField<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Normalizes audit permissions to ensure array fields are always arrays.
 * Returns a safe default if input is null/undefined.
 */
export function normalizeAuditPermissions(
  raw: unknown
): AuditPermissions {
  if (!raw || typeof raw !== 'object') {
    return {
      read: true,
      write: false,
      delete: false,
      maskedFields: [],
      deniedFields: [],
    };
  }

  const permissions = raw as Record<string, unknown>;

  return {
    read: typeof permissions.read === 'boolean' ? permissions.read : true,
    write: typeof permissions.write === 'boolean' ? permissions.write : false,
    delete: typeof permissions.delete === 'boolean' ? permissions.delete : false,
    maskedFields: ensureArrayField<string>(permissions.maskedFields),
    deniedFields: ensureArrayField<string>(permissions.deniedFields),
  };
}

/**
 * Normalizes a single finding to ensure nested arrays are always arrays.
 */
export function normalizeFinding(raw: unknown): Finding | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const finding = raw as Record<string, unknown>;

  return {
    id: String(finding.id || ''),
    auditId: String(finding.auditId || ''),
    title: String(finding.title || ''),
    description: finding.description as string | null,
    type: String(finding.type || ''),
    severity: (finding.severity as Finding['severity']) || 'medium',
    status: String(finding.status || ''),
    ownerUserId: finding.ownerUserId as string | undefined,
    owner: finding.owner as Finding['owner'],
    dueDate: finding.dueDate as string | undefined,
    capas: ensureArrayField<{ id: string }>(finding.capas),
    issueRequirements: ensureArrayField<{ id: string; requirementId: string }>(
      finding.issueRequirements
    ),
    createdAt: String(finding.createdAt || ''),
  };
}

/**
 * Normalizes an array of findings, ensuring each finding has normalized nested arrays.
 */
export function normalizeFindings(raw: unknown): Finding[] {
  const findings = ensureArrayField<unknown>(raw);
  return findings
    .map(normalizeFinding)
    .filter((f): f is Finding => f !== null);
}

/**
 * Normalizes an array of audit requirements.
 */
export function normalizeAuditRequirements(raw: unknown): AuditRequirement[] {
  return ensureArrayField<AuditRequirement>(raw);
}

/**
 * Normalizes an array of audit reports.
 */
export function normalizeAuditReports(raw: unknown): AuditReport[] {
  return ensureArrayField<AuditReport>(raw);
}

/**
 * Normalizes an array of available requirements.
 */
export function normalizeAvailableRequirements(
  raw: unknown
): AvailableRequirement[] {
  return ensureArrayField<AvailableRequirement>(raw);
}

/**
 * Normalized audit detail related data structure
 */
export interface NormalizedAuditRelatedData {
  findings: Finding[];
  auditRequirements: AuditRequirement[];
  reports: AuditReport[];
}

/**
 * Normalizes all audit-related data from API responses.
 * This is the main entry point for normalizing audit detail page data.
 *
 * @param findingsRaw - Raw findings response
 * @param requirementsRaw - Raw audit requirements response
 * @param reportsRaw - Raw reports response
 * @returns Normalized data with guaranteed array fields
 */
export function normalizeAuditRelatedData(
  findingsRaw: unknown,
  requirementsRaw: unknown,
  reportsRaw: unknown
): NormalizedAuditRelatedData {
  return {
    findings: normalizeFindings(findingsRaw),
    auditRequirements: normalizeAuditRequirements(requirementsRaw),
    reports: normalizeAuditReports(reportsRaw),
  };
}
