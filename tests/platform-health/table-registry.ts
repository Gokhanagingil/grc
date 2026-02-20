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
  requiresRole?: string[];
}

export const TIER1_TABLES: TableDef[] = [
  {
    name: "policies",
    listEndpoint: "/api/governance/policies",
    listDataKey: "policies",
    createEndpoint: "/api/governance/policies",
    createPayload: {
      title: `__smoke_policy_${Date.now()}`,
      description: "Platform health smoke test record",
      category: "Information Security",
      status: "draft",
    },
    createdIdPath: "policy.id",
    displayField: "title",
    filters: [
      { param: "status", value: "draft" },
      { param: "category", value: "Information Security" },
    ],
    tier: 1,
    requiresRole: ["admin", "manager"],
  },
  {
    name: "risks",
    listEndpoint: "/api/risk/risks",
    listDataKey: "risks",
    createEndpoint: "/api/risk/risks",
    createPayload: {
      title: `__smoke_risk_${Date.now()}`,
      description: "Platform health smoke test record",
      category: "Operational",
      severity: "Low",
      likelihood: "Low",
      impact: "Low",
    },
    createdIdPath: "risk.id",
    displayField: "title",
    filters: [
      { param: "severity", value: "Low" },
      { param: "status", value: "open" },
    ],
    tier: 1,
  },
  {
    name: "compliance_requirements",
    listEndpoint: "/api/compliance/requirements",
    listDataKey: "requirements",
    createEndpoint: "/api/compliance/requirements",
    createPayload: {
      title: `__smoke_requirement_${Date.now()}`,
      description: "Platform health smoke test record",
      regulation: "SOC2",
      category: "Security",
    },
    createdIdPath: "requirement.id",
    displayField: "title",
    filters: [
      { param: "status", value: "pending" },
      { param: "regulation", value: "SOC2" },
    ],
    tier: 1,
    requiresRole: ["admin", "manager"],
  },
];

export const TIER2_TABLES: TableDef[] = [
  {
    name: "organizations",
    listEndpoint: "/api/governance/organizations",
    listDataKey: "",
    createEndpoint: "/api/governance/organizations",
    createPayload: {
      name: `__smoke_org_${Date.now()}`,
      description: "Platform health smoke test record",
      type: "department",
    },
    createdIdPath: "organization.id",
    displayField: "name",
    filters: [],
    tier: 2,
    requiresRole: ["admin"],
  },
  {
    name: "audit_logs",
    listEndpoint: "/api/compliance/audit-logs",
    listDataKey: "logs",
    displayField: "action",
    filters: [{ param: "action", value: "CREATE" }],
    tier: 2,
    readOnly: true,
    requiresRole: ["admin", "manager"],
  },
  {
    name: "users",
    listEndpoint: "/api/users",
    listDataKey: "users",
    displayField: "username",
    filters: [{ param: "role", value: "admin" }],
    tier: 2,
    readOnly: true,
    requiresRole: ["admin", "manager"],
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
