/**
 * ITSM Incident filter tree compiler (v1).
 *
 * Converts the platform filter tree into the existing incident list query params.
 * Only supported fields/operators are applied; unsupported ones are reported for UX.
 */

import type { FilterTree, FilterCondition } from '../components/common/AdvancedFilter/types';
import { extractFilterConditions } from './listQueryUtils';

/** v1 supported incident list query params (no backend DSL) */
export interface IncidentListQueryParams {
  state?: string;
  priority?: string;
  customerCompanyId?: string;
  assigneeId?: string;
  serviceId?: string;
  category?: string;
  createdAtAfter?: string;
  createdAtBefore?: string;
}

/** Result of compiling a filter tree: params to send + any unsupported field names for UX */
export interface CompileIncidentFilterResult {
  params: IncidentListQueryParams;
  unsupported: string[];
}

const SUPPORTED_FIELDS = new Set([
  'state',
  'status', // map to state
  'priority',
  'customerCompanyId',
  'assignedTo', // map to assigneeId
  'serviceId',
  'category',
  'subcategory', // map to category for now
  'createdAt',
]);

function isSupportedField(field: string): boolean {
  return SUPPORTED_FIELDS.has(field);
}

function valueToString(v: string | number | boolean | undefined): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function parseDateValue(v: unknown): string | undefined {
  const s = valueToString(v as string);
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/**
 * Compile a single condition into a query param entry.
 * Returns the param key and value if supported and applicable; otherwise reports unsupported.
 */
function compileCondition(
  c: FilterCondition,
  unsupported: string[]
): Partial<IncidentListQueryParams> {
  const field = (c.field || '').trim();
  const op = c.op;
  const value = c.value;

  if (!field) return {};

  const rawValue = valueToString(value);
  const dateValue = parseDateValue(value);

  // Normalize field name for backend
  const normalizedField =
    field === 'status' ? 'state' : field === 'assignedTo' ? 'assigneeId' : field === 'subcategory' ? 'category' : field;

  if (!isSupportedField(field)) {
    if (!unsupported.includes(field)) unsupported.push(field);
    return {};
  }

  // Operators that don't need a value
  if (op === 'is_empty' || op === 'is_not_empty') {
    // Backend doesn't support "is empty" as a simple param; we could skip or add later
    if (normalizedField === 'customerCompanyId' && op === 'is_empty') {
      // Some backends support "no company" - for v1 we skip
      return {};
    }
    if (normalizedField === 'customerCompanyId' && op === 'is_not_empty') {
      return {};
    }
    return {};
  }

  switch (normalizedField) {
    case 'state':
      if (op === 'is' && rawValue) return { state: rawValue };
      if (op === 'is_not') return {}; // no backend param for "state is not"
      return {};
    case 'priority':
      if (op === 'is' && rawValue) return { priority: rawValue };
      return {};
    case 'customerCompanyId':
      if (op === 'is' && rawValue) return { customerCompanyId: rawValue };
      return {};
    case 'assigneeId':
      if (op === 'is' && rawValue) return { assigneeId: rawValue };
      return {};
    case 'serviceId':
      if (op === 'is' && rawValue) return { serviceId: rawValue };
      return {};
    case 'category':
      if (op === 'is' && rawValue) return { category: rawValue };
      if (op === 'contains' && rawValue) return { category: rawValue }; // backend may do ILIKE
      return {};
    case 'createdAt':
      if (op === 'after' && dateValue) return { createdAtAfter: dateValue };
      if (op === 'before' && dateValue) return { createdAtBefore: dateValue };
      return {};
    default:
      return {};
  }
}

/**
 * Compile a filter tree into incident list query params (v1).
 * Only supported fields/operators are applied; others are collected in unsupported for UX.
 */
export function compileIncidentFilterTreeToQuery(tree: FilterTree | null): CompileIncidentFilterResult {
  const unsupported: string[] = [];
  const params: IncidentListQueryParams = {};

  if (!tree) {
    return { params, unsupported };
  }

  const conditions = extractFilterConditions(tree);
  for (const c of conditions) {
    const part = compileCondition(c, unsupported);
    Object.assign(params, part);
  }

  return { params, unsupported };
}
