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
    `analytics-smoke.spec.ts MUST run in REAL_STACK mode (got E2E_MODE="${E2E_MODE}"). ` +
      "This suite validates real analytics API contracts.",
  );
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";

// ============================================================================
// Analytics endpoint definitions
// ============================================================================

interface AnalyticsEndpointDef {
  name: string;
  path: string;
  /** Top-level keys expected in the unwrapped response */
  expectedKeys: string[];
}

const ANALYTICS_ENDPOINTS: AnalyticsEndpointDef[] = [
  {
    name: "executive-summary",
    path: "/grc/itsm/analytics/executive-summary",
    expectedKeys: [
      "kpis",
      "problemTrend",
      "majorIncidentTrend",
      "closureEffectiveness",
      "severityDistribution",
      "generatedAt",
    ],
  },
  {
    name: "problem-trends",
    path: "/grc/itsm/analytics/problem-trends",
    expectedKeys: [
      "stateDistribution",
      "priorityDistribution",
      "categoryDistribution",
      "trend",
      "aging",
      "reopenedCount",
      "avgDaysOpen",
      "generatedAt",
    ],
  },
  {
    name: "major-incident-metrics",
    path: "/grc/itsm/analytics/major-incident-metrics",
    expectedKeys: [
      "totalCount",
      "byStatus",
      "bySeverity",
      "mttrHours",
      "avgBridgeDurationHours",
      "pirCompletionRate",
      "trend",
      "generatedAt",
    ],
  },
  {
    name: "pir-effectiveness",
    path: "/grc/itsm/analytics/pir-effectiveness",
    expectedKeys: [
      "totalPirs",
      "statusDistribution",
      "actionCompletionRate",
      "actionOverdueCount",
      "avgDaysToCompleteAction",
      "knowledgeCandidateCount",
      "knowledgeCandidatesByStatus",
      "generatedAt",
    ],
  },
  {
    name: "known-error-lifecycle",
    path: "/grc/itsm/analytics/known-error-lifecycle",
    expectedKeys: [
      "totalCount",
      "stateDistribution",
      "fixStatusDistribution",
      "publicationRate",
      "retirementRate",
      "problemToKeConversionRate",
      "generatedAt",
    ],
  },
  {
    name: "closure-effectiveness",
    path: "/grc/itsm/analytics/closure-effectiveness",
    expectedKeys: [
      "problemClosureRateTrend",
      "reopenedProblemRate",
      "reopenedProblems",
      "actionClosureRate",
      "avgDaysToCloseProblem",
      "avgDaysToCloseAction",
      "pirClosureRate",
      "generatedAt",
    ],
  },
  {
    name: "backlog",
    path: "/grc/itsm/analytics/backlog",
    expectedKeys: [
      "openProblemsByPriority",
      "openActionsByPriority",
      "overdueActions",
      "staleItems",
      "items",
      "generatedAt",
    ],
  },
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

test.describe("Analytics Smoke Tests", () => {
  for (const endpoint of ANALYTICS_ENDPOINTS) {
    test.describe(endpoint.name, () => {
      const steps: StepResult[] = [];
      const startTime = Date.now();

      test.afterAll(() => {
        const result: TableResult = {
          table: `analytics/${endpoint.name}`,
          tier: 1,
          steps,
          pass: steps.every((s) => s.pass),
          durationMs: Date.now() - startTime,
        };
        addTableResult(result);
      });

      test(`GET ${endpoint.name} returns 200`, async ({ request }) => {
        const url = `${BASE_URL}${endpoint.path}`;
        const res = await request.get(url, {
          headers: authHeaders(auth.token, auth.tenantId),
        });

        if (res.status() === 403) {
          const step: StepResult = {
            step: "get",
            status: 403,
            pass: true,
            reason: `Skipped: user role '${auth.role}' lacks ITSM_STATISTICS_READ permission`,
          };
          steps.push(step);
          test.skip(
            true,
            `GET ${endpoint.name} requires ITSM_STATISTICS_READ permission`,
          );
          return;
        }

        const step: StepResult = {
          step: "get",
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
          `GET ${endpoint.name}: expected 200 but got ${res.status()} — GET ${url}`,
        ).toBe(200);
      });

      test(`${endpoint.name} response has expected keys`, async ({
        request,
      }) => {
        const url = `${BASE_URL}${endpoint.path}`;
        const res = await request.get(url, {
          headers: authHeaders(auth.token, auth.tenantId),
        });

        if (res.status() !== 200) {
          test.skip(
            true,
            `GET returned ${res.status()}, skipping contract check`,
          );
          return;
        }

        const raw = await res.json();
        const body = unwrap(raw);

        const missingKeys = endpoint.expectedKeys.filter(
          (key) => !(key in body),
        );

        const step: StepResult = {
          step: "contract_keys",
          pass: missingKeys.length === 0,
          reason:
            missingKeys.length > 0
              ? `Missing keys: [${missingKeys.join(", ")}] in response for ${endpoint.name}. ` +
                `Actual keys: [${Object.keys(body).join(", ")}]`
              : undefined,
        };
        steps.push(step);

        expect(
          missingKeys,
          `${endpoint.name} response missing keys: ${missingKeys.join(", ")}`,
        ).toHaveLength(0);
      });

      test(`${endpoint.name} has valid generatedAt timestamp`, async ({
        request,
      }) => {
        const url = `${BASE_URL}${endpoint.path}`;
        const res = await request.get(url, {
          headers: authHeaders(auth.token, auth.tenantId),
        });

        if (res.status() !== 200) {
          test.skip(
            true,
            `GET returned ${res.status()}, skipping timestamp check`,
          );
          return;
        }

        const raw = await res.json();
        const body = unwrap(raw);

        const generatedAt = body.generatedAt as string;
        const parsedDate = new Date(generatedAt);

        const step: StepResult = {
          step: "timestamp_valid",
          pass: !isNaN(parsedDate.getTime()),
          reason: isNaN(parsedDate.getTime())
            ? `generatedAt "${generatedAt}" is not a valid ISO date`
            : undefined,
        };
        steps.push(step);

        expect(parsedDate.getTime()).not.toBeNaN();
      });
    });
  }
});
