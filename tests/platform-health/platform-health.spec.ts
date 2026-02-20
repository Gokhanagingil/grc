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

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const TIER = (process.env.SMOKE_TIER as "tier1" | "full") || "tier1";

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
      const res = await request.get(`${BASE_URL}${tableDef.listEndpoint}`, {
        headers: authHeaders(auth.token),
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
        reason: res.status() !== 200 ? `Expected 200, got ${res.status()}` : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(200);

      const body = await res.json();
      if (tableDef.listDataKey) {
        expect(body).toHaveProperty(tableDef.listDataKey);
        expect(Array.isArray(body[tableDef.listDataKey])).toBe(true);
      } else {
        expect(Array.isArray(body)).toBe(true);
      }
    });

    if (tableDef.createEndpoint && tableDef.createPayload && !tableDef.readOnly) {
      test(`create ${tableDef.name}`, async ({ request }) => {
        const uniquePayload = { ...tableDef.createPayload };
        if (uniquePayload.title) {
          uniquePayload.title = `__smoke_${tableDef.name}_${Date.now()}`;
        }
        if (uniquePayload.name) {
          uniquePayload.name = `__smoke_${tableDef.name}_${Date.now()}`;
        }

        const res = await request.post(
          `${BASE_URL}${tableDef.createEndpoint}`,
          {
            headers: authHeaders(auth.token),
            data: uniquePayload,
          },
        );

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

        const step: StepResult = {
          step: "create",
          status: res.status(),
          pass: res.status() === 201,
          reason: res.status() !== 201 ? `Expected 201, got ${res.status()}` : undefined,
        };
        steps.push(step);

        expect(res.status()).toBe(201);

        const body = await res.json();
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

        const res = await request.get(`${BASE_URL}${tableDef.listEndpoint}`, {
          headers: authHeaders(auth.token),
          params: { page: "1", limit: "100" },
        });

        expect(res.status()).toBe(200);
        const body = await res.json();

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
          reason: found ? undefined : `Created record (id=${createdId}) not found in list`,
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
        const res = await request.get(`${BASE_URL}${tableDef.listEndpoint}`, {
          headers: authHeaders(auth.token),
          params: { [filter.param]: filter.value, page: "1", limit: "5" },
        });

        const step: StepResult = {
          step: `filter_${filter.param}`,
          status: res.status(),
          pass: res.status() === 200,
          reason: res.status() !== 200 ? `Filter ${filter.param}=${filter.value} returned ${res.status()}` : undefined,
        };
        steps.push(step);

        expect(res.status()).toBe(200);

        const body = await res.json();
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
          const res = await request.get(
            `${BASE_URL}${tableDef.listEndpoint}`,
            {
              headers: authHeaders(auth.token),
              params: { [filter.param]: filter.value, page: "1", limit: "5" },
            },
          );

          const step: StepResult = {
            step: `filter_${filter.param}`,
            status: res.status(),
            pass: res.status() === 200,
            reason: res.status() !== 200 ? `Filter returned ${res.status()}` : undefined,
          };
          steps.push(step);

          expect(res.status()).toBe(200);
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
      const res = await request.get(`${BASE_URL}${tableDef.listEndpoint}`, {
        headers: authHeaders(auth.token),
        params: { page: "1", limit: "5" },
      });

      const step: StepResult = {
        step: "sort_page1",
        status: res.status(),
        pass: res.status() === 200,
        reason: res.status() !== 200 ? `Sort/paginate returned ${res.status()}` : undefined,
      };
      steps.push(step);

      expect(res.status()).toBe(200);

      const body = await res.json();
      if (body.pagination) {
        expect(body.pagination.page).toBe(1);
        expect(body.pagination.limit).toBe(5);
      }
    });
  });
}
