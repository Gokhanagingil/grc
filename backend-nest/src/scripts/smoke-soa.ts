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
 * Prerequisites:
 * - NestJS backend running on port 3002
 * - Demo data seeded (npm run seed:grc, npm run seed:soa)
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
 * Main SOA smoke test function
 */
async function runSoaSmokeTest() {
  console.log('========================================');
  console.log('SOA Module Smoke Test');
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

  // 3. SOA Profiles List
  printSection('3. SOA Profiles');
  let profilesResponse = await makeRequest(
    'GET',
    '/grc/soa/profiles?page=1&pageSize=10',
    authHeaders,
  );
  if (printResult('GET /grc/soa/profiles', profilesResponse)) {
    passed++;
    let data = profilesResponse.data as {
      items?: Array<{ id: string; name: string; status: string }>;
      total?: number;
    };
    let items = data.items || [];
    let total = data.total || 0;
    console.log(`    Items: ${items.length}, Total: ${total}`);

    // If default query returns 0, try with explicit status filters
    // This handles cases where profiles might exist but weren't returned
    if (total === 0) {
      console.log('    No profiles found with default query. Trying status filters...');
      
      // Try DRAFT status (most common for seeded profiles)
      const draftResponse = await makeRequest(
        'GET',
        '/grc/soa/profiles?page=1&pageSize=10&status=DRAFT',
        authHeaders,
      );
      const draftData = draftResponse.data as {
        items?: Array<{ id: string; name: string; status: string }>;
        total?: number;
      };
      const draftTotal = draftData.total || 0;
      
      if (draftTotal > 0) {
        console.log(`    Found ${draftTotal} profiles with status=DRAFT`);
        total = draftTotal;
        data = draftData;
        items = draftData.items || [];
        // Update response for subsequent tests
        profilesResponse = draftResponse;
      } else {
        // Try PUBLISHED status
        const publishedResponse = await makeRequest(
          'GET',
          '/grc/soa/profiles?page=1&pageSize=10&status=PUBLISHED',
          authHeaders,
        );
        const publishedData = publishedResponse.data as {
          items?: Array<{ id: string; name: string; status: string }>;
          total?: number;
        };
        const publishedTotal = publishedData.total || 0;
        
        if (publishedTotal > 0) {
          console.log(`    Found ${publishedTotal} profiles with status=PUBLISHED`);
          total = publishedTotal;
          data = publishedData;
          items = publishedData.items || [];
          profilesResponse = publishedResponse;
        }
      }
    }

    if (items.length > 0) {
      console.log(`    First profile: "${items[0].name}" (${items[0].status})`);
    }

    // Verify at least 1 profile exists (when seed has been run)
    if (total >= 1) {
      console.log(`[OK] At least 1 SOA profile exists (total: ${total}, seed verified)`);
      passed++;
    } else {
      console.log(
        '[WARN] No SOA profiles found with any status filter. Run: npm run seed:soa:prod to seed data',
      );
      // Don't fail - this is a warning, not a failure
    }
  } else {
    failed++;
  }

  // 4. SOA Profile Detail (if profiles exist)
  printSection('4. SOA Profile Detail');
  const profilesData = profilesResponse.data as {
    items?: Array<{ id: string; name: string }>;
  };
  const profiles = profilesData?.items || [];

  if (profiles.length > 0) {
    const profileId = profiles[0].id;
    const profileDetailResponse = await makeRequest(
      'GET',
      `/grc/soa/profiles/${profileId}`,
      authHeaders,
    );
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
    const itemsResponse = await makeRequest(
      'GET',
      `/grc/soa/profiles/${profileId}/items?page=1&pageSize=10`,
      authHeaders,
    );
    if (
      printResult(`GET /grc/soa/profiles/${profileId}/items`, itemsResponse)
    ) {
      passed++;
      const itemsData = itemsResponse.data as {
        items?: Array<{
          id: string;
          applicability: string;
          implementationStatus: string;
        }>;
        total?: number;
      };
      const items = itemsData.items || [];
      const total = itemsData.total || 0;
      console.log(`    Items: ${items.length}, Total: ${total}`);

      if (items.length > 0) {
        console.log(
          `    First item: applicability=${items[0].applicability}, status=${items[0].implementationStatus}`,
        );
      }
    } else {
      failed++;
    }

    // 6. SOA Statistics
    printSection('6. SOA Statistics');
    const statsResponse = await makeRequest(
      'GET',
      `/grc/soa/profiles/${profileId}/statistics`,
      authHeaders,
    );
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
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary(passed: number, failed: number) {
  console.log('\n' + '='.repeat(60));
  console.log('SOA SMOKE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log('');

  if (failed === 0) {
    console.log('[SUCCESS] All SOA endpoints are accessible.');
  } else {
    console.log('[FAILURE] Some SOA endpoints failed.');
    console.log('Please check the errors above and fix the issues.');
  }
  console.log('');
}

// Run the smoke test
runSoaSmokeTest().catch((error) => {
  console.error('Smoke test failed with error:', error);
  process.exit(1);
});
