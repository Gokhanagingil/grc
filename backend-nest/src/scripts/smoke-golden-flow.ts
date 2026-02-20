/**
 * Golden Flow Smoke Test Script
 *
 * Verifies all Golden Flow API endpoints are accessible:
 * Standard/Requirement -> Control -> Evidence -> Test/Result -> Finding/Issue -> CAPA -> Closure
 *
 * Usage: npm run smoke:golden-flow
 *
 * Prerequisites:
 * - NestJS backend running on port 3002
 * - Demo data seeded (npm run seed:grc)
 */

import * as http from 'http';
import { config } from 'dotenv';

// Load environment variables
config();

// Configuration
const BASE_URL = process.env.NEST_API_URL || 'http://localhost:3002';
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
const DEMO_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

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
      path: url.pathname + url.search,
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
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

/**
 * Print result with status indicator
 */
function printResult(
  endpoint: string,
  response: ApiResponse,
  expectedStatus: number = 200,
): boolean {
  const success = response.statusCode === expectedStatus;
  const icon = success ? '[OK]' : '[FAIL]';
  console.log(`${icon} ${endpoint} - Status: ${response.statusCode}`);

  if (!success) {
    if (response.error) {
      console.log(`    Error: ${response.error}`);
    }
    const errorData = response.data as { message?: string; code?: string };
    if (errorData?.message) {
      console.log(`    Message: ${errorData.message}`);
    }
    if (errorData?.code) {
      console.log(`    Code: ${errorData.code}`);
    }
  }

  return success;
}

/**
 * Main Golden Flow smoke test function
 */
