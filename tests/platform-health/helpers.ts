import { APIRequestContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

export interface AuthTokens {
  token: string;
  userId: number;
  role: string;
}

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
  const username =
    process.env.SMOKE_TEST_USERNAME || `smoke_admin_${Date.now()}`;
  const email =
    process.env.SMOKE_TEST_EMAIL || `smoke_${Date.now()}@test.local`;
  const password = process.env.SMOKE_TEST_PASSWORD || "SmokeTest123!";

  if (process.env.SMOKE_TEST_USERNAME && process.env.SMOKE_TEST_PASSWORD) {
    const loginRes = await request.post(`${baseURL}/api/auth/login`, {
      data: { username, password },
    });
    if (loginRes.ok()) {
      const body = await loginRes.json();
      return { token: body.token, userId: body.user.id, role: body.user.role };
    }
  }

  const registerRes = await request.post(`${baseURL}/api/auth/register`, {
    data: {
      username,
      email,
      password,
      firstName: "Smoke",
      lastName: "Test",
      department: "QA",
    },
  });

  if (registerRes.ok()) {
    const body = await registerRes.json();
    return { token: body.token, userId: body.user.id, role: body.user.role };
  }

  const loginRes = await request.post(`${baseURL}/api/auth/login`, {
    data: { username, password },
  });

  if (!loginRes.ok()) {
    throw new Error(
      `Auth failed: register=${registerRes.status()}, login=${loginRes.status()}`,
    );
  }

  const body = await loginRes.json();
  return { token: body.token, userId: body.user.id, role: body.user.role };
}

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
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
