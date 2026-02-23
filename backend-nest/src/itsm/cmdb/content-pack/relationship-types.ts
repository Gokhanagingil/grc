/**
 * CMDB Baseline Content Pack v1 — Relationship Type Definitions
 *
 * Defines the default relationship type catalog with full semantics.
 * All relationship types use deterministic UUIDs and are marked as system types.
 */

import {
  RelationshipDirectionality,
  RiskPropagationHint,
} from '../relationship-type/relationship-type.entity';

// ============================================================================
// Deterministic UUIDs — Relationship Types
// Prefix: r1a00000-0000-0000-0000-0000000000xx
// ============================================================================

/**
 * IDs MUST match the existing seed-cmdb-mi-demo.ts assignments exactly
 * for the original 7 types. New types (backed_by, replicates_to) get
 * the next sequential IDs.
 */
export const RELTYPE_IDS = {
  depends_on: 'r1a00000-0000-0000-0000-000000000001',
  runs_on: 'r1a00000-0000-0000-0000-000000000002',
  hosted_on: 'r1a00000-0000-0000-0000-000000000003',
  connects_to: 'r1a00000-0000-0000-0000-000000000004',
  used_by: 'r1a00000-0000-0000-0000-000000000005',
  contains: 'r1a00000-0000-0000-0000-000000000006',
  member_of: 'r1a00000-0000-0000-0000-000000000007',
  backed_by: 'r1a00000-0000-0000-0000-000000000008',
  replicates_to: 'r1a00000-0000-0000-0000-000000000009',
} as const;

/**
 * Seed definition for a relationship type in the baseline content pack.
 */
export interface BaselineRelTypeDef {
  id: string;
  name: string;
  label: string;
  description: string;
  directionality: RelationshipDirectionality;
  inverseLabel: string | null;
  riskPropagation: RiskPropagationHint;
  allowedSourceClasses: string[] | null;
  allowedTargetClasses: string[] | null;
  allowSelfLoop: boolean;
  allowCycles: boolean;
  sortOrder: number;
}

/**
 * Complete list of baseline relationship type definitions.
 */
export const BASELINE_RELATIONSHIP_TYPES: BaselineRelTypeDef[] = [
  {
    id: RELTYPE_IDS.depends_on,
    name: 'depends_on',
    label: 'Depends On',
    description:
      'Source depends on target for functionality. If the target fails or degrades, the source is impacted. Risk propagates forward (target failure impacts source).',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Depended On By',
    riskPropagation: RiskPropagationHint.FORWARD,
    allowedSourceClasses: null,
    allowedTargetClasses: null,
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 10,
  },
  {
    id: RELTYPE_IDS.used_by,
    name: 'used_by',
    label: 'Used By',
    description:
      'Source resource is used or consumed by target. Risk propagates in reverse (source failure impacts target users).',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Uses',
    riskPropagation: RiskPropagationHint.REVERSE,
    allowedSourceClasses: null,
    allowedTargetClasses: null,
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 20,
  },
  {
    id: RELTYPE_IDS.runs_on,
    name: 'runs_on',
    label: 'Runs On',
    description:
      'Application or service runs on a server or infrastructure component. Risk propagates from infrastructure to application (reverse).',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Hosts',
    riskPropagation: RiskPropagationHint.REVERSE,
    allowedSourceClasses: [
      'cmdb_ci_application',
      'cmdb_ci_business_app',
      'cmdb_ci_web_application',
      'cmdb_ci_app_service',
    ],
    allowedTargetClasses: [
      'cmdb_ci_hardware',
      'cmdb_ci_computer',
      'cmdb_ci_server',
      'cmdb_ci_linux_server',
      'cmdb_ci_win_server',
      'cmdb_ci_virtual_machine',
    ],
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 30,
  },
  {
    id: RELTYPE_IDS.hosted_on,
    name: 'hosted_on',
    label: 'Hosted On',
    description:
      'Source is hosted on target infrastructure. Risk propagates from infrastructure to hosted component (reverse).',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Hosts',
    riskPropagation: RiskPropagationHint.REVERSE,
    allowedSourceClasses: null,
    allowedTargetClasses: [
      'cmdb_ci_hardware',
      'cmdb_ci_computer',
      'cmdb_ci_server',
      'cmdb_ci_linux_server',
      'cmdb_ci_win_server',
      'cmdb_ci_virtual_machine',
      'cmdb_ci_storage',
    ],
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 40,
  },
  {
    id: RELTYPE_IDS.connects_to,
    name: 'connects_to',
    label: 'Connects To',
    description:
      'Bidirectional network or data connectivity between components. Risk propagates in both directions.',
    directionality: RelationshipDirectionality.BIDIRECTIONAL,
    inverseLabel: 'Connected From',
    riskPropagation: RiskPropagationHint.BOTH,
    allowedSourceClasses: null,
    allowedTargetClasses: null,
    allowSelfLoop: false,
    allowCycles: true,
    sortOrder: 50,
  },
  {
    id: RELTYPE_IDS.contains,
    name: 'contains',
    label: 'Contains',
    description:
      'Parent-child containment. Source physically or logically contains target. Risk propagates forward (container failure impacts contained items).',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Contained By',
    riskPropagation: RiskPropagationHint.FORWARD,
    allowedSourceClasses: null,
    allowedTargetClasses: null,
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 60,
  },
  {
    id: RELTYPE_IDS.member_of,
    name: 'member_of',
    label: 'Member Of',
    description:
      'Source is a member or part of a target group, cluster, or logical grouping. No risk propagation by default.',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Has Member',
    riskPropagation: RiskPropagationHint.NONE,
    allowedSourceClasses: null,
    allowedTargetClasses: null,
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 70,
  },
  {
    id: RELTYPE_IDS.backed_by,
    name: 'backed_by',
    label: 'Backed By',
    description:
      'Source is backed by target for storage, data, or redundancy purposes. Risk propagates forward (backup failure impacts source recovery).',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Backs',
    riskPropagation: RiskPropagationHint.FORWARD,
    allowedSourceClasses: null,
    allowedTargetClasses: [
      'cmdb_ci_storage',
      'cmdb_ci_database',
      'cmdb_ci_db_instance',
    ],
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 80,
  },
  {
    id: RELTYPE_IDS.replicates_to,
    name: 'replicates_to',
    label: 'Replicates To',
    description:
      'Source replicates data to target for HA/DR purposes. Risk propagates in both directions (replication lag or failure affects both sides).',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Replicated From',
    riskPropagation: RiskPropagationHint.BOTH,
    allowedSourceClasses: [
      'cmdb_ci_database',
      'cmdb_ci_db_instance',
      'cmdb_ci_storage',
    ],
    allowedTargetClasses: [
      'cmdb_ci_database',
      'cmdb_ci_db_instance',
      'cmdb_ci_storage',
    ],
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 90,
  },
];
