/**
 * CMDB Baseline Content Pack v1 — Class Relationship Rule Definitions
 *
 * Defines baseline class-level relationship rules that govern which
 * relationship types each class can initiate. Rules use deterministic UUIDs
 * and reference class IDs and relationship type IDs from the baseline pack.
 *
 * These rules form the default "allow-list" for class-level relationship
 * governance. Child classes inherit parent rules via the effective rules engine.
 */

import { CLASS_IDS } from './classes';
import { RELTYPE_IDS } from './relationship-types';

// ============================================================================
// Deterministic UUIDs — Class Relationship Rules
// Prefix: cr100000-0000-0000-0000-0000000000xx
// ============================================================================

export const RULE_IDS = {
  // Application → depends_on → Database
  app_depends_on_db: 'cr100000-0000-0000-0000-000000000001',
  // Application → runs_on → Server
  app_runs_on_server: 'cr100000-0000-0000-0000-000000000002',
  // Application → connects_to → Application
  app_connects_to_app: 'cr100000-0000-0000-0000-000000000003',
  // Server → hosted_on → Hardware
  server_hosted_on_hw: 'cr100000-0000-0000-0000-000000000004',
  // Database → backed_by → Storage
  db_backed_by_storage: 'cr100000-0000-0000-0000-000000000005',
  // Database → runs_on → Server
  db_runs_on_server: 'cr100000-0000-0000-0000-000000000006',
  // Service → depends_on → Application
  svc_depends_on_app: 'cr100000-0000-0000-0000-000000000007',
  // Service → depends_on → Database
  svc_depends_on_db: 'cr100000-0000-0000-0000-000000000008',
  // Network Device → connects_to → Network Device
  netdev_connects_to_netdev: 'cr100000-0000-0000-0000-000000000009',
  // Server → contains → Virtual Machine
  server_contains_vm: 'cr100000-0000-0000-0000-000000000010',
  // Database Instance → replicates_to → Database Instance
  dbi_replicates_to_dbi: 'cr100000-0000-0000-0000-000000000011',
  // Application → used_by → Service
  app_used_by_svc: 'cr100000-0000-0000-0000-000000000012',
} as const;

/**
 * Seed definition for a class relationship rule in the baseline content pack.
 */
export interface BaselineClassRelRuleDef {
  id: string;
  sourceClassId: string;
  relationshipTypeId: string;
  targetClassId: string;
  direction: 'OUTBOUND' | 'INBOUND';
  propagationOverride: string | null;
  propagationWeight: string | null;
}

/**
 * Complete list of baseline class relationship rule definitions.
 */
export const BASELINE_CLASS_RELATIONSHIP_RULES: BaselineClassRelRuleDef[] = [
  // Application → depends_on → Database
  {
    id: RULE_IDS.app_depends_on_db,
    sourceClassId: CLASS_IDS.cmdb_ci_application,
    relationshipTypeId: RELTYPE_IDS.depends_on,
    targetClassId: CLASS_IDS.cmdb_ci_database,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'HIGH',
  },
  // Application → runs_on → Server
  {
    id: RULE_IDS.app_runs_on_server,
    sourceClassId: CLASS_IDS.cmdb_ci_application,
    relationshipTypeId: RELTYPE_IDS.runs_on,
    targetClassId: CLASS_IDS.cmdb_ci_server,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'HIGH',
  },
  // Application → connects_to → Application
  {
    id: RULE_IDS.app_connects_to_app,
    sourceClassId: CLASS_IDS.cmdb_ci_application,
    relationshipTypeId: RELTYPE_IDS.connects_to,
    targetClassId: CLASS_IDS.cmdb_ci_application,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'MEDIUM',
  },
  // Server → hosted_on → Hardware
  {
    id: RULE_IDS.server_hosted_on_hw,
    sourceClassId: CLASS_IDS.cmdb_ci_server,
    relationshipTypeId: RELTYPE_IDS.hosted_on,
    targetClassId: CLASS_IDS.cmdb_ci_hardware,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'HIGH',
  },
  // Database → backed_by → Storage
  {
    id: RULE_IDS.db_backed_by_storage,
    sourceClassId: CLASS_IDS.cmdb_ci_database,
    relationshipTypeId: RELTYPE_IDS.backed_by,
    targetClassId: CLASS_IDS.cmdb_ci_storage,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'HIGH',
  },
  // Database → runs_on → Server
  {
    id: RULE_IDS.db_runs_on_server,
    sourceClassId: CLASS_IDS.cmdb_ci_database,
    relationshipTypeId: RELTYPE_IDS.runs_on,
    targetClassId: CLASS_IDS.cmdb_ci_server,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'HIGH',
  },
  // Service → depends_on → Application
  {
    id: RULE_IDS.svc_depends_on_app,
    sourceClassId: CLASS_IDS.cmdb_ci_service,
    relationshipTypeId: RELTYPE_IDS.depends_on,
    targetClassId: CLASS_IDS.cmdb_ci_application,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'HIGH',
  },
  // Service → depends_on → Database
  {
    id: RULE_IDS.svc_depends_on_db,
    sourceClassId: CLASS_IDS.cmdb_ci_service,
    relationshipTypeId: RELTYPE_IDS.depends_on,
    targetClassId: CLASS_IDS.cmdb_ci_database,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'MEDIUM',
  },
  // Network Device → connects_to → Network Device
  {
    id: RULE_IDS.netdev_connects_to_netdev,
    sourceClassId: CLASS_IDS.cmdb_ci_network_device,
    relationshipTypeId: RELTYPE_IDS.connects_to,
    targetClassId: CLASS_IDS.cmdb_ci_network_device,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'MEDIUM',
  },
  // Server → contains → Virtual Machine
  {
    id: RULE_IDS.server_contains_vm,
    sourceClassId: CLASS_IDS.cmdb_ci_server,
    relationshipTypeId: RELTYPE_IDS.contains,
    targetClassId: CLASS_IDS.cmdb_ci_virtual_machine,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'HIGH',
  },
  // Database Instance → replicates_to → Database Instance
  {
    id: RULE_IDS.dbi_replicates_to_dbi,
    sourceClassId: CLASS_IDS.cmdb_ci_db_instance,
    relationshipTypeId: RELTYPE_IDS.replicates_to,
    targetClassId: CLASS_IDS.cmdb_ci_db_instance,
    direction: 'OUTBOUND',
    propagationOverride: 'BOTH',
    propagationWeight: 'HIGH',
  },
  // Application → used_by → Service
  {
    id: RULE_IDS.app_used_by_svc,
    sourceClassId: CLASS_IDS.cmdb_ci_application,
    relationshipTypeId: RELTYPE_IDS.used_by,
    targetClassId: CLASS_IDS.cmdb_ci_service,
    direction: 'OUTBOUND',
    propagationOverride: null,
    propagationWeight: 'MEDIUM',
  },
];
