export interface FilterDef {
  param: string;
  value: string;
}

export interface TableDef {
  name: string;
  listEndpoint: string;
  listDataKey: string;
  createEndpoint?: string;
  createPayload?: Record<string, unknown>;
  createdIdPath?: string;
  displayField: string;
  filters: FilterDef[];
  sortParam?: string;
  tier: 1 | 2;
  readOnly?: boolean;
  canCreate?: boolean;
  skipCreateReason?: string;
  requiresRole?: string[];
}

export const TIER1_TABLES: TableDef[] = [
  {
    name: "policies",
    listEndpoint: "/grc/policies",
    listDataKey: "items",
    createEndpoint: "/grc/policies",
    createPayload: {
      name: `__smoke_policy_${Date.now()}`,
      summary: "Platform health smoke test record",
      category: "Information Security",
      status: "draft",
    },
    createdIdPath: "id",
    displayField: "name",
    filters: [
      { param: "status", value: "draft" },
      { param: "category", value: "Information Security" },
    ],
    tier: 1,
  },
  {
    name: "risks",
    listEndpoint: "/grc/risks",
    listDataKey: "items",
    createEndpoint: "/grc/risks",
    createPayload: {
      title: `__smoke_risk_${Date.now()}`,
      description: "Platform health smoke test record",
      category: "Operational",
      severity: "low",
      likelihood: "rare",
      impact: "low",
    },
    createdIdPath: "id",
    displayField: "title",
    filters: [
      { param: "severity", value: "low" },
      { param: "status", value: "draft" },
    ],
    tier: 1,
  },
  {
    name: "requirements",
    listEndpoint: "/grc/requirements",
    listDataKey: "items",
    createEndpoint: "/grc/requirements",
    createPayload: {
      title: `__smoke_requirement_${Date.now()}`,
      description: "Platform health smoke test record",
      framework: "soc2",
      referenceCode: `SMOKE-${Date.now()}`,
      category: "Security",
    },
    createdIdPath: "id",
    displayField: "title",
    filters: [
      { param: "status", value: "pending" },
      { param: "framework", value: "soc2" },
    ],
    tier: 1,
  },
];

export const TIER2_TABLES: TableDef[] = [
  {
    name: "controls",
    listEndpoint: "/grc/controls",
    listDataKey: "items",
    displayField: "name",
    filters: [{ param: "status", value: "draft" }],
    tier: 2,
    readOnly: true,
    canCreate: false,
    skipCreateReason: "No POST /grc/controls endpoint exists; controls are created via process-control linking",
  },
  {
    name: "audits",
    listEndpoint: "/grc/audits",
    listDataKey: "items",
    displayField: "title",
    filters: [{ param: "status", value: "planned" }],
    tier: 2,
    readOnly: true,
  },
  {
    name: "audit_logs",
    listEndpoint: "/audit-logs",
    listDataKey: "logs",
    displayField: "action",
    filters: [{ param: "action", value: "CREATE" }],
    tier: 2,
    readOnly: true,
    requiresRole: ["admin"],
  },
  {
    name: "itsm_changes",
    listEndpoint: "/grc/itsm/changes",
    listDataKey: "items",
    displayField: "title",
    filters: [{ param: "status", value: "draft" }],
    tier: 2,
    readOnly: true,
    canCreate: false,
    skipCreateReason: "Changes are created via ITSM workflow, not direct POST",
  },
  {
    name: "itsm_change_policies",
    listEndpoint: "/grc/itsm/change-policies",
    listDataKey: "items",
    displayField: "name",
    filters: [],
    tier: 2,
    readOnly: true,
    canCreate: false,
    skipCreateReason: "Change policies are managed via admin UI, not smoke-tested for create",
  },
];

export const DENYLIST = ["dashboard", "auth"];

export function getTablesForTier(tier: "tier1" | "full"): TableDef[] {
  if (tier === "tier1") {
    return TIER1_TABLES;
  }
  return [...TIER1_TABLES, ...TIER2_TABLES];
}

export function getMaxTablesPerRun(): number {
  const envVal = process.env.MAX_TABLES_PER_RUN;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 10;
}
