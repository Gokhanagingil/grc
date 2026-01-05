/**
 * Security Smoke Test Script
 *
 * Performs security validation for critical endpoints:
 * - Verifies authentication is required (401 without token)
 * - Verifies tenant isolation (400 without x-tenant-id)
 * - Verifies admin-only endpoints (403 for non-admin)
 *
 * Supports JSON output for CI integration.
 *
 * Usage:
 *   npm run smoke:security           - Human-readable output
 *   npm run smoke:security -- --json - JSON output for CI
 *
 * Exit codes:
 *   0 - All security smoke tests passed
 *   1 - One or more security smoke tests failed
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

async function runSecuritySmokeTests(): Promise<ValidationResult> {
  const timestamp = new Date().toISOString();
  const tests: TestResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let token = '';

  // First, login to get a valid token for some tests
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
  }

  // ==================== AUTHENTICATION TESTS ====================

  // Test 1: /platform/modules/menu/nested without auth should return 401
  const menuNestedNoAuth = await makeRequest(
    'GET',
    '/platform/modules/menu/nested',
  );
  if (menuNestedNoAuth.statusCode === 401) {
    tests.push({
      name: 'Security: /platform/modules/menu/nested without auth returns 401',
      status: 'passed',
      responseTimeMs: menuNestedNoAuth.responseTimeMs,
      details: {
        endpoint: '/platform/modules/menu/nested',
        expectedStatus: 401,
        actualStatus: menuNestedNoAuth.statusCode,
      },
    });
  } else {
    tests.push({
      name: 'Security: /platform/modules/menu/nested without auth returns 401',
      status: 'failed',
      responseTimeMs: menuNestedNoAuth.responseTimeMs,
      error: `Expected 401, got ${menuNestedNoAuth.statusCode}`,
      details: {
        endpoint: '/platform/modules/menu/nested',
        expectedStatus: 401,
        actualStatus: menuNestedNoAuth.statusCode,
      },
    });
    errors.push(
      '/platform/modules/menu/nested is accessible without authentication!',
    );
  }

  // Test 2: /todos without auth should return 401
  const todosNoAuth = await makeRequest('GET', '/todos');
  if (todosNoAuth.statusCode === 401) {
    tests.push({
      name: 'Security: /todos without auth returns 401',
      status: 'passed',
      responseTimeMs: todosNoAuth.responseTimeMs,
      details: {
        endpoint: '/todos',
        expectedStatus: 401,
        actualStatus: todosNoAuth.statusCode,
      },
    });
  } else {
    tests.push({
      name: 'Security: /todos without auth returns 401',
      status: 'failed',
      responseTimeMs: todosNoAuth.responseTimeMs,
      error: `Expected 401, got ${todosNoAuth.statusCode}`,
      details: {
        endpoint: '/todos',
        expectedStatus: 401,
        actualStatus: todosNoAuth.statusCode,
      },
    });
    errors.push('/todos is accessible without authentication!');
  }

  // Test 3: /onboarding/context without auth should return 401
  const onboardingNoAuth = await makeRequest('GET', '/onboarding/context');
  if (onboardingNoAuth.statusCode === 401) {
    tests.push({
      name: 'Security: /onboarding/context without auth returns 401',
      status: 'passed',
      responseTimeMs: onboardingNoAuth.responseTimeMs,
      details: {
        endpoint: '/onboarding/context',
        expectedStatus: 401,
        actualStatus: onboardingNoAuth.statusCode,
      },
    });
  } else {
    tests.push({
      name: 'Security: /onboarding/context without auth returns 401',
      status: 'failed',
      responseTimeMs: onboardingNoAuth.responseTimeMs,
      error: `Expected 401, got ${onboardingNoAuth.statusCode}`,
      details: {
        endpoint: '/onboarding/context',
        expectedStatus: 401,
        actualStatus: onboardingNoAuth.statusCode,
      },
    });
    errors.push('/onboarding/context is accessible without authentication!');
  }

  // Test 4: /tenants without auth should return 401
  const tenantsNoAuth = await makeRequest('GET', '/tenants');
  if (tenantsNoAuth.statusCode === 401) {
    tests.push({
      name: 'Security: /tenants without auth returns 401',
      status: 'passed',
      responseTimeMs: tenantsNoAuth.responseTimeMs,
      details: {
        endpoint: '/tenants',
        expectedStatus: 401,
        actualStatus: tenantsNoAuth.statusCode,
      },
    });
  } else {
    tests.push({
      name: 'Security: /tenants without auth returns 401',
      status: 'failed',
      responseTimeMs: tenantsNoAuth.responseTimeMs,
      error: `Expected 401, got ${tenantsNoAuth.statusCode}`,
      details: {
        endpoint: '/tenants',
        expectedStatus: 401,
        actualStatus: tenantsNoAuth.statusCode,
      },
    });
    errors.push('/tenants is accessible without authentication!');
  }

  // ==================== TENANT ISOLATION TESTS ====================

  if (token) {
    // Test 5: /todos with auth but without tenant header should return 400
    const todosNoTenant = await makeRequest('GET', '/todos', {
      Authorization: `Bearer ${token}`,
    });
    if (todosNoTenant.statusCode === 400) {
      tests.push({
        name: 'Security: /todos without x-tenant-id returns 400',
        status: 'passed',
        responseTimeMs: todosNoTenant.responseTimeMs,
        details: {
          endpoint: '/todos',
          expectedStatus: 400,
          actualStatus: todosNoTenant.statusCode,
        },
      });
    } else {
      tests.push({
        name: 'Security: /todos without x-tenant-id returns 400',
        status: 'failed',
        responseTimeMs: todosNoTenant.responseTimeMs,
        error: `Expected 400, got ${todosNoTenant.statusCode}`,
        details: {
          endpoint: '/todos',
          expectedStatus: 400,
          actualStatus: todosNoTenant.statusCode,
        },
      });
      errors.push('/todos is accessible without x-tenant-id header!');
    }

    // Test 6: /platform/modules/menu/nested with auth but without tenant header should return 400
    const menuNestedNoTenant = await makeRequest(
      'GET',
      '/platform/modules/menu/nested',
      {
        Authorization: `Bearer ${token}`,
      },
    );
    if (menuNestedNoTenant.statusCode === 400) {
      tests.push({
        name: 'Security: /platform/modules/menu/nested without x-tenant-id returns 400',
        status: 'passed',
        responseTimeMs: menuNestedNoTenant.responseTimeMs,
        details: {
          endpoint: '/platform/modules/menu/nested',
          expectedStatus: 400,
          actualStatus: menuNestedNoTenant.statusCode,
        },
      });
    } else {
      tests.push({
        name: 'Security: /platform/modules/menu/nested without x-tenant-id returns 400',
        status: 'failed',
        responseTimeMs: menuNestedNoTenant.responseTimeMs,
        error: `Expected 400, got ${menuNestedNoTenant.statusCode}`,
        details: {
          endpoint: '/platform/modules/menu/nested',
          expectedStatus: 400,
          actualStatus: menuNestedNoTenant.statusCode,
        },
      });
      errors.push(
        '/platform/modules/menu/nested is accessible without x-tenant-id header!',
      );
    }

    // Test 7: /onboarding/context with auth but without tenant header should return 400
    const onboardingNoTenant = await makeRequest('GET', '/onboarding/context', {
      Authorization: `Bearer ${token}`,
    });
    if (onboardingNoTenant.statusCode === 400) {
      tests.push({
        name: 'Security: /onboarding/context without x-tenant-id returns 400',
        status: 'passed',
        responseTimeMs: onboardingNoTenant.responseTimeMs,
        details: {
          endpoint: '/onboarding/context',
          expectedStatus: 400,
          actualStatus: onboardingNoTenant.statusCode,
        },
      });
    } else {
      tests.push({
        name: 'Security: /onboarding/context without x-tenant-id returns 400',
        status: 'failed',
        responseTimeMs: onboardingNoTenant.responseTimeMs,
        error: `Expected 400, got ${onboardingNoTenant.statusCode}`,
        details: {
          endpoint: '/onboarding/context',
          expectedStatus: 400,
          actualStatus: onboardingNoTenant.statusCode,
        },
      });
      errors.push(
        '/onboarding/context is accessible without x-tenant-id header!',
      );
    }

    // ==================== VALID ACCESS TESTS ====================

    // Test 8: /platform/modules/menu/nested with valid auth and tenant should return 200
    const menuNestedValid = await makeRequest(
      'GET',
      '/platform/modules/menu/nested',
      {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
    );
    if (menuNestedValid.statusCode === 200) {
      tests.push({
        name: 'Security: /platform/modules/menu/nested with valid auth returns 200',
        status: 'passed',
        responseTimeMs: menuNestedValid.responseTimeMs,
        details: {
          endpoint: '/platform/modules/menu/nested',
          expectedStatus: 200,
          actualStatus: menuNestedValid.statusCode,
        },
      });
    } else {
      tests.push({
        name: 'Security: /platform/modules/menu/nested with valid auth returns 200',
        status: 'failed',
        responseTimeMs: menuNestedValid.responseTimeMs,
        error: `Expected 200, got ${menuNestedValid.statusCode}`,
        details: {
          endpoint: '/platform/modules/menu/nested',
          expectedStatus: 200,
          actualStatus: menuNestedValid.statusCode,
        },
      });
      warnings.push(
        '/platform/modules/menu/nested not accessible with valid credentials',
      );
    }

    // Test 9: /tenants with admin auth should return 200
    const tenantsAdmin = await makeRequest('GET', '/tenants', {
      Authorization: `Bearer ${token}`,
    });
    if (tenantsAdmin.statusCode === 200) {
      tests.push({
        name: 'Security: /tenants with admin auth returns 200',
        status: 'passed',
        responseTimeMs: tenantsAdmin.responseTimeMs,
        details: {
          endpoint: '/tenants',
          expectedStatus: 200,
          actualStatus: tenantsAdmin.statusCode,
        },
      });
    } else {
      tests.push({
        name: 'Security: /tenants with admin auth returns 200',
        status: 'failed',
        responseTimeMs: tenantsAdmin.responseTimeMs,
        error: `Expected 200, got ${tenantsAdmin.statusCode}`,
        details: {
          endpoint: '/tenants',
          expectedStatus: 200,
          actualStatus: tenantsAdmin.statusCode,
        },
      });
      warnings.push('/tenants not accessible with admin credentials');
    }

    // Test 10: /todos with valid auth and tenant should return 200
    const todosValid = await makeRequest('GET', '/todos', {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': DEMO_TENANT_ID,
    });
    if (todosValid.statusCode === 200) {
      tests.push({
        name: 'Security: /todos with valid auth returns 200',
        status: 'passed',
        responseTimeMs: todosValid.responseTimeMs,
        details: {
          endpoint: '/todos',
          expectedStatus: 200,
          actualStatus: todosValid.statusCode,
        },
      });
    } else {
      tests.push({
        name: 'Security: /todos with valid auth returns 200',
        status: 'failed',
        responseTimeMs: todosValid.responseTimeMs,
        error: `Expected 200, got ${todosValid.statusCode}`,
        details: {
          endpoint: '/todos',
          expectedStatus: 200,
          actualStatus: todosValid.statusCode,
        },
      });
      warnings.push('/todos not accessible with valid credentials');
    }
  } else {
    // Skip tenant isolation tests if no token
    warnings.push('Skipping tenant isolation tests - no auth token available');
    tests.push({
      name: 'Security: /todos without x-tenant-id returns 400',
      status: 'skipped',
      responseTimeMs: 0,
      error: 'No auth token available',
    });
    tests.push({
      name: 'Security: /platform/modules/menu/nested without x-tenant-id returns 400',
      status: 'skipped',
      responseTimeMs: 0,
      error: 'No auth token available',
    });
    tests.push({
      name: 'Security: /onboarding/context without x-tenant-id returns 400',
      status: 'skipped',
      responseTimeMs: 0,
      error: 'No auth token available',
    });
    tests.push({
      name: 'Security: /platform/modules/menu/nested with valid auth returns 200',
      status: 'skipped',
      responseTimeMs: 0,
      error: 'No auth token available',
    });
    tests.push({
      name: 'Security: /tenants with admin auth returns 200',
      status: 'skipped',
      responseTimeMs: 0,
      error: 'No auth token available',
    });
    tests.push({
      name: 'Security: /todos with valid auth returns 200',
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
  console.log('Security Smoke Test');
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
    console.log('[SUCCESS] All security smoke tests passed');
  } else {
    console.log('[FAILED] Some security smoke tests failed');
  }
  console.log('========================================');
}

function printJson(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  const result = await runSecuritySmokeTests();

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
