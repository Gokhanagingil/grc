/**
 * GRC Smoke Test Script
 *
 * Quick verification script for the GRC module.
 * Logs in as demo admin and hits the main GRC endpoints.
 *
 * Usage: npm run smoke:grc
 *
 * Prerequisites:
 * - NestJS backend running on port 3002
 * - Demo data seeded (npm run seed:grc)
 */

import * as http from 'http';

// Configuration
const BASE_URL = process.env.NEST_API_URL || 'http://localhost:3002';
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_EMAIL = 'admin@grc-platform.local';
const DEMO_PASSWORD = 'TestPassword123!';

interface ApiResponse {
  statusCode: number;
  data: unknown;
  error?: string;
}

/**
 * Make an HTTP request
 */
function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown,
): Promise<ApiResponse> {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 3002,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed: unknown = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode || 0,
            data: parsed,
          });
        } catch {
          resolve({
            statusCode: res.statusCode || 0,
            data: data,
            error: 'Failed to parse JSON response',
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        statusCode: 0,
        data: null,
        error: error.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        statusCode: 0,
        data: null,
        error: 'Request timeout',
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Print a section header
 */
function printSection(title: string) {
  console.log('\n' + '='.repeat(50));
  console.log(title);
  console.log('='.repeat(50));
}

/**
 * Print result with status indicator
 */
function printResult(
  endpoint: string,
  response: ApiResponse,
  expectedStatus: number = 200,
) {
  const success = response.statusCode === expectedStatus;
  const icon = success ? '[OK]' : '[FAIL]';
  console.log(`${icon} ${endpoint} - Status: ${response.statusCode}`);

  if (!success && response.error) {
    console.log(`    Error: ${response.error}`);
  }

  return success;
}

/**
 * Main smoke test function
 */
async function runSmokeTest() {
  console.log('========================================');
  console.log('GRC Module Smoke Test');
  console.log('========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Tenant ID: ${DEMO_TENANT_ID}`);
  console.log(`Demo User: ${DEMO_EMAIL}`);
  console.log('');

  let passed = 0;
  let failed = 0;
  let token = '';

  // 1. Health Check
  printSection('1. Health Check');
  const healthResponse = await makeRequest('GET', '/health/live');
  if (printResult('GET /health/live', healthResponse)) {
    passed++;
  } else {
    failed++;
    console.log('\n[ERROR] NestJS backend is not running!');
    console.log(
      'Please start the backend: cd backend-nest && npm run start:dev',
    );
    process.exit(1);
  }

  // 2. Login
  printSection('2. Authentication');
  const loginResponse = await makeRequest(
    'POST',
    '/auth/login',
    {},
    {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    },
  );

  if (loginResponse.statusCode === 200 || loginResponse.statusCode === 201) {
    const loginData = loginResponse.data as { access_token?: string };
    token = loginData.access_token || '';
    if (token) {
      console.log('[OK] POST /auth/login - Got JWT token');
      passed++;
    } else {
      console.log('[FAIL] POST /auth/login - No token in response');
      failed++;
    }
  } else {
    console.log(
      `[FAIL] POST /auth/login - Status: ${loginResponse.statusCode}`,
    );
    console.log('    Note: Demo user may not exist. Run: npm run seed:grc');
    failed++;
  }

  if (!token) {
    console.log('\n[WARNING] Cannot continue without authentication token');
    console.log('Skipping authenticated endpoints...\n');
  }

  const authHeaders: Record<string, string> = token
    ? {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': DEMO_TENANT_ID,
      }
    : {};

  // 3. GRC Risks
  printSection('3. GRC Risks');

  if (token) {
    const risksResponse = await makeRequest('GET', '/grc/risks', authHeaders);
    if (printResult('GET /grc/risks', risksResponse)) {
      passed++;
      const risks = risksResponse.data as Array<{
        title: string;
        severity: string;
      }>;
      if (Array.isArray(risks)) {
        console.log(`    Found ${risks.length} risks`);
        if (risks.length > 0) {
          console.log(`    Sample: "${risks[0].title}" (${risks[0].severity})`);
        }
      }
    } else {
      failed++;
    }

    const riskStatsResponse = await makeRequest(
      'GET',
      '/grc/risks/statistics',
      authHeaders,
    );
    if (printResult('GET /grc/risks/statistics', riskStatsResponse)) {
      passed++;
      const stats = riskStatsResponse.data as { total?: number };
      if (stats.total !== undefined) {
        console.log(`    Total risks: ${stats.total}`);
      }
    } else {
      failed++;
    }
  } else {
    console.log('[SKIP] Skipping risk endpoints (no auth)');
  }

  // 4. GRC Policies
  printSection('4. GRC Policies');

  if (token) {
    const policiesResponse = await makeRequest(
      'GET',
      '/grc/policies',
      authHeaders,
    );
    if (printResult('GET /grc/policies', policiesResponse)) {
      passed++;
      const policies = policiesResponse.data as Array<{
        name: string;
        status: string;
      }>;
      if (Array.isArray(policies)) {
        console.log(`    Found ${policies.length} policies`);
        if (policies.length > 0) {
          console.log(
            `    Sample: "${policies[0].name}" (${policies[0].status})`,
          );
        }
      }
    } else {
      failed++;
    }

    const policyStatsResponse = await makeRequest(
      'GET',
      '/grc/policies/statistics',
      authHeaders,
    );
    if (printResult('GET /grc/policies/statistics', policyStatsResponse)) {
      passed++;
      const stats = policyStatsResponse.data as { total?: number };
      if (stats.total !== undefined) {
        console.log(`    Total policies: ${stats.total}`);
      }
    } else {
      failed++;
    }
  } else {
    console.log('[SKIP] Skipping policy endpoints (no auth)');
  }

  // 5. GRC Requirements
  printSection('5. GRC Requirements');

  if (token) {
    const requirementsResponse = await makeRequest(
      'GET',
      '/grc/requirements',
      authHeaders,
    );
    if (printResult('GET /grc/requirements', requirementsResponse)) {
      passed++;
      const requirements = requirementsResponse.data as Array<{
        title: string;
        framework: string;
      }>;
      if (Array.isArray(requirements)) {
        console.log(`    Found ${requirements.length} requirements`);
        if (requirements.length > 0) {
          console.log(
            `    Sample: "${requirements[0].title}" (${requirements[0].framework})`,
          );
        }
      }
    } else {
      failed++;
    }

    const reqStatsResponse = await makeRequest(
      'GET',
      '/grc/requirements/statistics',
      authHeaders,
    );
    if (printResult('GET /grc/requirements/statistics', reqStatsResponse)) {
      passed++;
      const stats = reqStatsResponse.data as { total?: number };
      if (stats.total !== undefined) {
        console.log(`    Total requirements: ${stats.total}`);
      }
    } else {
      failed++;
    }

    const frameworksResponse = await makeRequest(
      'GET',
      '/grc/requirements/frameworks',
      authHeaders,
    );
    if (printResult('GET /grc/requirements/frameworks', frameworksResponse)) {
      passed++;
      const frameworks = frameworksResponse.data as string[];
      if (Array.isArray(frameworks)) {
        console.log(`    Frameworks: ${frameworks.join(', ')}`);
      }
    } else {
      failed++;
    }
  } else {
    console.log('[SKIP] Skipping requirement endpoints (no auth)');
  }

  // Summary
  printSection('Summary');
  const total = passed + failed;
  const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  console.log(`Passed: ${passed}/${total} (${successRate}%)`);
  console.log(`Failed: ${failed}/${total}`);
  console.log('');

  if (failed === 0) {
    console.log('[SUCCESS] All smoke tests passed!');
    console.log('');
    console.log('The GRC module is ready for use.');
    console.log('');
    console.log('Quick API Reference:');
    console.log('  - GET  /grc/risks              List all risks');
    console.log('  - POST /grc/risks              Create a risk');
    console.log('  - GET  /grc/risks/:id          Get risk by ID');
    console.log('  - PATCH /grc/risks/:id         Update a risk');
    console.log('  - DELETE /grc/risks/:id        Soft delete a risk');
    console.log('  (Same pattern for /grc/policies and /grc/requirements)');
    console.log('');
    console.log('Required headers:');
    console.log('  - Authorization: Bearer <jwt_token>');
    console.log(`  - x-tenant-id: ${DEMO_TENANT_ID}`);
  } else {
    console.log('[WARNING] Some smoke tests failed.');
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Ensure NestJS backend is running: npm run start:dev');
    console.log('  2. Ensure PostgreSQL is running and configured');
    console.log('  3. Run seed script: npm run seed:grc');
    console.log('  4. Check .env file for correct database credentials');
  }

  console.log('\n========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run the smoke test
runSmokeTest().catch((error) => {
  console.error('Smoke test error:', error);
  process.exit(1);
});
