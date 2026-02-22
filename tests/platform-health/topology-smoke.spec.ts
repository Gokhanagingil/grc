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
    `topology-smoke.spec.ts MUST run in REAL_STACK mode (got E2E_MODE="${E2E_MODE}"). ` +
      "This suite validates real CMDB Topology API contracts.",
  );
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";

// ============================================================================
// Topology endpoint definitions
// ============================================================================

interface TopologyEndpointDef {
  name: string;
  /** Path template — {id} will be replaced at runtime */
  pathTemplate: string;
  /** How to discover a valid entity ID to test against */
  entityListPath: string;
}

const TOPOLOGY_ENDPOINTS: TopologyEndpointDef[] = [
  {
    name: "topology-ci",
    pathTemplate: "/grc/cmdb/topology/ci/{id}",
    entityListPath: "/grc/cmdb/cis",
  },
  {
    name: "topology-service",
    pathTemplate: "/grc/cmdb/topology/service/{id}",
    entityListPath: "/grc/cmdb/services",
  },
];

// ============================================================================
// Response contract keys
// ============================================================================

const EXPECTED_TOP_KEYS = ["nodes", "edges", "meta", "annotations"];

const EXPECTED_META_KEYS = [
  "rootNodeId",
  "depth",
  "nodeCount",
  "edgeCount",
  "truncated",
  "warnings",
];

// ============================================================================
// Unwrap response envelope
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

