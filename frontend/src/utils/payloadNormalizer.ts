/**
 * Payload Normalization Utilities
 *
 * Reusable helpers for sanitizing frontend payloads before sending to
 * backend APIs. Prevents "Validation failed" errors caused by:
 * - Forbidden/readonly fields leaking into update payloads
 * - Empty strings where backend expects undefined/null
 * - Undefined values being serialized as explicit keys
 *
 * Created for: Activation Stabilization Pack v3 (A/B/C fixes)
 */

/**
 * Strip keys from an object that are not in the allowed set.
 * Prevents `forbidNonWhitelisted` rejections from class-validator.
 *
 * @param payload - The raw payload object
 * @param allowedKeys - Set of keys that the backend DTO accepts
 * @returns A new object containing only allowed keys
 */
export function stripForbiddenFields<T extends Record<string, unknown>>(
  payload: T,
  allowedKeys: ReadonlySet<string>,
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    if (allowedKeys.has(key)) {
      result[key] = payload[key];
    }
  }
  return result as Partial<T>;
}

/**
 * Remove keys whose value is `undefined` from a payload object.
 * JSON.stringify already strips undefined, but this makes it explicit
 * and prevents keys from being sent in non-JSON transports.
 *
 * @param payload - The payload to clean
 * @returns A new object without undefined-valued keys
 */
export function stripUndefined<T extends Record<string, unknown>>(
  payload: T,
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Convert empty strings to undefined for optional fields.
 * Backend DTOs with @IsEnum / @IsDateString / @IsUUID reject empty strings.
 *
 * @param value - The field value
 * @returns The value if non-empty, otherwise undefined
 */
export function emptyToUndefined(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return value;
}

/**
 * Normalize a full update payload:
 * 1. Convert empty strings to undefined for specified fields
 * 2. Strip forbidden fields not in the DTO allowlist
 * 3. Remove undefined keys
 *
 * @param raw - Raw payload from form state
 * @param allowedKeys - Keys accepted by the backend DTO
 * @param emptyStringFields - Fields where empty string should become undefined
 * @returns Clean payload ready for API submission
 */
export function normalizeUpdatePayload<T extends Record<string, unknown>>(
  raw: T,
  allowedKeys: ReadonlySet<string>,
  emptyStringFields?: ReadonlySet<string>,
): Partial<T> {
  const processed: Record<string, unknown> = { ...raw };

  // Step 1: Convert empty strings to undefined for specified fields
  if (emptyStringFields) {
    emptyStringFields.forEach((field) => {
      if (field in processed && typeof processed[field] === 'string') {
        processed[field] = emptyToUndefined(processed[field] as string);
      }
    });
  }

  // Step 2: Strip forbidden fields
  const filtered = stripForbiddenFields(processed as T, allowedKeys);

  // Step 3: Remove undefined keys
  return stripUndefined(filtered as Record<string, unknown>) as Partial<T>;
}

// ── DTO field allowlists ──────────────────────────────────────────────
// These must match the backend DTO definitions exactly.

/** Fields accepted by UpdateCabMeetingDto */
export const CAB_MEETING_UPDATE_FIELDS = new Set([
  'title',
  'meetingAt',
  'endAt',
  'status',
  'chairpersonId',
  'notes',
  'summary',
]);

/** Fields accepted by CreateCabMeetingDto */
export const CAB_MEETING_CREATE_FIELDS = new Set([
  'title',
  'meetingAt',
  'endAt',
  'status',
  'chairpersonId',
  'notes',
  'summary',
]);

/** Fields accepted by UpdateChangeTemplateDto */
export const CHANGE_TEMPLATE_UPDATE_FIELDS = new Set([
  'name',
  'description',
  'isActive',
  'isGlobal',
  'tasks',
  'dependencies',
]);

/** Fields accepted by CreateChangeTemplateDto */
export const CHANGE_TEMPLATE_CREATE_FIELDS = new Set([
  'name',
  'code',
  'description',
  'isActive',
  'isGlobal',
]);

/** Fields accepted by UpdateIncidentDto */
export const INCIDENT_UPDATE_FIELDS = new Set([
  'shortDescription',
  'description',
  'category',
  'impact',
  'urgency',
  'status',
  'source',
  'assignmentGroup',
  'assignedTo',
  'relatedService',
  'serviceId',
  'offeringId',
  'relatedRiskId',
  'relatedPolicyId',
  'firstResponseAt',
  'resolutionNotes',
  'metadata',
]);

/** Fields accepted by CreateIncidentDto */
export const INCIDENT_CREATE_FIELDS = new Set([
  'shortDescription',
  'description',
  'category',
  'impact',
  'urgency',
  'source',
  'assignmentGroup',
  'assignedTo',
  'relatedService',
  'serviceId',
  'offeringId',
  'relatedRiskId',
  'relatedPolicyId',
  'metadata',
]);

/** Fields where empty string should become undefined (enum/date/uuid fields) */
export const INCIDENT_EMPTY_STRING_FIELDS = new Set([
  'category',
  'impact',
  'urgency',
  'status',
  'source',
  'serviceId',
  'offeringId',
  'relatedRiskId',
  'relatedPolicyId',
  'firstResponseAt',
  'assignmentGroup',
  'assignedTo',
  'relatedService',
]);

/** CAB meeting fields where empty string should become undefined */
export const CAB_MEETING_EMPTY_STRING_FIELDS = new Set([
  'meetingAt',
  'endAt',
  'status',
  'chairpersonId',
]);
