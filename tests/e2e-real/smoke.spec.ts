import { test, expect } from "@playwright/test";
import {
  authenticate,
  authHeaders,
  type AuthTokens,
} from "../platform-health/helpers";

const E2E_MODE = process.env.E2E_MODE || "REAL_STACK";
if (E2E_MODE !== "REAL_STACK") {
  throw new Error(
    `e2e-real/smoke.spec.ts MUST run in REAL_STACK mode (got E2E_MODE="${E2E_MODE}").`,
  );
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";

const ci = process.env.CI ? "CI" : "local";
console.log(
  `[E2E] suite="REAL_STACK Core Smoke" mode=${E2E_MODE} baseURL=${BASE_URL} env=${ci}`,
);

let auth: AuthTokens;

test.beforeAll(async ({ request }) => {
  auth = await authenticate(request, BASE_URL);
});

test.describe("REAL_STACK Core Smoke @real @smoke", () => {
  test("health/live returns 200", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/health/live`);
    expect(res.status()).toBe(200);
  });

  test("health/db returns 200", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/health/db`);
    expect(res.status()).toBe(200);
  });

  test("auth/login returns valid token", async () => {
    expect(auth.token).toBeTruthy();
    expect(auth.tenantId).toBeTruthy();
  });

  test("policies list returns 200 with items key", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/grc/policies`, {
      headers: authHeaders(auth.token, auth.tenantId),
      params: { page: "1", limit: "5" },
    });
    expect(res.status()).toBe(200);
    const raw = await res.json();
    const body = raw.data || raw;
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });

  test("risks list returns 200 with items key", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/grc/risks`, {
      headers: authHeaders(auth.token, auth.tenantId),
      params: { page: "1", limit: "5" },
    });
    expect(res.status()).toBe(200);
    const raw = await res.json();
    const body = raw.data || raw;
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });

  test("requirements list returns 200 with items key", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/grc/requirements`, {
      headers: authHeaders(auth.token, auth.tenantId),
      params: { page: "1", limit: "5" },
    });
    expect(res.status()).toBe(200);
    const raw = await res.json();
    const body = raw.data || raw;
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });
});
