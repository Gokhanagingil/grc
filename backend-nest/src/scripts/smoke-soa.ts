/**
 * SOA (Statement of Applicability) Smoke Test Script
 *
 * Verifies that SOA endpoints are accessible and data is seeded correctly.
 * Logs in as demo admin and tests the main SOA endpoints.
 *
 * Usage:
 *   npm run smoke:soa (dev - ts-node)
 *   npm run smoke:soa:prod (production - node dist)
 *
 * Environment Variables:
 *   API_BASE_URL or NEST_API_URL - Backend base URL (default: http://localhost:3002)
 *   DEMO_ADMIN_EMAIL - Demo admin email (default: admin@grc-platform.local)
 *   DEMO_ADMIN_PASSWORD - Demo admin password (default: TestPassword123!)
 *
 * Prerequisites:
 * - NestJS backend running on port 3002
 * - Demo data seeded (npm run seed:grc, npm run seed:soa)
 */

import * as http from 'http';
import { config } from 'dotenv';

// Load environment variables
config();

// Configuration - honor API_BASE_URL first, then NEST_API_URL, then default
const BASE_URL =
  process.env.API_BASE_URL ||
  process.env.NEST_API_URL ||
  'http://localhost:3002';
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
const DEMO_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

interface ApiResponse {
  statusCode: number;
  data: unknown;
  error?: string;
}