async function runGoldenFlowSmokeTest() {
  console.log('========================================');
  console.log('Golden Flow API Smoke Test');
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
    console.log('\n[ERROR] NestJS backend is not running.');
    console.log(
      'Please start the backend: cd backend-nest && npm run start:dev',
    );
    process.exit(1);
  }

  // 2. Authentication
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
    const loginData = loginResponse.data as {
      access_token?: string;
      accessToken?: string;
      data?: { accessToken?: string };
    };
    token =
      loginData.data?.accessToken ||
      loginData.accessToken ||
      loginData.access_token ||
      '';
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
    printSummary(passed, failed);
    process.exit(failed > 0 ? 1 : 0);
  }

  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': DEMO_TENANT_ID,
  };

  // 3. Swagger Documentation
  printSection('3. Swagger Documentation');
  const swaggerResponse = await makeRequest('GET', '/api/docs-json');
  if (printResult('GET /api/docs-json', swaggerResponse)) {
    passed++;
    const swagger = swaggerResponse.data as { paths?: Record<string, unknown> };
    if (swagger.paths) {
      const pathCount = Object.keys(swagger.paths).length;
      console.log(`    Found ${pathCount} API paths in Swagger spec`);
      // Check for Golden Flow paths
      const goldenFlowPaths = Object.keys(swagger.paths).filter(
        (p) =>
          p.includes('/api/grc/') ||
          p.includes('/grc/requirements') ||
          p.includes('/grc/controls') ||
          p.includes('/grc/evidence') ||
          p.includes('/grc/issues') ||
          p.includes('/grc/capas'),
      );
      console.log(`    Golden Flow paths: ${goldenFlowPaths.length}`);
    }
  } else {
    failed++;
  }

  // 4. Golden Flow Endpoints - Requirements
  printSection('4. Requirements (Standard/Requirement)');
  const requirementsResponse = await makeRequest(
    'GET',
    '/api/grc/requirements',
    authHeaders,
  );
  if (printResult('GET /api/grc/requirements', requirementsResponse)) {
    passed++;
    const data = requirementsResponse.data as {
      items?: unknown[];
      total?: number;
    };
    console.log(
      `    Items: ${data.items?.length ?? 0}, Total: ${data.total ?? 0}`,
    );
  } else {
    failed++;
  }

  // 5. Golden Flow Endpoints - Controls
  printSection('5. Controls');
  const controlsResponse = await makeRequest(
    'GET',
    '/api/grc/controls',
    authHeaders,
  );
  if (printResult('GET /api/grc/controls', controlsResponse)) {
    passed++;
    const data = controlsResponse.data as {
      items?: unknown[];
      total?: number;
    };
    console.log(
      `    Items: ${data.items?.length ?? 0}, Total: ${data.total ?? 0}`,
    );
  } else {
    failed++;
  }

  // 6. Golden Flow Endpoints - Evidence
  printSection('6. Evidence');
  const evidenceResponse = await makeRequest(
    'GET',
    '/api/grc/evidence',
    authHeaders,
  );
  if (printResult('GET /api/grc/evidence', evidenceResponse)) {
    passed++;
    const data = evidenceResponse.data as {
      items?: unknown[];
      total?: number;
    };
    console.log(
      `    Items: ${data.items?.length ?? 0}, Total: ${data.total ?? 0}`,
    );
  } else {
    failed++;
  }

  // 7. Golden Flow Endpoints - Control Evidence (existing)
  printSection('7. Control Evidence (existing)');
  const controlEvidenceResponse = await makeRequest(
    'GET',
    '/api/grc/control-evidence',
    authHeaders,
  );
  if (printResult('GET /api/grc/control-evidence', controlEvidenceResponse)) {
    passed++;
    const data = controlEvidenceResponse.data as {
      items?: unknown[];
      total?: number;
    };
    console.log(
      `    Items: ${data.items?.length ?? 0}, Total: ${data.total ?? 0}`,
    );
  } else {
    failed++;
  }

  // 8. Golden Flow Endpoints - Control Tests (existing)
  printSection('8. Control Tests (existing)');
  const controlTestsResponse = await makeRequest(
    'GET',
    '/api/grc/control-tests',
    authHeaders,
  );
  if (printResult('GET /api/grc/control-tests', controlTestsResponse)) {
    passed++;
    const data = controlTestsResponse.data as {
      items?: unknown[];
      total?: number;
    };
    console.log(
      `    Items: ${data.items?.length ?? 0}, Total: ${data.total ?? 0}`,
    );
  } else {
    failed++;
  }

  // 9. Golden Flow Endpoints - Test Results (existing)
  printSection('9. Test Results (existing)');
  const testResultsResponse = await makeRequest(
    'GET',
    '/api/grc/test-results',
    authHeaders,
  );
  if (printResult('GET /api/grc/test-results', testResultsResponse)) {
    passed++;
    const data = testResultsResponse.data as {
      items?: unknown[];
      total?: number;
    };
    console.log(
      `    Items: ${data.items?.length ?? 0}, Total: ${data.total ?? 0}`,
    );
  } else {
    failed++;
  }

  // 10. Golden Flow Endpoints - Issues (Findings)
  printSection('10. Issues (Findings)');
  const issuesResponse = await makeRequest(
    'GET',
    '/api/grc/issues',
    authHeaders,
  );
  if (printResult('GET /api/grc/issues', issuesResponse)) {
    passed++;
    const data = issuesResponse.data as {
      items?: unknown[];
      total?: number;
    };
    console.log(
      `    Items: ${data.items?.length ?? 0}, Total: ${data.total ?? 0}`,
    );
  } else {
    failed++;
  }

  // 11. Golden Flow Endpoints - CAPAs
  printSection('11. CAPAs (Corrective and Preventive Actions)');
  const capasResponse = await makeRequest('GET', '/api/grc/capas', authHeaders);
  if (printResult('GET /api/grc/capas', capasResponse)) {
    passed++;
    const data = capasResponse.data as {
      items?: unknown[];
      total?: number;
    };
    console.log(
      `    Items: ${data.items?.length ?? 0}, Total: ${data.total ?? 0}`,
    );
  } else {
    failed++;
  }

  // 12. Golden Flow Endpoints - CAPA Tasks (was returning 403)
  printSection('12. CAPA Tasks (previously 403)');
  const capaTasksResponse = await makeRequest(
    'GET',
    '/api/grc/capa-tasks',
    authHeaders,
  );
  if (printResult('GET /api/grc/capa-tasks', capaTasksResponse)) {
    passed++;
    const data = capaTasksResponse.data as {
      items?: unknown[];
      total?: number;
    };
    console.log(
      `    Items: ${data.items?.length ?? 0}, Total: ${data.total ?? 0}`,
    );
  } else {
    failed++;
  }

  // Print summary
  printSummary(passed, failed);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary(passed: number, failed: number) {
  console.log('\n' + '='.repeat(60));
  console.log('GOLDEN FLOW SMOKE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log('');

  if (failed === 0) {
    console.log('[SUCCESS] All Golden Flow endpoints are accessible.');
  } else {
    console.log('[FAILURE] Some Golden Flow endpoints failed.');
    console.log('Please check the errors above and fix the issues.');
  }
  console.log('');
}

// Run the smoke test
runGoldenFlowSmokeTest().catch((error) => {
  console.error('Smoke test failed with error:', error);
  process.exit(1);
});
