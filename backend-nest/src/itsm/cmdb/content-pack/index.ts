/**
 * CMDB Baseline Content Pack v1 — Public API
 */
export {
  CMDB_BASELINE_CONTENT_PACK_VERSION,
  CONTENT_PACK_SOURCE,
  CONTENT_PACK_META_KEY,
} from './version';
export { CLASS_IDS, BASELINE_CLASSES, type BaselineClassDef } from './classes';
export {
  RELTYPE_IDS,
  BASELINE_RELATIONSHIP_TYPES,
  type BaselineRelTypeDef,
} from './relationship-types';
export {
  RULE_IDS,
  BASELINE_CLASS_RELATIONSHIP_RULES,
  type BaselineClassRelRuleDef,
} from './class-relationship-rules';
export {
  applyBaselineContentPack,
  type ContentPackApplyOptions,
  type ContentPackApplyResult,
  type SeedAction,
  type SeedActionRecord,
} from './apply';