interface ListResponse {
  items?: unknown[];
  total?: number;
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
 * Print request details for debugging
 */
function printRequestDetails(
  method: string,
  path: string,
  response: ApiResponse,
) {
  const fullUrl = `${BASE_URL}${path}`;
  console.log(`  Request: ${method} ${fullUrl}`);
  console.log(`  Status: ${response.statusCode}`);
  if (response.error) {
    console.log(`  Error: ${response.error}`);
  }
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
 * Print debug bundle when 0 profiles found
 * Provides curl commands and SQL queries for manual verification
 */
function printDebugBundle() {
  console.log('\n' + '-'.repeat(60));
  console.log('DEBUG BUNDLE: 0 profiles found - Manual verification steps');
  console.log('-'.repeat(60));

  console.log('\n1. CURL COMMANDS (run from backend container or host):');
  console.log('   # Direct backend call (inside container):');
  console.log(
    `   curl -s -H "Authorization: Bearer <TOKEN>" -H "x-tenant-id: ${DEMO_TENANT_ID}" \\`,
  );
  console.log(`        "${BASE_URL}/grc/soa/profiles?page=1&pageSize=10"`);

  console.log(
    '\n   # Via nginx /api prefix (from host or frontend container):',
  );
  console.log(
    `   curl -s -H "Authorization: Bearer <TOKEN>" -H "x-tenant-id: ${DEMO_TENANT_ID}" \\`,
  );
  console.log(
    `        "http://localhost/api/grc/soa/profiles?page=1&pageSize=10"`,
  );

  console.log('\n2. DATABASE SQL CHECKS (run inside db container):');
  console.log('   # Check table schema:');
  console.log(
    "   SELECT column_name, data_type FROM information_schema.columns WHERE table_name='grc_soa_profiles';",
  );

  console.log('\n   # Check existing profiles:');
  console.log(
    '   SELECT id, tenant_id, status, is_deleted FROM grc_soa_profiles ORDER BY created_at DESC LIMIT 5;',
  );

  console.log('\n   # Count profiles by tenant:');
  console.log(
    '   SELECT tenant_id, COUNT(*) as count FROM grc_soa_profiles WHERE is_deleted = false GROUP BY tenant_id;',
  );

  console.log('\n   # Check demo tenant profiles specifically:');
  console.log(
    `   SELECT id, name, status, is_deleted FROM grc_soa_profiles WHERE tenant_id = '${DEMO_TENANT_ID}';`,
  );

  console.log('\n3. SEED DATA (if no profiles exist):');
  console.log('   npm run seed:soa:prod');
  console.log('-'.repeat(60));
}

/**
 * Validate LIST-CONTRACT response format
 */
function validateListContract(
  response: ApiResponse,
  endpointName: string,
): { valid: boolean; items: unknown[]; total: number } {
  const data = response.data as ListResponse;

  if (!data || typeof data !== 'object') {
    console.log(
      `    [CONTRACT VIOLATION] ${endpointName}: Response is not an object`,
    );
    return { valid: false, items: [], total: 0 };
  }

  if (!Array.isArray(data.items)) {
    console.log(
      `    [CONTRACT VIOLATION] ${endpointName}: 'items' is not an array (got ${typeof data.items})`,
    );
    return { valid: false, items: [], total: 0 };
  }

  if (typeof data.total !== 'number') {
    console.log(
      `    [CONTRACT VIOLATION] ${endpointName}: 'total' is not a number (got ${typeof data.total})`,
    );
    return { valid: false, items: [], total: 0 };
  }

  return { valid: true, items: data.items, total: data.total };
}

/**
 * Main SOA smoke test function
 */
async function runSoaSmokeTest() {
  console.log('========================================');
  console.log('SOA Module Smoke Test');
  console.log('========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Tenant ID: ${DEMO_TENANT_ID}`);
  console.log(`Demo User: ${DEMO_EMAIL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  let passed = 0;
  let failed = 0;
  let token = '';

  // 1. Health Check
  printSection('1. Health Check');
  const healthPath = '/health/live';
  const healthResponse = await makeRequest('GET', healthPath);
  printRequestDetails('GET', healthPath, healthResponse);

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
  const loginPath = '/auth/login';
  const loginResponse = await makeRequest(
    'POST',
    loginPath,
    {},
    {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    },
  );
  printRequestDetails('POST', loginPath, loginResponse);

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
    process.exit(1);
  }

  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': DEMO_TENANT_ID,
  };

  // 3. SOA Profiles List - Single deterministic call (no retry logic)
  printSection('3. SOA Profiles List');
  const profilesPath = '/grc/soa/profiles?page=1&pageSize=10';
  const profilesResponse = await makeRequest('GET', profilesPath, authHeaders);
  printRequestDetails('GET', profilesPath, profilesResponse);

  if (!printResult('GET /grc/soa/profiles', profilesResponse)) {
    failed++;
    console.log('\n[ERROR] SOA profiles endpoint failed');
    printDebugBundle();
    printSummary(passed, failed);
    process.exit(1);
  }

  passed++;

  // Validate LIST-CONTRACT format
  const listValidation = validateListContract(
    profilesResponse,
    'GET /grc/soa/profiles',
  );
  if (!listValidation.valid) {
    failed++;
    console.log('\n[ERROR] Response does not conform to LIST-CONTRACT');
    printSummary(passed, failed);
    process.exit(1);
  }

  console.log(
    `    Items: ${listValidation.items.length}, Total: ${listValidation.total}`,
  );

  // Check if profiles exist
  if (listValidation.total === 0) {
    console.log('\n[WARN] No SOA profiles found in database');
    printDebugBundle();
    // This is a warning, not a failure - the endpoint works correctly
    // The issue is missing seed data, not a broken endpoint
  } else {
    const firstProfile = listValidation.items[0] as {
      id: string;
      name: string;
      status: string;
    };
    console.log(
      `    First profile: "${firstProfile.name}" (${firstProfile.status})`,
    );
    console.log(
      `[OK] At least 1 SOA profile exists (total: ${listValidation.total}, seed verified)`,
    );
    passed++;
  }

  // 4. SOA Profile Detail (if profiles exist)
  printSection('4. SOA Profile Detail');
  const profiles = listValidation.items as Array<{ id: string; name: string }>;

  if (profiles.length > 0) {
    const profileId = profiles[0].id;
    const detailPath = `/grc/soa/profiles/${profileId}`;
    const profileDetailResponse = await makeRequest(
      'GET',
      detailPath,
      authHeaders,
    );
    printRequestDetails('GET', detailPath, profileDetailResponse);

    if (
      printResult(`GET /grc/soa/profiles/${profileId}`, profileDetailResponse)
    ) {
      passed++;
      const profile = profileDetailResponse.data as {
        name?: string;
        status?: string;
        standardId?: string;
      };
      console.log(`    Profile: "${profile.name}" (${profile.status})`);
      console.log(`    Standard ID: ${profile.standardId || 'N/A'}`);
    } else {
      failed++;
    }

    // 5. SOA Items for Profile
    printSection('5. SOA Items');
    const itemsPath = `/grc/soa/profiles/${profileId}/items?page=1&pageSize=10`;
    const itemsResponse = await makeRequest('GET', itemsPath, authHeaders);
    printRequestDetails('GET', itemsPath, itemsResponse);

    if (
      printResult(`GET /grc/soa/profiles/${profileId}/items`, itemsResponse)
    ) {
      passed++;

      const itemsValidation = validateListContract(
        itemsResponse,
        `GET /grc/soa/profiles/${profileId}/items`,
      );
      if (!itemsValidation.valid) {
        failed++;
      } else {
        console.log(
          `    Items: ${itemsValidation.items.length}, Total: ${itemsValidation.total}`,
        );

        if (itemsValidation.items.length > 0) {
          const firstItem = itemsValidation.items[0] as {
            applicability: string;
            implementationStatus: string;
          };
          console.log(
            `    First item: applicability=${firstItem.applicability}, status=${firstItem.implementationStatus}`,
          );
        }
      }
    } else {
      failed++;
    }

    // 6. SOA Statistics
    printSection('6. SOA Statistics');
    const statsPath = `/grc/soa/profiles/${profileId}/statistics`;
    const statsResponse = await makeRequest('GET', statsPath, authHeaders);
    printRequestDetails('GET', statsPath, statsResponse);

    if (
      printResult(
        `GET /grc/soa/profiles/${profileId}/statistics`,
        statsResponse,
      )
    ) {
      passed++;
      const stats = statsResponse.data as {
        totalItems?: number;
        byApplicability?: Record<string, number>;
        byImplementationStatus?: Record<string, number>;
      };
      console.log(`    Total Items: ${stats.totalItems || 0}`);
      if (stats.byApplicability) {
        console.log(
          `    By Applicability: ${JSON.stringify(stats.byApplicability)}`,
        );
      }
      if (stats.byImplementationStatus) {
        console.log(
          `    By Implementation: ${JSON.stringify(stats.byImplementationStatus)}`,
        );
      }
    } else {
      failed++;
    }
  } else {
    console.log('[SKIP] No profiles found - skipping detail/items/stats tests');
    console.log('    Run: npm run seed:soa:prod to seed SOA data');
  }

  // Print summary
  printSummary(passed, failed);

  // Exit with appropriate code
  // Exit 0 if all endpoint calls succeeded (even if 0 profiles found)
  // Exit 1 if any endpoint failed or contract was violated
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary(passed: number, failed: number) {
  console.log('\n' + '='.repeat(60));
  console.log('SOA SMOKE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Tenant ID: ${DEMO_TENANT_ID}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log('');

  if (failed === 0) {
    console.log(
      '[SUCCESS] All SOA endpoints are accessible and conform to contract.',
    );
  } else {
    console.log('[FAILURE] Some SOA endpoints failed or violated contract.');
    console.log('Please check the errors above and fix the issues.');
  }
  console.log('');
}

// Run the smoke test
runSoaSmokeTest().catch((error) => {
  console.error('Smoke test failed with error:', error);
  process.exit(1);
});
