import { APIRequestContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

export interface AuthTokens {
  token: string;
  userId: string;
  role: string;
  tenantId: string;
}

const DEFAULT_TENANT_ID =
  process.env.SMOKE_TENANT_ID || "00000000-0000-0000-0000-000000000001";

export interface TableResult {
  table: string;
  tier: number;
  steps: StepResult[];
  pass: boolean;
  durationMs: number;
}

export interface StepResult {
  step: string;
  pass: boolean;
  status?: number;
  reason?: string;
}

const REPORT_DIR = path.join(__dirname, "..", "..", "test-results");
const REPORT_PATH = path.join(REPORT_DIR, "platform-health-report.json");

let collectedResults: TableResult[] = [];

export function resetReport(): void {
  collectedResults = [];
}

export function addTableResult(result: TableResult): void {
  collectedResults.push(result);
}

export function writeReport(): void {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: collectedResults.length,
      passed: collectedResults.filter((r) => r.pass).length,
      failed: collectedResults.filter((r) => !r.pass).length,
    },
    tables: collectedResults,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

export async function authenticate(
  request: APIRequestContext,
  baseURL: string,
): Promise<AuthTokens> {
  const email =
    process.env.SMOKE_TEST_EMAIL || process.env.DEMO_ADMIN_EMAIL || "admin@grc.local";
  const password =
    process.env.SMOKE_TEST_PASSWORD || process.env.DEMO_ADMIN_PASSWORD || "Admin123!";

  const loginRes = await request.post(`${baseURL}/auth/login`, {
    data: { email, password },
    headers: { "x-tenant-id": DEFAULT_TENANT_ID },
  });

  if (loginRes.ok()) {
    const raw = await loginRes.json();
    const body = raw.data || raw;
    const user = body.user || {};
    return {
      token: body.accessToken || body.access_token || body.token,
      userId: user.id || "",
      role: user.role || "user",
      tenantId: user.tenantId || DEFAULT_TENANT_ID,
    };
  }

  throw new Error(`Auth failed: login=${loginRes.status()}`);
}

export function authHeaders(
  token: string,
  tenantId?: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-tenant-id": tenantId || DEFAULT_TENANT_ID,
  };
}

export function resolveNestedPath(
  obj: Record<string, unknown>,
  dotPath: string,
): unknown {
  return dotPath.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
