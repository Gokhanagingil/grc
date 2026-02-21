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

/**
 * ITSM Customer Risk Intelligence — Smoke Tests
 *
 * Validates the customer risk impact, recalculation, mitigation action,
 * and change policy endpoints introduced in PR-A through PR-C.
 *
 * These tests run in REAL_STACK mode against a live backend.
 * They require at least one ITSM change to exist in the database.
 */

const E2E_MODE = process.env.E2E_MODE || "REAL_STACK";
if (E2E_MODE !== "REAL_STACK") {
  throw new Error(
    `customer-risk-smoke.spec.ts MUST run in REAL_STACK mode (got E2E_MODE="${E2E_MODE}").`,
  );
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";
const ci = process.env.CI ? "CI" : "local";
console.log(
  `[E2E] suite="ITSM Customer Risk Smoke" mode=${E2E_MODE} baseURL=${BASE_URL} env=${ci}`,
);

function unwrap(body: Record<string, unknown>): Record<string, unknown> {
  if (body && typeof body === "object" && "data" in body) {
    return body.data as Record<string, unknown>;
  }
  return body;
}

let auth: AuthTokens;

test.beforeAll(async ({ request }) => {
  resetReport();
  auth = await authenticate(request, BASE_URL);
});

test.afterAll(() => {
  writeReport();
});

/* ------------------------------------------------------------------ */
/*  Suite: ITSM Changes list (prerequisite for customer risk tests)   */
/* ------------------------------------------------------------------ */

test.describe("[ITSM_CUSTOMER_RISK] Changes list", () => {
  const steps: StepResult[] = [];
  const startTime = Date.now();

  test.afterAll(() => {
    const result: TableResult = {
      table: "itsm_changes",
      tier: 2,
      steps,
      pass: steps.every((s) => s.pass),
      durationMs: Date.now() - startTime,
    };
    addTableResult(result);
  });

  test("GET /grc/itsm/changes returns 200 with items", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/changes`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
      params: { page: "1", limit: "5" },
    });

    const step: StepResult = {
      step: "list_changes",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(
      res.status(),
      `list changes: expected 200 but got ${res.status()} — GET ${url}`,
    ).toBe(200);

    const raw = await res.json();
    const body = unwrap(raw);
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Suite: Change Policies                                            */
/* ------------------------------------------------------------------ */

test.describe("[ITSM_CUSTOMER_RISK] Change Policies", () => {
  const steps: StepResult[] = [];
  const startTime = Date.now();

  test.afterAll(() => {
    const result: TableResult = {
      table: "itsm_change_policies",
      tier: 2,
      steps,
      pass: steps.every((s) => s.pass),
      durationMs: Date.now() - startTime,
    };
    addTableResult(result);
  });

  test("GET /grc/itsm/change-policies returns 200 with items", async ({
    request,
  }) => {
    const url = `${BASE_URL}/grc/itsm/change-policies`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
      params: { page: "1", limit: "5" },
    });

    const step: StepResult = {
      step: "list_change_policies",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(
      res.status(),
      `list change-policies: expected 200 but got ${res.status()} — GET ${url}`,
    ).toBe(200);

    const raw = await res.json();
    const body = unwrap(raw);
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Suite: Customer Risk Impact on a change                           */
/* ------------------------------------------------------------------ */

test.describe("[ITSM_CUSTOMER_RISK] Customer Risk Impact", () => {
  const steps: StepResult[] = [];
  const startTime = Date.now();
  let changeId: string | null = null;

  test.afterAll(() => {
    const result: TableResult = {
      table: "itsm_customer_risk_impact",
      tier: 2,
      steps,
      pass: steps.every((s) => s.pass),
      durationMs: Date.now() - startTime,
    };
    addTableResult(result);
  });

  test("find a change to test customer risk impact", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/changes`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
      params: { page: "1", limit: "1" },
    });

    if (res.status() !== 200) {
      const step: StepResult = {
        step: "find_change",
        status: res.status(),
        pass: false,
        reason: `Cannot find a change to test: GET ${url} returned ${res.status()}`,
      };
      steps.push(step);
      test.skip(true, "No changes available");
      return;
    }

    const raw = await res.json();
    const body = unwrap(raw);
    const items = body.items as Array<{ id: string }> | undefined;

    if (!items || items.length === 0) {
      const step: StepResult = {
        step: "find_change",
        pass: true,
        reason: "No changes in database — skipping customer risk impact tests",
      };
      steps.push(step);
      test.skip(true, "No changes exist in database");
      return;
    }

    changeId = items[0].id;
    const step: StepResult = {
      step: "find_change",
      pass: true,
      reason: `Using change ${changeId}`,
    };
    steps.push(step);
    expect(changeId).toBeTruthy();
  });

  test("GET customer-risk-impact returns 200 or 404", async ({ request }) => {
    if (!changeId) {
      test.skip(true, "No change available");
      return;
    }

    const url = `${BASE_URL}/grc/itsm/changes/${changeId}/customer-risk-impact`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    // 200 = data exists, 404 = change not found (acceptable if change was deleted)
    // 403 = missing permissions (acceptable, record as skip)
    const acceptable = [200, 404];

    if (res.status() === 403) {
      const step: StepResult = {
        step: "get_customer_risk_impact",
        status: 403,
        pass: true,
        reason: "Skipped: user lacks GRC_CUSTOMER_RISK_READ permission",
      };
      steps.push(step);
      test.skip(true, "Requires customer risk read permission");
      return;
    }

    const step: StepResult = {
      step: "get_customer_risk_impact",
      status: res.status(),
      pass: acceptable.includes(res.status()),
      reason: !acceptable.includes(res.status())
        ? `Expected 200 or 404, got ${res.status()} — GET ${url}`
        : undefined,
    };
    steps.push(step);

    expect(
      acceptable.includes(res.status()),
      `customer-risk-impact: expected 200 or 404 but got ${res.status()} — GET ${url}`,
    ).toBe(true);

    if (res.status() === 200) {
      const raw = await res.json();
      const body = unwrap(raw);
      // Validate response shape: aggregateScore, aggregateLabel, resolvedRisks
      expect(body).toHaveProperty("aggregateScore");
      expect(body).toHaveProperty("aggregateLabel");
      expect(body).toHaveProperty("resolvedRisks");
      expect(Array.isArray(body.resolvedRisks)).toBe(true);
    }
  });

  test("POST recalculate-customer-risk returns 200", async ({ request }) => {
    if (!changeId) {
      test.skip(true, "No change available");
      return;
    }

    const url = `${BASE_URL}/grc/itsm/changes/${changeId}/recalculate-customer-risk`;
    const res = await request.post(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    // 200 = recalculated, 404 = change not found, 403 = missing perms
    const acceptable = [200, 404];

    if (res.status() === 403) {
      const step: StepResult = {
        step: "recalculate_customer_risk",
        status: 403,
        pass: true,
        reason: "Skipped: user lacks required permissions",
      };
      steps.push(step);
      test.skip(true, "Requires write + customer risk permissions");
      return;
    }

    const step: StepResult = {
      step: "recalculate_customer_risk",
      status: res.status(),
      pass: acceptable.includes(res.status()),
      reason: !acceptable.includes(res.status())
        ? `Expected 200 or 404, got ${res.status()} — POST ${url}`
        : undefined,
    };
    steps.push(step);

    expect(
      acceptable.includes(res.status()),
      `recalculate-customer-risk: expected 200 or 404 but got ${res.status()} — POST ${url}`,
    ).toBe(true);

    if (res.status() === 200) {
      const raw = await res.json();
      const body = unwrap(raw);
      // Validate response shape includes customerRiskImpact, assessment, policyEvaluation
      expect(body).toHaveProperty("customerRiskImpact");
      expect(body).toHaveProperty("assessment");
      expect(body).toHaveProperty("policyEvaluation");

      const policy = body.policyEvaluation as Record<string, unknown>;
      expect(policy).toHaveProperty("decisionRecommendation");
      expect(policy).toHaveProperty("rulesTriggered");
      expect(policy).toHaveProperty("reasons");
      expect(policy).toHaveProperty("requiredActions");
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Suite: Risk Assessment with Policy Evaluation                     */
/* ------------------------------------------------------------------ */

test.describe("[ITSM_CUSTOMER_RISK] Risk Assessment + Policy", () => {
  const steps: StepResult[] = [];
  const startTime = Date.now();
  let changeId: string | null = null;

  test.afterAll(() => {
    const result: TableResult = {
      table: "itsm_risk_assessment",
      tier: 2,
      steps,
      pass: steps.every((s) => s.pass),
      durationMs: Date.now() - startTime,
    };
    addTableResult(result);
  });

  test("find a change for risk assessment", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/changes`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
      params: { page: "1", limit: "1" },
    });

    if (res.status() !== 200) {
      test.skip(true, "Cannot list changes");
      return;
    }

    const raw = await res.json();
    const body = unwrap(raw);
    const items = body.items as Array<{ id: string }> | undefined;

    if (!items || items.length === 0) {
      const step: StepResult = {
        step: "find_change_for_risk",
        pass: true,
        reason: "No changes in database — skipping risk assessment tests",
      };
      steps.push(step);
      test.skip(true, "No changes exist");
      return;
    }

    changeId = items[0].id;
    steps.push({
      step: "find_change_for_risk",
      pass: true,
    });
  });

  test("GET risk assessment includes policyEvaluation", async ({
    request,
  }) => {
    if (!changeId) {
      test.skip(true, "No change available");
      return;
    }

    const url = `${BASE_URL}/grc/itsm/changes/${changeId}/risk`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const step: StepResult = {
      step: "get_risk_assessment",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBe(200);

    const raw = await res.json();
    const body = unwrap(raw);
    expect(body).toHaveProperty("assessment");
    expect(body).toHaveProperty("policyEvaluation");
  });
});

/* ------------------------------------------------------------------ */
/*  Suite: Mitigation Actions                                         */
/* ------------------------------------------------------------------ */

test.describe("[ITSM_CUSTOMER_RISK] Mitigation Actions", () => {
  const steps: StepResult[] = [];
  const startTime = Date.now();
  let changeId: string | null = null;

  test.afterAll(() => {
    const result: TableResult = {
      table: "itsm_mitigation_actions",
      tier: 2,
      steps,
      pass: steps.every((s) => s.pass),
      durationMs: Date.now() - startTime,
    };
    addTableResult(result);
  });

  test("find a change for mitigation actions", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/changes`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
      params: { page: "1", limit: "1" },
    });

    if (res.status() !== 200) {
      test.skip(true, "Cannot list changes");
      return;
    }

    const raw = await res.json();
    const body = unwrap(raw);
    const items = body.items as Array<{ id: string }> | undefined;

    if (!items || items.length === 0) {
      const step: StepResult = {
        step: "find_change_for_mitigation",
        pass: true,
        reason: "No changes in database — skipping mitigation tests",
      };
      steps.push(step);
      test.skip(true, "No changes exist");
      return;
    }

    changeId = items[0].id;
    steps.push({
      step: "find_change_for_mitigation",
      pass: true,
    });
  });

  test("GET mitigation-actions returns 200 with items", async ({
    request,
  }) => {
    if (!changeId) {
      test.skip(true, "No change available");
      return;
    }

    const url = `${BASE_URL}/grc/itsm/changes/${changeId}/mitigation-actions`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
      params: { page: "1", pageSize: "5" },
    });

    const step: StepResult = {
      step: "list_mitigation_actions",
      status: res.status(),
      pass: res.status() === 200,
      reason:
        res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBe(200);

    const raw = await res.json();
    const body = unwrap(raw);
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pageSize");
  });

  test("POST + DELETE mitigation action round-trip", async ({ request }) => {
    if (!changeId) {
      test.skip(true, "No change available");
      return;
    }

    const createUrl = `${BASE_URL}/grc/itsm/changes/${changeId}/mitigation-actions`;
    const createRes = await request.post(createUrl, {
      headers: authHeaders(auth.token, auth.tenantId),
      data: {
        actionType: "RISK_OBSERVATION",
        title: `__smoke_mitigation_${Date.now()}`,
        description: "Platform health smoke test — safe to delete",
      },
    });

    if (createRes.status() === 403) {
      const step: StepResult = {
        step: "create_mitigation_action",
        status: 403,
        pass: true,
        reason: "Skipped: user lacks ITSM_CHANGE_WRITE permission",
      };
      steps.push(step);
      test.skip(true, "Requires write permission");
      return;
    }

    const createStep: StepResult = {
      step: "create_mitigation_action",
      status: createRes.status(),
      pass: createRes.status() === 201,
      reason:
        createRes.status() !== 201
          ? `Expected 201, got ${createRes.status()} — POST ${createUrl}`
          : undefined,
    };
    steps.push(createStep);

    expect(
      createRes.status(),
      `create mitigation: expected 201 but got ${createRes.status()}`,
    ).toBe(201);

    const createRaw = await createRes.json();
    const createBody = unwrap(createRaw);
    const actionId = (createBody as Record<string, unknown>).id as string;
    expect(actionId).toBeTruthy();

    // Clean up: soft-delete the smoke record
    const deleteUrl = `${BASE_URL}/grc/itsm/changes/${changeId}/mitigation-actions/${actionId}`;
    const deleteRes = await request.delete(deleteUrl, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    const deleteStep: StepResult = {
      step: "delete_mitigation_action",
      status: deleteRes.status(),
      pass: deleteRes.status() === 204,
      reason:
        deleteRes.status() !== 204
          ? `Expected 204, got ${deleteRes.status()} — DELETE ${deleteUrl}`
          : undefined,
    };
    steps.push(deleteStep);

    expect(deleteRes.status()).toBe(204);
  });
});

/* ------------------------------------------------------------------ */
/*  Suite: Permission boundary (403 not crash)                        */
/* ------------------------------------------------------------------ */

test.describe("[ITSM_CUSTOMER_RISK] Permission boundary", () => {
  const steps: StepResult[] = [];
  const startTime = Date.now();

  test.afterAll(() => {
    const result: TableResult = {
      table: "itsm_customer_risk_permissions",
      tier: 2,
      steps,
      pass: steps.every((s) => s.pass),
      durationMs: Date.now() - startTime,
    };
    addTableResult(result);
  });

  test("unauthenticated request returns 401, not 500", async ({ request }) => {
    const url = `${BASE_URL}/grc/itsm/changes`;
    const res = await request.get(url, {
      headers: { "Content-Type": "application/json" },
    });

    // Without auth, should be 401
    const step: StepResult = {
      step: "unauth_returns_401",
      status: res.status(),
      pass: res.status() === 401,
      reason:
        res.status() !== 401
          ? `Expected 401 for unauthenticated request, got ${res.status()} — GET ${url}`
          : undefined,
    };
    steps.push(step);

    expect(res.status()).toBe(401);
  });

  test("invalid changeId returns 404, not 500", async ({ request }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const url = `${BASE_URL}/grc/itsm/changes/${fakeId}/customer-risk-impact`;
    const res = await request.get(url, {
      headers: authHeaders(auth.token, auth.tenantId),
    });

    // Should be 404 (not found) or 403 (perm denied), never 500
    const acceptable = [404, 403];

    const step: StepResult = {
      step: "invalid_change_returns_4xx",
      status: res.status(),
      pass: acceptable.includes(res.status()),
      reason: !acceptable.includes(res.status())
        ? `Expected 404 or 403 for invalid changeId, got ${res.status()} — GET ${url}`
        : undefined,
    };
    steps.push(step);

    expect(
      res.status(),
      `invalid changeId: expected 404/403 but got ${res.status()}`,
    ).not.toBe(500);
  });
});
