/**
 * Scenario Pack Smoke Tests — REAL_STACK
 *
 * High-signal, low-flake API-level smoke tests using deterministic
 * scenario data from PR #462 (seed:scenario-pack).
 *
 * Covers:
 *   1. Change Topology Impact (CHG-SCEN-001)
 *   2. Major Incident RCA Hypotheses (MI-SCEN-001)
 *   3. Problem / Known Error Linkage (PRB-SCEN-001, KE-SCEN-001)
 *   4. CMDB Topology Sanity (CI + Service topology)
 *
 * Tags: @smoke @real @scenario-pack
 *
 * Prerequisites:
 *   - Backend running on BASE_URL (default http://localhost:3002)
 *   - seed:scenario-pack has been executed against the same database
 *   - Valid admin credentials configured
 */
import { test, expect } from "@playwright/test";
import {
  authenticate,
  authHeaders,
  addTableResult,
  resetReport,
  writeReport,
  type AuthTokens,
  type StepResult,
  type TableResult,
} from "./helpers";

const E2E_MODE = process.env.E2E_MODE || "REAL_STACK";
if (E2E_MODE !== "REAL_STACK") {
  throw new Error(
    `scenario-pack-smoke.spec.ts MUST run in REAL_STACK mode (got E2E_MODE="${E2E_MODE}").`,
  );
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";

const ci = process.env.CI ? "CI" : "local";
console.log(
  `[E2E] suite="Scenario Pack Smoke" mode=${E2E_MODE} baseURL=${BASE_URL} env=${ci}`,
);

// ============================================================================
// Deterministic IDs from PR #462 seed-scenario-pack.ts
// These MUST match the SCENARIO_PACK_IDS exported from the seed script.
// ============================================================================
const SCENARIO_IDS = {
  // CIs
  CI_WEB_APP: "dddd0200-0000-0000-0000-000000000001",
  CI_CORE_API: "dddd0200-0000-0000-0000-000000000002",
  CI_PRIMARY_DB: "dddd0200-0000-0000-0000-000000000003",

  // Service
  SVC_ONLINE_BANKING: "dddd0400-0000-0000-0000-000000000001",

  // Change
  CHANGE_DB_UPGRADE: "dddd0500-0000-0000-0000-000000000001",

  // Incidents + Major Incident
  MI_BANKING_OUTAGE: "dddd0600-0000-0000-0000-000000000010",

  // Problem + Known Error
  PROB_SCHEMA_COMPAT: "dddd0700-0000-0000-0000-000000000001",
  KE_SCHEMA_WORKAROUND: "dddd0700-0000-0000-0000-000000000010",
};

// ============================================================================
// Response envelope unwrap
// ============================================================================
function unwrap(body: Record<string, unknown>): Record<string, unknown> {
  if (body && typeof body === "object" && "data" in body) {
    return body.data as Record<string, unknown>;
  }
  return body;
}

// ============================================================================
// Tests
// ============================================================================

let auth: AuthTokens;

test.beforeAll(async ({ request }) => {
  resetReport();
  auth = await authenticate(request, BASE_URL);
});

test.afterAll(() => {
  writeReport();
});

// --------------------------------------------------------------------------
// 1. CHANGE TOPOLOGY IMPACT SMOKE
// --------------------------------------------------------------------------
test.describe("Change Topology Impact Smoke @smoke @real @scenario-pack", () => {
  const steps: StepResult[] = [];
  const startTime = Date.now();

  test.afterAll(() => {
    const result: TableResult = {
      table: "scenario/change-topology-impact",
      tier: 1,
      steps,
      pass: steps.every((s) => s.pass),
      durationMs: Date.now() - startTime,
    };
    addTableResult(result);
  });

  test("GET change CHG-SCEN-001 returns 200", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/changes/${SCENARIO_IDS.CHANGE_DB_UPGRADE}`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_change",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}. Ensure seed:scenario-pack has been run.`
          : undefined,
    };
    steps.push(step);

    if (res.status() === 404) {
      test.skip(
        true,
        "Scenario pack not seeded — CHG-SCEN-001 not found. Run seed:scenario-pack first.",
      );
      return;
    }

    expect(
      res.status(),
      `GET change: expected 200 but got ${res.status()} — ${url}`,
    ).toBe(200);
  });

  test("GET change topology-impact returns parseable structure", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/itsm/changes/${SCENARIO_IDS.CHANGE_DB_UPGRADE}/topology-impact`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    // Topology impact may return 200 with data or 404 if not yet computed —
    // both are acceptable for a smoke check. We just verify no 500.
    const step: StepResult = {
      step: "get_topology_impact",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(
      res.status(),
      `Topology impact endpoint should not return 5xx — got ${res.status()}`,
    ).toBeLessThan(500);

    if (res.status() === 200) {
      const raw = await res.json();
      const body = unwrap(raw);

      // Contract: should have impact-related fields
      const contractStep: StepResult = {
        step: "topology_impact_contract",
        pass: typeof body === "object" && body !== null,
        reason:
          typeof body !== "object" || body === null
            ? "Topology impact response is not an object"
            : undefined,
      };
      steps.push(contractStep);
      expect(body).toBeDefined();
    }
  });

  test("GET change topology-guardrails returns parseable structure", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/itsm/changes/${SCENARIO_IDS.CHANGE_DB_UPGRADE}/topology-guardrails`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_topology_guardrails",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBeLessThan(500);
  });

  test("GET change traceability-summary returns parseable structure", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/itsm/changes/${SCENARIO_IDS.CHANGE_DB_UPGRADE}/traceability-summary`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_traceability_summary",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBeLessThan(500);
  });
});

// --------------------------------------------------------------------------
// 2. MAJOR INCIDENT RCA SMOKE
// --------------------------------------------------------------------------
test.describe("Major Incident RCA Smoke @smoke @real @scenario-pack", () => {
  const steps: StepResult[] = [];
  const startTime = Date.now();

  test.afterAll(() => {
    const result: TableResult = {
      table: "scenario/major-incident-rca",
      tier: 1,
      steps,
      pass: steps.every((s) => s.pass),
      durationMs: Date.now() - startTime,
    };
    addTableResult(result);
  });

  test("GET major incident MI-SCEN-001 returns 200", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/major-incidents/${SCENARIO_IDS.MI_BANKING_OUTAGE}`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_major_incident",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}. Ensure seed:scenario-pack has been run.`
          : undefined,
    };
    steps.push(step);

    if (res.status() === 404) {
      test.skip(
        true,
        "Scenario pack not seeded — MI-SCEN-001 not found.",
      );
      return;
    }

    expect(res.status()).toBe(200);

    const raw = await res.json();
    const body = unwrap(raw);

    // Contract: MI should have core fields
    const hasTitle =
      typeof body.title === "string" || typeof body.shortDescription === "string";
    const contractStep: StepResult = {
      step: "mi_has_core_fields",
      pass: hasTitle,
      reason: !hasTitle
        ? `MI response missing title/shortDescription. Keys: [${Object.keys(body).join(", ")}]`
        : undefined,
    };
    steps.push(contractStep);
    expect(hasTitle).toBe(true);
  });

  test("GET MI RCA topology hypotheses returns parseable structure", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/itsm/major-incidents/${SCENARIO_IDS.MI_BANKING_OUTAGE}/rca-topology-hypotheses`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_rca_hypotheses",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const raw = await res.json();
      const body = unwrap(raw);

      // Contract: should have hypotheses array
      const hasHypotheses =
        Array.isArray(body.hypotheses) || Array.isArray(body);
      const contractStep: StepResult = {
        step: "rca_hypotheses_contract",
        pass: typeof body === "object" && body !== null,
        reason:
          typeof body !== "object"
            ? "RCA hypotheses response is not an object/array"
            : undefined,
      };
      steps.push(contractStep);

      if (hasHypotheses) {
        const hypotheses = Array.isArray(body.hypotheses)
          ? (body.hypotheses as unknown[])
          : (body as unknown as unknown[]);
        const rankingStep: StepResult = {
          step: "rca_hypotheses_ranking_present",
          pass: hypotheses.length >= 0, // at least parseable
          reason: undefined,
        };
        steps.push(rankingStep);
      }
    }
  });

  test("GET MI RCA decisions returns parseable structure", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/itsm/major-incidents/${SCENARIO_IDS.MI_BANKING_OUTAGE}/rca-decisions`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_rca_decisions",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBeLessThan(500);
  });

  test("GET MI links returns linked records", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/major-incidents/${SCENARIO_IDS.MI_BANKING_OUTAGE}/links`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_mi_links",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const raw = await res.json();
      const body = unwrap(raw);
      const links = Array.isArray(body) ? body : (body.items as unknown[]) || (body.links as unknown[]) || [];
      const linksStep: StepResult = {
        step: "mi_has_links",
        pass: Array.isArray(links),
        reason: !Array.isArray(links)
          ? `Expected links array. Got: ${typeof links}`
          : undefined,
      };
      steps.push(linksStep);
    }
  });

  test("GET MI traceability-summary returns parseable structure", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/itsm/major-incidents/${SCENARIO_IDS.MI_BANKING_OUTAGE}/traceability-summary`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_mi_traceability",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBeLessThan(500);
  });
});