test.describe("CMDB Topology Smoke Tests @real @topology", () => {
  // --------------------------------------------------------------------------
  // 1. Topology for CI
  // --------------------------------------------------------------------------
  test.describe("topology-ci", () => {
    const steps: StepResult[] = [];
    const startTime = Date.now();
    let ciId: string | null = null;

    test.afterAll(() => {
      const result: TableResult = {
        table: "cmdb/topology-ci",
        tier: 1,
        steps,
        pass: steps.every((s) => s.pass),
        durationMs: Date.now() - startTime,
      };
      addTableResult(result);
    });

    test("discover a CI to test topology", async ({ request }) => {
      const url = `${BASE_URL}/grc/cmdb/cis`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
        params: { page: "1", limit: "1" },
      });

      const step: StepResult = {
        step: "discover_ci",
        status: res.status(),
        pass: res.status() === 200,
        reason:
          res.status() !== 200
            ? `Expected 200, got ${res.status()} — GET ${url}`
            : undefined,
      };

      if (res.status() === 200) {
        const raw = await res.json();
        const body = unwrap(raw);
        const items = body.items as Array<{ id: string }>;
        if (items && items.length > 0) {
          ciId = items[0].id;
        } else {
          step.reason = "No CIs found — topology tests will be skipped";
        }
      }

      steps.push(step);
      expect(res.status()).toBe(200);
    });

    test("GET topology/ci/:ciId returns 200 with graph", async ({
      request,
    }) => {
      if (!ciId) {
        test.skip(true, "No CI available for topology test");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      const step: StepResult = {
        step: "get_topology_ci",
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
        `GET topology/ci: expected 200 but got ${res.status()}`,
      ).toBe(200);
    });

    test("topology-ci response has expected top-level keys", async ({
      request,
    }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      if (res.status() !== 200) {
        test.skip(true, `GET returned ${res.status()}, skipping contract`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);
      const missingKeys = EXPECTED_TOP_KEYS.filter((k) => !(k in body));

      const step: StepResult = {
        step: "contract_top_keys",
        pass: missingKeys.length === 0,
        reason:
          missingKeys.length > 0
            ? `Missing keys: [${missingKeys.join(", ")}]. Actual: [${Object.keys(body).join(", ")}]`
            : undefined,
      };
      steps.push(step);

      expect(
        missingKeys,
        `topology-ci missing keys: ${missingKeys.join(", ")}`,
      ).toHaveLength(0);
    });

    test("topology-ci meta has expected keys", async ({ request }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      if (res.status() !== 200) {
        test.skip(true, `GET returned ${res.status()}, skipping meta check`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);
      const meta = body.meta as Record<string, unknown>;
      const missingKeys = EXPECTED_META_KEYS.filter((k) => !(k in meta));

      const step: StepResult = {
        step: "contract_meta_keys",
        pass: missingKeys.length === 0,
        reason:
          missingKeys.length > 0
            ? `Missing meta keys: [${missingKeys.join(", ")}]`
            : undefined,
      };
      steps.push(step);

      expect(missingKeys).toHaveLength(0);
    });

    test("topology-ci rootNodeId matches requested ciId", async ({
      request,
    }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      if (res.status() !== 200) {
        test.skip(true, `GET returned ${res.status()}`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);
      const meta = body.meta as Record<string, unknown>;

      const step: StepResult = {
        step: "root_node_match",
        pass: meta.rootNodeId === ciId,
        reason:
          meta.rootNodeId !== ciId
            ? `rootNodeId "${meta.rootNodeId}" !== ciId "${ciId}"`
            : undefined,
      };
      steps.push(step);

      expect(meta.rootNodeId).toBe(ciId);
    });

    test("topology-ci nodes array contains root node", async ({ request }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      if (res.status() !== 200) {
        test.skip(true, `GET returned ${res.status()}`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);
      const nodes = body.nodes as Array<{ id: string; type: string }>;
      const rootNode = nodes.find((n) => n.id === ciId);

      const step: StepResult = {
        step: "root_in_nodes",
        pass: !!rootNode,
        reason: !rootNode
          ? `Root node ${ciId} not found in nodes array`
          : undefined,
      };
      steps.push(step);

      expect(rootNode).toBeDefined();
      expect(rootNode?.type).toBe("ci");
    });

    test("topology-ci with depth=2 returns 200", async ({ request }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}?depth=2`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      const step: StepResult = {
        step: "depth_2",
        status: res.status(),
        pass: res.status() === 200,
        reason:
          res.status() !== 200
            ? `Expected 200 with depth=2, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(200);
    });

    test("topology-ci with depth=3 returns 200", async ({ request }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}?depth=3`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      const step: StepResult = {
        step: "depth_3",
        status: res.status(),
        pass: res.status() === 200,
        reason:
          res.status() !== 200
            ? `Expected 200 with depth=3, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(200);
    });

    test("topology-ci with relationTypes filter returns 200", async ({
      request,
    }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}?relationTypes=depends_on`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      const step: StepResult = {
        step: "filter_relation_type",
        status: res.status(),
        pass: res.status() === 200,
        reason:
          res.status() !== 200
            ? `Expected 200 with relationTypes filter, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(200);
    });

    test("topology-ci with direction=upstream returns 200", async ({
      request,
    }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}?direction=upstream`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      const step: StepResult = {
        step: "direction_upstream",
        status: res.status(),
        pass: res.status() === 200,
        reason:
          res.status() !== 200
            ? `Expected 200 with direction=upstream, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(200);
    });

    test("topology-ci with invalid depth returns 400", async ({ request }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}?depth=10`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      const step: StepResult = {
        step: "invalid_depth",
        status: res.status(),
        pass: res.status() === 400,
        reason:
          res.status() !== 400
            ? `Expected 400 for depth=10, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(400);
    });

    test("topology-ci for nonexistent CI returns 404", async ({ request }) => {
      const fakeId = "00000000-dead-beef-0000-000000000000";
      const url = `${BASE_URL}/grc/cmdb/topology/ci/${fakeId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      const step: StepResult = {
        step: "not_found",
        status: res.status(),
        pass: res.status() === 404,
        reason:
          res.status() !== 404
            ? `Expected 404 for nonexistent CI, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(404);
    });

    test("topology-ci without auth returns 401", async ({ request }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}`;
      const res = await request.get(url, {
        headers: { "x-tenant-id": auth.tenantId },
      });

      const step: StepResult = {
        step: "no_auth_401",
        status: res.status(),
        pass: res.status() === 401,
        reason:
          res.status() !== 401
            ? `Expected 401 without token, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(401);
    });

    test("topology-ci nodeCount matches nodes array length", async ({
      request,
    }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      if (res.status() !== 200) {
        test.skip(true, `GET returned ${res.status()}`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);
      const nodes = body.nodes as unknown[];
      const meta = body.meta as Record<string, unknown>;

      const step: StepResult = {
        step: "node_count_consistency",
        pass: (meta.nodeCount as number) === nodes.length,
        reason:
          meta.nodeCount !== nodes.length
            ? `meta.nodeCount=${meta.nodeCount} but nodes.length=${nodes.length}`
            : undefined,
      };
      steps.push(step);

      expect(meta.nodeCount).toBe(nodes.length);
    });

    test("topology-ci edgeCount matches edges array length", async ({
      request,
    }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      if (res.status() !== 200) {
        test.skip(true, `GET returned ${res.status()}`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);
      const edges = body.edges as unknown[];
      const meta = body.meta as Record<string, unknown>;

      const step: StepResult = {
        step: "edge_count_consistency",
        pass: (meta.edgeCount as number) === edges.length,
        reason:
          meta.edgeCount !== edges.length
            ? `meta.edgeCount=${meta.edgeCount} but edges.length=${edges.length}`
            : undefined,
      };
      steps.push(step);

      expect(meta.edgeCount).toBe(edges.length);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Topology for Service
  // --------------------------------------------------------------------------
  test.describe("topology-service", () => {
    const steps: StepResult[] = [];
    const startTime = Date.now();
    let serviceId: string | null = null;

    test.afterAll(() => {
      const result: TableResult = {
        table: "cmdb/topology-service",
        tier: 1,
        steps,
        pass: steps.every((s) => s.pass),
        durationMs: Date.now() - startTime,
      };
      addTableResult(result);
    });

    test("discover a Service to test topology", async ({ request }) => {
      const url = `${BASE_URL}/grc/cmdb/services`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
        params: { page: "1", limit: "1" },
      });

      const step: StepResult = {
        step: "discover_service",
        status: res.status(),
        pass: res.status() === 200,
        reason:
          res.status() !== 200
            ? `Expected 200, got ${res.status()} — GET ${url}`
            : undefined,
      };

      if (res.status() === 200) {
        const raw = await res.json();
        const body = unwrap(raw);
        const items = body.items as Array<{ id: string }>;
        if (items && items.length > 0) {
          serviceId = items[0].id;
        } else {
          step.reason =
            "No Services found — topology-service tests will be skipped";
        }
      }

      steps.push(step);
      expect(res.status()).toBe(200);
    });

    test("GET topology/service/:serviceId returns 200", async ({
      request,
    }) => {
      if (!serviceId) {
        test.skip(true, "No Service available for topology test");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/service/${serviceId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      const step: StepResult = {
        step: "get_topology_service",
        status: res.status(),
        pass: res.status() === 200,
        reason:
          res.status() !== 200
            ? `Expected 200, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(200);
    });

    test("topology-service response has expected top-level keys", async ({
      request,
    }) => {
      if (!serviceId) {
        test.skip(true, "No Service available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/service/${serviceId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      if (res.status() !== 200) {
        test.skip(true, `GET returned ${res.status()}, skipping contract`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);
      const missingKeys = EXPECTED_TOP_KEYS.filter((k) => !(k in body));

      const step: StepResult = {
        step: "contract_top_keys",
        pass: missingKeys.length === 0,
        reason:
          missingKeys.length > 0
            ? `Missing keys: [${missingKeys.join(", ")}]`
            : undefined,
      };
      steps.push(step);

      expect(missingKeys).toHaveLength(0);
    });

    test("topology-service meta has expected keys", async ({ request }) => {
      if (!serviceId) {
        test.skip(true, "No Service available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/service/${serviceId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      if (res.status() !== 200) {
        test.skip(true, `GET returned ${res.status()}, skipping meta check`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);
      const meta = body.meta as Record<string, unknown>;
      const missingKeys = EXPECTED_META_KEYS.filter((k) => !(k in meta));

      const step: StepResult = {
        step: "contract_meta_keys",
        pass: missingKeys.length === 0,
        reason:
          missingKeys.length > 0
            ? `Missing meta keys: [${missingKeys.join(", ")}]`
            : undefined,
      };
      steps.push(step);

      expect(missingKeys).toHaveLength(0);
    });

    test("topology-service rootNodeId matches requested serviceId", async ({
      request,
    }) => {
      if (!serviceId) {
        test.skip(true, "No Service available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/service/${serviceId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      if (res.status() !== 200) {
        test.skip(true, `GET returned ${res.status()}`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);
      const meta = body.meta as Record<string, unknown>;

      const step: StepResult = {
        step: "root_node_match",
        pass: meta.rootNodeId === serviceId,
        reason:
          meta.rootNodeId !== serviceId
            ? `rootNodeId "${meta.rootNodeId}" !== serviceId "${serviceId}"`
            : undefined,
      };
      steps.push(step);

      expect(meta.rootNodeId).toBe(serviceId);
    });

    test("topology-service with depth=2 returns 200", async ({ request }) => {
      if (!serviceId) {
        test.skip(true, "No Service available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/service/${serviceId}?depth=2`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      const step: StepResult = {
        step: "depth_2",
        status: res.status(),
        pass: res.status() === 200,
        reason:
          res.status() !== 200
            ? `Expected 200 with depth=2, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(200);
    });

    test("topology-service without auth returns 401", async ({ request }) => {
      if (!serviceId) {
        test.skip(true, "No Service available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/service/${serviceId}`;
      const res = await request.get(url, {
        headers: { "x-tenant-id": auth.tenantId },
      });

      const step: StepResult = {
        step: "no_auth_401",
        status: res.status(),
        pass: res.status() === 401,
        reason:
          res.status() !== 401
            ? `Expected 401 without token, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(401);
    });

    test("topology-service for nonexistent service returns 404", async ({
      request,
    }) => {
      const fakeId = "00000000-dead-beef-0000-000000000000";
      const url = `${BASE_URL}/grc/cmdb/topology/service/${fakeId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      const step: StepResult = {
        step: "not_found",
        status: res.status(),
        pass: res.status() === 404,
        reason:
          res.status() !== 404
            ? `Expected 404 for nonexistent service, got ${res.status()}`
            : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(404);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Cross-cutting: annotations extension point
  // --------------------------------------------------------------------------
  test.describe("topology-annotations", () => {
    const steps: StepResult[] = [];
    const startTime = Date.now();
    let ciId: string | null = null;

    test.afterAll(() => {
      const result: TableResult = {
        table: "cmdb/topology-annotations",
        tier: 2,
        steps,
        pass: steps.every((s) => s.pass),
        durationMs: Date.now() - startTime,
      };
      addTableResult(result);
    });

    test("discover CI for annotations check", async ({ request }) => {
      const url = `${BASE_URL}/grc/cmdb/cis`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
        params: { page: "1", limit: "1" },
      });
      if (res.status() === 200) {
        const raw = await res.json();
        const body = unwrap(raw);
        const items = body.items as Array<{ id: string }>;
        if (items && items.length > 0) ciId = items[0].id;
      }
      expect(res.status()).toBe(200);
    });

    test("annotations object exists and is valid", async ({ request }) => {
      if (!ciId) {
        test.skip(true, "No CI available");
        return;
      }

      const url = `${BASE_URL}/grc/cmdb/topology/ci/${ciId}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
      });

      if (res.status() !== 200) {
        test.skip(true, `GET returned ${res.status()}`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);
      const annotations = body.annotations as Record<string, unknown>;

      const step: StepResult = {
        step: "annotations_exists",
        pass:
          annotations !== null &&
          annotations !== undefined &&
          typeof annotations === "object",
        reason:
          typeof annotations !== "object"
            ? `annotations is ${typeof annotations}, expected object`
            : undefined,
      };
      steps.push(step);

      expect(annotations).toBeDefined();
      expect(typeof annotations).toBe("object");
    });
  });
});
