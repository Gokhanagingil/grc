/**
 * CMDB Baseline Content Pack — Version Identity
 *
 * Tracks the version of the baseline content pack. Used for idempotency checks,
 * audit logging, and future upgrade paths.
 */

/** Current content pack version */
export const CMDB_BASELINE_CONTENT_PACK_VERSION = 'v1.0.0';

/** Content pack metadata stored in class/relationship type metadata fields */
export const CONTENT_PACK_SOURCE = 'system_baseline_v1';

/** Metadata key used to tag baseline-managed records */
export const CONTENT_PACK_META_KEY = 'contentPackVersion';
