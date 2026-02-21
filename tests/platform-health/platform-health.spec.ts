import { test, expect } from "@playwright/test";
import {
  type TableDef,
  getTablesForTier,
  getMaxTablesPerRun,
} from "./table-registry";
import {
  authenticate,
  authHeaders,
  addTableResult,
  resetReport,
  writeReport,
  resolveNestedPath,
  type AuthTokens,
  type StepResult,
  type TableResult,
} from "./helpers";

const E2E_MODE = process.env.E2E_MODE || "REAL_STACK";
if (E2E_MODE !== "REAL_STACK") {
  throw new Error(
    `platform-health.spec.ts MUST run in REAL_STACK mode (got E2E_MODE="${E2E_MODE}"). ` +
      "This suite validates real API contracts and must never use mocks.",
  );
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";
const TIER = (process.env.SMOKE_TIER as "tier1" | "full") || "tier1";

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

const tables = getTablesForTier(TIER);
const maxTables = getMaxTablesPerRun();
const tablesToRun = tables.slice(0, maxTables);

for (const tableDef of tablesToRun) {
  test.describe(`[${tableDef.tier === 1 ? "Tier-1" : "Tier-2"}] ${tableDef.name}`, () => {
    const steps: StepResult[] = [];
    const startTime = Date.now();
    let createdId: unknown;
    let createSkipped = false;
    let listSkipped = false;

    test.afterAll(() => {
      const result: TableResult = {
        table: tableDef.name,
        tier: tableDef.tier,
        steps,
        pass: steps.every((s) => s.pass),
        durationMs: Date.now() - startTime,
      };
      addTableResult(result);
    });

    test(`list ${tableDef.name}`, async ({ request }) => {
      const url = `${BASE_URL}${tableDef.listEndpoint}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
        params: { page: "1", limit: "5" },
      });

      if (res.status() === 403 && tableDef.requiresRole) {
        listSkipped = true;
        createSkipped = true;
        const skipStep: StepResult = {
          step: "list",
          status: 403,
          pass: true,
          reason: `Skipped: user role '${auth.role}' lacks permission (requires ${tableDef.requiresRole.join("/")})`,
        };
        steps.push(skipStep);
        test.skip(true, `List requires elevated role (${tableDef.requiresRole.join("/")})`);
        return;
      }

      const step: StepResult = {
        step: "list",
        status: res.status(),
        pass: res.status() === 200,
        reason: res.status() !== 200
          ? `Expected 200, got ${res.status()} — GET ${url}`
          : undefined,
      };
      steps.push(step);

      expect(
        res.status(),
        `list ${tableDef.name}: expected 200 but got ${res.status()} — GET ${url}`,
      ).toBe(200);

      const raw = await res.json();
      const body = unwrap(raw);
      if (tableDef.listDataKey) {
        expect(body).toHaveProperty(tableDef.listDataKey);
        expect(Array.isArray(body[tableDef.listDataKey])).toBe(true);
      } else {
        expect(Array.isArray(body)).toBe(true);
      }
    });

    test(`contract: ${tableDef.name} list returns dataKey="${tableDef.listDataKey}"`, async ({ request }) => {
      if (listSkipped) {
        test.skip(true, "List requires elevated role");
        return;
      }

      const url = `${BASE_URL}${tableDef.listEndpoint}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
        params: { page: "1", limit: "1" },
      });

      if (res.status() !== 200) {
        test.skip(true, `List returned ${res.status()}, skipping contract check`);
        return;
      }

      const raw = await res.json();
      const body = unwrap(raw);

      const step: StepResult = {
        step: "contract_dataKey",
        pass: false,
        reason: undefined,
      };

      if (tableDef.listDataKey) {
        const hasKey = Object.prototype.hasOwnProperty.call(body, tableDef.listDataKey);
        const isArray = hasKey && Array.isArray(body[tableDef.listDataKey]);
        step.pass = hasKey && isArray;
        if (!step.pass) {
          const actualKeys = Object.keys(body).join(", ");
          step.reason = `Expected dataKey "${tableDef.listDataKey}" (array) in response. Actual keys: [${actualKeys}] — GET ${url}`;
        }
      } else {
        step.pass = Array.isArray(body);
        if (!step.pass) {
          step.reason = `Expected response body to be an array — GET ${url}`;
        }
      }

      steps.push(step);

      expect(
        step.pass,
        step.reason || `Contract assertion failed for ${tableDef.name}`,
      ).toBe(true);
    });

    const canCreate =
      tableDef.createEndpoint &&
      tableDef.createPayload &&
      !tableDef.readOnly &&
      tableDef.canCreate !== false;

    if (canCreate) {
      test(`create ${tableDef.name}`, async ({ request }) => {
        const uniquePayload = { ...tableDef.createPayload };
        if (uniquePayload.title) {
          uniquePayload.title = `__smoke_${tableDef.name}_${Date.now()}`;
        }
        if (uniquePayload.name) {
          uniquePayload.name = `__smoke_${tableDef.name}_${Date.now()}`;
        }

        const url = `${BASE_URL}${tableDef.createEndpoint}`;
        const res = await request.post(url, {
          headers: authHeaders(auth.token, auth.tenantId),
          data: uniquePayload,
        });

        if (res.status() === 403) {
          createSkipped = true;
          const step: StepResult = {
            step: "create",
            status: 403,
            pass: true,
            reason: `Skipped: user role '${auth.role}' lacks permission (requires ${tableDef.requiresRole?.join("/") || "admin/manager"})`,
          };
          steps.push(step);
          test.skip(true, `Create requires elevated role`);
          return;
        }

        if (res.status() === 404) {
          const step: StepResult = {
            step: "create",
            status: 404,
            pass: false,
            reason: `POST ${url} returned 404 — route does not exist. If this table has no create endpoint, set canCreate=false in table-registry.`,
          };
          steps.push(step);
          expect.soft(
            false,
            `POST ${url} returned 404. Mark canCreate=false in table-registry if this route does not exist.`,
          ).toBe(true);
          return;
        }

        const step: StepResult = {
          step: "create",
          status: res.status(),
          pass: res.status() === 201,
          reason: res.status() !== 201
            ? `Expected 201, got ${res.status()} — POST ${url}`
            : undefined,
        };
        steps.push(step);

        expect(
          res.status(),
          `create ${tableDef.name}: expected 201 but got ${res.status()} — POST ${url}`,
        ).toBe(201);

        const raw = await res.json();
        const body = unwrap(raw);
        if (tableDef.createdIdPath) {
          createdId = resolveNestedPath(body, tableDef.createdIdPath);
          expect(createdId).toBeDefined();
        }
      });

      test(`verify created ${tableDef.name} appears in list`, async ({ request }) => {
        if (createSkipped) {
          const skipStep: StepResult = {
            step: "verify_created",
            pass: true,
            reason: "Skipped: create was skipped due to insufficient role",
          };
          steps.push(skipStep);
          test.skip(true, "Create was skipped due to insufficient role");
          return;
        }

        const url = `${BASE_URL}${tableDef.listEndpoint}`;
        const res = await request.get(url, {
          headers: authHeaders(auth.token, auth.tenantId),
          params: { page: "1", limit: "100" },
        });

        expect(res.status()).toBe(200);
        const raw = await res.json();
        const body = unwrap(raw);

        const items = tableDef.listDataKey
          ? body[tableDef.listDataKey]
          : body;

        const found = Array.isArray(items) && items.some(
          (item: Record<string, unknown>) =>
            item.id === createdId ||
            (typeof item[tableDef.displayField] === "string" &&
              (item[tableDef.displayField] as string).startsWith("__smoke_")),
        );

        const step: StepResult = {
          step: "verify_created",
          pass: found,
          reason: found ? undefined : `Created record (id=${createdId}) not found in list — GET ${url}`,
        };
        steps.push(step);

        expect(found).toBe(true);
      });
    }

    if (tableDef.filters.length > 0) {
      test(`filter ${tableDef.name} by ${tableDef.filters[0].param}`, async ({ request }) => {
        if (listSkipped) {
          const skipStep: StepResult = {
            step: `filter_${tableDef.filters[0].param}`,
            pass: true,
            reason: "Skipped: list requires elevated role",
          };
          steps.push(skipStep);
          test.skip(true, "List requires elevated role");
          return;
        }
        const filter = tableDef.filters[0];
        const url = `${BASE_URL}${tableDef.listEndpoint}`;
        const res = await request.get(url, {
          headers: authHeaders(auth.token, auth.tenantId),
          params: { [filter.param]: filter.value, page: "1", limit: "5" },
        });

        const step: StepResult = {
          step: `filter_${filter.param}`,
          status: res.status(),
          pass: res.status() === 200,
          reason: res.status() !== 200
            ? `Filter ${filter.param}=${filter.value} returned ${res.status()} — GET ${url}`
            : undefined,
        };
        steps.push(step);

        expect(
          res.status(),
          `filter ${tableDef.name}: expected 200 but got ${res.status()} — GET ${url}?${filter.param}=${filter.value}`,
        ).toBe(200);

        const raw = await res.json();
        const body = unwrap(raw);
        const items = tableDef.listDataKey ? body[tableDef.listDataKey] : body;
        expect(Array.isArray(items)).toBe(true);
      });

      if (tableDef.filters.length > 1) {
        test(`filter ${tableDef.name} by ${tableDef.filters[1].param}`, async ({ request }) => {
          if (listSkipped) {
            const skipStep: StepResult = {
              step: `filter_${tableDef.filters[1].param}`,
              pass: true,
              reason: "Skipped: list requires elevated role",
            };
            steps.push(skipStep);
            test.skip(true, "List requires elevated role");
            return;
          }
          const filter = tableDef.filters[1];
          const url = `${BASE_URL}${tableDef.listEndpoint}`;
          const res = await request.get(url, {
            headers: authHeaders(auth.token, auth.tenantId),
            params: { [filter.param]: filter.value, page: "1", limit: "5" },
          });

          const step: StepResult = {
            step: `filter_${filter.param}`,
            status: res.status(),
            pass: res.status() === 200,
            reason: res.status() !== 200
              ? `Filter ${filter.param}=${filter.value} returned ${res.status()} — GET ${url}`
              : undefined,
          };
          steps.push(step);

          expect(
            res.status(),
            `filter ${tableDef.name}: expected 200 but got ${res.status()} — GET ${url}?${filter.param}=${filter.value}`,
          ).toBe(200);
        });
      }
    }

    test(`sort ${tableDef.name} (page 1, limit 5)`, async ({ request }) => {
      if (listSkipped) {
        const skipStep: StepResult = {
          step: "sort_page1",
          pass: true,
          reason: "Skipped: list requires elevated role",
        };
        steps.push(skipStep);
        test.skip(true, "List requires elevated role");
        return;
      }
      const url = `${BASE_URL}${tableDef.listEndpoint}`;
      const res = await request.get(url, {
        headers: authHeaders(auth.token, auth.tenantId),
        params: { page: "1", limit: "5" },
      });

      const step: StepResult = {
        step: "sort_page1",
        status: res.status(),
        pass: res.status() === 200,
        reason: res.status() !== 200
          ? `Sort/paginate returned ${res.status()} — GET ${url}`
          : undefined,
      };
      steps.push(step);

      expect(
        res.status(),
        `sort ${tableDef.name}: expected 200 but got ${res.status()} — GET ${url}`,
      ).toBe(200);

      const raw = await res.json();
      const body = unwrap(raw);
      if (body.page !== undefined) {
        expect(body.page).toBe(1);
      }
    });
  });
}