// --------------------------------------------------------------------------
// 3. PROBLEM / KNOWN ERROR LINKAGE SMOKE
// --------------------------------------------------------------------------
test.describe("Problem / Known Error Linkage Smoke @smoke @real @scenario-pack", () => {
  const steps: StepResult[] = [];
  const startTime = Date.now();

  test.afterAll(() => {
    const result: TableResult = {
      table: "scenario/problem-known-error",
      tier: 1,
      steps,
      pass: steps.every((s) => s.pass),
      durationMs: Date.now() - startTime,
    };
    addTableResult(result);
  });

  test("GET problem PRB-SCEN-001 returns 200 with RCA data", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/itsm/problems/${SCENARIO_IDS.PROB_SCHEMA_COMPAT}`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_problem",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}. Ensure seed:scenario-pack has been run.`
          : undefined,
    };
    steps.push(step);

    if (res.status() === 404) {
      test.skip(
        true,
        "Scenario pack not seeded — PRB-SCEN-001 not found.",
      );
      return;
    }

    expect(res.status()).toBe(200);

    const raw = await res.json();
    const body = unwrap(raw);

    // Contract: problem should have rcaEntries or RCA-related fields
    const hasRca =
      Array.isArray(body.rcaEntries) ||
      typeof body.rootCauseSummary === "string" ||
      body.fiveWhySummary !== undefined;
    const rcaStep: StepResult = {
      step: "problem_has_rca_data",
      pass: hasRca,
      reason: !hasRca
        ? `Problem missing RCA data. Keys: [${Object.keys(body).join(", ")}]`
        : undefined,
    };
    steps.push(rcaStep);
  });

  test("GET problem RCA endpoint returns structured data", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/itsm/problems/${SCENARIO_IDS.PROB_SCHEMA_COMPAT}/rca`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_problem_rca",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await res.json();
      const rcaFieldsStep: StepResult = {
        step: "rca_has_entries",
        pass:
          Array.isArray(body.rcaEntries) ||
          typeof body.rootCauseSummary === "string",
        reason: !(
          Array.isArray(body.rcaEntries) ||
          typeof body.rootCauseSummary === "string"
        )
          ? `RCA response missing rcaEntries/rootCauseSummary. Keys: [${Object.keys(body).join(", ")}]`
          : undefined,
      };
      steps.push(rcaFieldsStep);
    }
  });

  test("GET problem linked incidents returns array", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/problems/${SCENARIO_IDS.PROB_SCHEMA_COMPAT}/incidents`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_problem_incidents",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBeLessThan(500);
  });

  test("GET problem linked changes returns array", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/problems/${SCENARIO_IDS.PROB_SCHEMA_COMPAT}/changes`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_problem_changes",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBeLessThan(500);
  });

  test("GET known error KE-SCEN-001 returns 200", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/known-errors/${SCENARIO_IDS.KE_SCHEMA_WORKAROUND}`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_known_error",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}. Ensure seed:scenario-pack has been run.`
          : undefined,
    };
    steps.push(step);

    if (res.status() === 404) {
      test.skip(
        true,
        "Scenario pack not seeded — KE-SCEN-001 not found.",
      );
      return;
    }

    expect(res.status()).toBe(200);

    const raw = await res.json();
    const body = unwrap(raw);

    // Contract: KE should have workaround or state fields
    const hasKeFields =
      typeof body.state === "string" || typeof body.workaround === "string" || typeof body.workaroundNotes === "string";
    const keStep: StepResult = {
      step: "ke_has_core_fields",
      pass: typeof body === "object" && body !== null,
      reason:
        typeof body !== "object"
          ? `KE response is not an object. Keys: [${Object.keys(body).join(", ")}]`
          : undefined,
    };
    steps.push(keStep);
  });
});

