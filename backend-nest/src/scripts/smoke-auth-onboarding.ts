/**
 * Auth & Onboarding Smoke Test Script
 *
 * Performs minimum smoke validation for authentication and onboarding:
 * - Login with demo admin credentials
 * - Fetch onboarding context
 * - Verify basic API responses
 *
 * Supports JSON output for CI integration.
 *
 * Usage:
 *   npm run smoke:auth-onboarding           - Human-readable output
 *   npm run smoke:auth-onboarding -- --json - JSON output for CI
 *
 * Exit codes:
 *   0 - All smoke tests passed
 *   1 - One or more smoke tests failed
 */

import * as http from 'http';
import * as https from 'https';
import { config } from 'dotenv';

config();

const BASE_URL = process.env.NEST_API_URL || 'http://localhost:3002';
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
const DEMO_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

interface ApiResponse {
  statusCode: number;
  data: unknown;
  error?: string;
  responseTimeMs: number;
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  responseTimeMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface ValidationResult {
  success: boolean;
  timestamp: string;
  baseUrl: string;
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  errors: string[];
  warnings: string[];
}

function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown,
): Promise<ApiResponse> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 3002),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 15000,
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const responseTimeMs = Date.now() - startTime;
        try {
          const parsed: unknown = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode || 0,
            data: parsed,
            responseTimeMs,
          });
        } catch {
          resolve({
            statusCode: res.statusCode || 0,
            data: data,
            error: 'Failed to parse JSON response',
            responseTimeMs,
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        statusCode: 0,
        data: null,
        error: error.message,
        responseTimeMs: Date.now() - startTime,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        statusCode: 0,
        data: null,
        error: 'Request timeout',
        responseTimeMs: Date.now() - startTime,
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runSmokeTests(): Promise<ValidationResult> {
  const timestamp = new Date().toISOString();
  const tests: TestResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let token = '';

  // Test 1: Health Check (Liveness)
  const healthResult = await makeRequest('GET', '/health/live');
  if (healthResult.statusCode === 200) {
    tests.push({
      name: 'Health Check (Liveness)',
      status: 'passed',
      responseTimeMs: healthResult.responseTimeMs,
      details: { endpoint: '/health/live' },
    });
  } else {
    tests.push({
      name: 'Health Check (Liveness)',
      status: 'failed',
      responseTimeMs: healthResult.responseTimeMs,
      error: healthResult.error || `Status: ${healthResult.statusCode}`,
    });
    errors.push('Backend is not responding to health checks');
  }

  // Test 2: Health Check (Readiness)
  const readyResult = await makeRequest('GET', '/health/ready');
  if (readyResult.statusCode === 200) {
    tests.push({
      name: 'Health Check (Readiness)',
      status: 'passed',
      responseTimeMs: readyResult.responseTimeMs,
      details: { endpoint: '/health/ready' },
    });
  } else {
    tests.push({
      name: 'Health Check (Readiness)',
      status: 'failed',
      responseTimeMs: readyResult.responseTimeMs,
      error: readyResult.error || `Status: ${readyResult.statusCode}`,
    });
    errors.push('Backend readiness check failed (database may be down)');
  }

  // Test 3: Login
  const loginResult = await makeRequest(
    'POST',
    '/auth/login',
    {},
    { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  );

  if (loginResult.statusCode === 200 || loginResult.statusCode === 201) {
    const loginData = loginResult.data as {
      accessToken?: string;
      data?: { accessToken?: string };
    };
    token = loginData.data?.accessToken || loginData.accessToken || '';

    if (token) {
      tests.push({
        name: 'Authentication (Login)',
        status: 'passed',
        responseTimeMs: loginResult.responseTimeMs,
        details: { endpoint: '/auth/login', hasToken: true },
      });
    } else {
      tests.push({
        name: 'Authentication (Login)',
        status: 'failed',
        responseTimeMs: loginResult.responseTimeMs,
        error: 'No token in response',
      });
      errors.push('Login succeeded but no token returned');
    }
  } else {
    tests.push({
      name: 'Authentication (Login)',
      status: 'failed',
      responseTimeMs: loginResult.responseTimeMs,
      error: loginResult.error || `Status: ${loginResult.statusCode}`,
    });
    errors.push(`Login failed. Demo user may not exist. Run: npm run seed:grc`);
  }

  // Test 4: Onboarding Context (requires auth)
  if (token) {
    const onboardingResult = await makeRequest('GET', '/onboarding/context', {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': DEMO_TENANT_ID,
    });

    if (onboardingResult.statusCode === 200) {
      const contextData = onboardingResult.data as {
        data?: {
          context?: { activeSuites?: string[] };
          policy?: { disabledFeatures?: string[] };
        };
        context?: { activeSuites?: string[] };
        policy?: { disabledFeatures?: string[] };
      };

      const context = contextData.data?.context || contextData.context;
      const policy = contextData.data?.policy || contextData.policy;

      tests.push({
        name: 'Onboarding Context',
        status: 'passed',
        responseTimeMs: onboardingResult.responseTimeMs,
        details: {
          endpoint: '/onboarding/context',
          hasContext: !!context,
          hasPolicy: !!policy,
          activeSuites: context?.activeSuites || [],
        },
      });
    } else {
      tests.push({
        name: 'Onboarding Context',
        status: 'failed',
        responseTimeMs: onboardingResult.responseTimeMs,
        error:
          onboardingResult.error || `Status: ${onboardingResult.statusCode}`,
      });
      warnings.push('Onboarding context fetch failed');
    }

    // Test 5: Auth Me (current user)
    const meResult = await makeRequest('GET', '/auth/me', {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': DEMO_TENANT_ID,
    });

    if (meResult.statusCode === 200) {
      const userData = meResult.data as {
        data?: { email?: string };
        email?: string;
      };
      const email = userData.data?.email || userData.email;

      tests.push({
        name: 'Current User (Auth Me)',
        status: 'passed',
        responseTimeMs: meResult.responseTimeMs,
        details: {
          endpoint: '/auth/me',
          email: email || 'unknown',
        },
      });
    } else {
      tests.push({
        name: 'Current User (Auth Me)',
        status: 'failed',
        responseTimeMs: meResult.responseTimeMs,
        error: meResult.error || `Status: ${meResult.statusCode}`,
      });
      warnings.push('Auth me endpoint failed');
    }

    // Test 6: GRC Risks (basic data access)
    const risksResult = await makeRequest('GET', '/grc/risks', {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': DEMO_TENANT_ID,
    });

    if (risksResult.statusCode === 200) {
      const risksData = risksResult.data as {
        data?: unknown[];
        length?: number;
      };
      const risks = Array.isArray(risksData.data)
        ? risksData.data
        : Array.isArray(risksData)
          ? risksData
          : [];

      tests.push({
        name: 'GRC Risks Access',
        status: 'passed',
        responseTimeMs: risksResult.responseTimeMs,
        details: {
          endpoint: '/grc/risks',
          count: risks.length,
        },
      });

      if (risks.length === 0) {
        warnings.push('No risks found. Demo data may not be seeded.');
      }
    } else {
      tests.push({
        name: 'GRC Risks Access',
        status: 'failed',
        responseTimeMs: risksResult.responseTimeMs,
        error: risksResult.error || `Status: ${risksResult.statusCode}`,
      });
      warnings.push('GRC risks endpoint failed');
    }
  } else {
    // Skip authenticated tests
    tests.push({
      name: 'Onboarding Context',
      status: 'skipped',
      responseTimeMs: 0,
      error: 'No auth token available',
    });
    tests.push({
      name: 'Current User (Auth Me)',
      status: 'skipped',
      responseTimeMs: 0,
      error: 'No auth token available',
    });
    tests.push({
      name: 'GRC Risks Access',
      status: 'skipped',
      responseTimeMs: 0,
      error: 'No auth token available',
    });
  }

  const passed = tests.filter((t) => t.status === 'passed').length;
  const failed = tests.filter((t) => t.status === 'failed').length;
  const skipped = tests.filter((t) => t.status === 'skipped').length;

  return {
    success: failed === 0,
    timestamp,
    baseUrl: BASE_URL,
    tests,
    summary: {
      total: tests.length,
      passed,
      failed,
      skipped,
    },
    errors,
    warnings,
  };
}

function printHumanReadable(result: ValidationResult): void {
  console.log('========================================');
  console.log('Auth & Onboarding Smoke Test');
  console.log('========================================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Base URL: ${result.baseUrl}`);
  console.log('');

  console.log('--- Test Results ---');
  for (const test of result.tests) {
    const icon =
      test.status === 'passed'
        ? '[OK]'
        : test.status === 'failed'
          ? '[FAIL]'
          : '[SKIP]';
    console.log(`${icon} ${test.name} (${test.responseTimeMs}ms)`);
    if (test.error) {
      console.log(`    Error: ${test.error}`);
    }
    if (test.details && Object.keys(test.details).length > 0) {
      for (const [key, value] of Object.entries(test.details)) {
        if (key !== 'endpoint') {
          console.log(`    ${key}: ${JSON.stringify(value)}`);
        }
      }
    }
  }
  console.log('');

  console.log('--- Summary ---');
  console.log(`Total: ${result.summary.total}`);
  console.log(`Passed: ${result.summary.passed}`);
  console.log(`Failed: ${result.summary.failed}`);
  console.log(`Skipped: ${result.summary.skipped}`);
  console.log('');

  if (result.warnings.length > 0) {
    console.log('--- Warnings ---');
    for (const warning of result.warnings) {
      console.log(`[WARN] ${warning}`);
    }
    console.log('');
  }

  if (result.errors.length > 0) {
    console.log('--- Errors ---');
    for (const error of result.errors) {
      console.log(`[ERROR] ${error}`);
    }
    console.log('');
  }

  console.log('========================================');
  if (result.success) {
    console.log('[SUCCESS] All smoke tests passed');
  } else {
    console.log('[FAILED] Some smoke tests failed');
  }
  console.log('========================================');
}

function printJson(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  const result = await runSmokeTests();

  if (jsonOutput) {
    printJson(result);
  } else {
    printHumanReadable(result);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