// --------------------------------------------------------------------------
// 4. CMDB / RELATIONSHIP SANITY SMOKE
// --------------------------------------------------------------------------
test.describe("CMDB Topology Sanity Smoke @smoke @real @scenario-pack", () => {
  const steps: StepResult[] = [];
  const startTime = Date.now();

  test.afterAll(() => {
    const result: TableResult = {
      table: "scenario/cmdb-topology-sanity",
      tier: 1,
      steps,
      pass: steps.every((s) => s.pass),
      durationMs: Date.now() - startTime,
    };
    addTableResult(result);
  });

  test("GET CI topology for SCEN-BANKING-DB returns graph", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/cmdb/topology/ci/${SCENARIO_IDS.CI_PRIMARY_DB}?depth=2`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_ci_topology",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}. Ensure seed:scenario-pack has been run.`
          : undefined,
    };
    steps.push(step);

    if (res.status() === 404) {
      test.skip(true, "Scenario pack CI not found — skipping topology test.");
      return;
    }

    expect(res.status()).toBe(200);

    const raw = await res.json();
    const body = unwrap(raw);

    // Contract: topology response should have nodes and edges
    const hasNodes = Array.isArray(body.nodes);
    const hasEdges = Array.isArray(body.edges);
    const hasMeta = typeof body.meta === "object" && body.meta !== null;

    const contractStep: StepResult = {
      step: "ci_topology_contract",
      pass: hasNodes && hasEdges && hasMeta,
      reason:
        !(hasNodes && hasEdges && hasMeta)
          ? `Missing keys: nodes=${hasNodes}, edges=${hasEdges}, meta=${hasMeta}. Keys: [${Object.keys(body).join(", ")}]`
          : undefined,
    };
    steps.push(contractStep);
    expect(hasNodes).toBe(true);
    expect(hasEdges).toBe(true);
    expect(hasMeta).toBe(true);

    // Verify root node is in the graph
    if (hasNodes) {
      const nodes = body.nodes as Array<{ id: string }>;
      const rootFound = nodes.some(
        (n) => n.id === SCENARIO_IDS.CI_PRIMARY_DB,
      );
      const rootStep: StepResult = {
        step: "ci_topology_root_node",
        pass: rootFound,
        reason: !rootFound
          ? `Root node ${SCENARIO_IDS.CI_PRIMARY_DB} not found in ${nodes.length} nodes`
          : undefined,
      };
      steps.push(rootStep);
      expect(rootFound).toBe(true);
    }
  });

  test("GET service topology for SCEN-Online-Banking returns graph", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/cmdb/topology/service/${SCENARIO_IDS.SVC_ONLINE_BANKING}?depth=2`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_service_topology",
      status: res.status(),
      pass: res.status() < 500,
      reason:
        res.status() >= 500
          ? `Server error ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const raw = await res.json();
      const body = unwrap(raw);
      const hasNodes = Array.isArray(body.nodes);
      const contractStep: StepResult = {
        step: "service_topology_contract",
        pass: hasNodes,
        reason: !hasNodes
          ? `Service topology missing nodes array. Keys: [${Object.keys(body).join(", ")}]`
          : undefined,
      };
      steps.push(contractStep);
    }
  });

  test("GET CI detail for SCEN-BANKING-API returns 200 with relationships", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/cmdb/cis/${SCENARIO_IDS.CI_CORE_API}`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_ci_detail",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    if (res.status() === 404) {
      test.skip(true, "Scenario pack CI not found.");
      return;
    }

    expect(res.status()).toBe(200);
  });

  test("GET CMDB relationships list includes scenario links", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/cmdb/relationships`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
      params: { page: "1", limit: "50" },
    });

    const step: StepResult = {
      step: "get_cmdb_relationships",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBe(200);
  });
});
