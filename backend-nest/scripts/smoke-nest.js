#!/usr/bin/env node
/**
 * Smoke Test Script for NestJS GRC Backend
 *
 * Performs health checks and basic API validation.
 * Exits with code 0 on success, 1 on failure.
 *
 * Usage: node scripts/smoke-nest.js
 * Or: npm run smoke:nest
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3002';
const TIMEOUT_MS = parseInt(process.env.SMOKE_TIMEOUT || '10000', 10);

// Test credentials (must match seed data)
const TEST_EMAIL = process.env.SMOKE_EMAIL || 'admin@grc-platform.local';
const TEST_PASSWORD = process.env.SMOKE_PASSWORD || 'TestPassword123!';
const TEST_TENANT_ID = process.env.SMOKE_TENANT_ID || '00000000-0000-0000-0000-000000000001';

const results = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    totalLatencyMs: 0,
  },
};

/**
 * Make an HTTP request and return response details
 */
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const url = new URL(options.path, BASE_URL);

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 3002,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: TIMEOUT_MS,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const latencyMs = Date.now() - startTime;
        let parsedBody = null;
        try {
          parsedBody = JSON.parse(data);
        } catch {
          parsedBody = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedBody,
          latencyMs,
        });
      });
    });

    req.on('error', (err) => {
      const latencyMs = Date.now() - startTime;
      reject({ error: err.message, latencyMs });
    });

    req.on('timeout', () => {
      req.destroy();
      const latencyMs = Date.now() - startTime;
      reject({ error: 'Request timeout', latencyMs });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Run a single test case
 */
async function runTest(name, options, expectedStatus, body = null) {
  const test = {
    name,
    endpoint: options.path,
    method: options.method || 'GET',
    expectedStatus,
    actualStatus: null,
    latencyMs: null,
    passed: false,
    error: null,
  };

  try {
    const response = await makeRequest(options, body);
    test.actualStatus = response.statusCode;
    test.latencyMs = response.latencyMs;
    test.passed = response.statusCode === expectedStatus;

    if (!test.passed) {
      test.error = `Expected ${expectedStatus}, got ${response.statusCode}`;
    }

    // Return token if this is a login request
    if (test.passed && options.path.includes('/auth/login') && response.body?.access_token) {
      test.token = response.body.access_token;
    }
  } catch (err) {
    test.error = err.error || 'Unknown error';
    test.latencyMs = err.latencyMs || 0;
  }

  results.tests.push(test);
  results.summary.total++;
  results.summary.totalLatencyMs += test.latencyMs || 0;

  if (test.passed) {
    results.summary.passed++;
    console.log(`  [PASS] ${name} (${test.latencyMs}ms)`);
  } else {
    results.summary.failed++;
    console.log(`  [FAIL] ${name} - ${test.error}`);
  }

  return test;
}

/**
 * Main smoke test runner
 */
async function runSmokeTests() {
  console.log('='.repeat(60));
  console.log('GRC Platform - NestJS Backend Smoke Tests');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log('');

  // 1. Health Checks
  console.log('1. Health Checks');
  await runTest('Ping endpoint', { path: '/health/live' }, 200);
  await runTest('Health endpoint', { path: '/health/ready' }, 200);
  console.log('');

  // 2. Authentication
  console.log('2. Authentication');
  const loginTest = await runTest(
    'Login with valid credentials',
    { path: '/auth/login', method: 'POST' },
    201,
    { email: TEST_EMAIL, password: TEST_PASSWORD }
  );

  let authToken = loginTest.token;

  // If login failed, try without auth for remaining tests
  if (!authToken) {
    console.log('  [WARN] Login failed, skipping authenticated tests');
  }
  console.log('');

  // 3. GRC Endpoints (require auth + tenant)
  console.log('3. GRC Endpoints');
  if (authToken) {
    const authHeaders = {
      Authorization: `Bearer ${authToken}`,
      'x-tenant-id': TEST_TENANT_ID,
    };

    await runTest(
      'List risks',
      { path: '/grc/risks', headers: authHeaders },
      200
    );

    await runTest(
      'List policies',
      { path: '/grc/policies', headers: authHeaders },
      200
    );

    await runTest(
      'List requirements',
      { path: '/grc/requirements', headers: authHeaders },
      200
    );
  } else {
    // Test that endpoints require auth
    await runTest(
      'Risks endpoint requires auth',
      { path: '/grc/risks' },
      401
    );
  }
  console.log('');

  // 4. Error Handling
  console.log('4. Error Handling');
  await runTest(
    '404 for unknown route',
    { path: '/api/v2/nonexistent' },
    404
  );
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Total latency: ${results.summary.totalLatencyMs}ms`);
  console.log(
    `Average latency: ${Math.round(results.summary.totalLatencyMs / results.summary.total)}ms`
  );
  console.log('');

  // Write results to file
  const resultsPath = path.join(__dirname, '..', 'smoke-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`Results written to: ${resultsPath}`);

  // Exit with appropriate code
  if (results.summary.failed > 0) {
    console.log('\n[SMOKE TESTS FAILED]');
    process.exit(1);
  } else {
    console.log('\n[SMOKE TESTS PASSED]');
    process.exit(0);
  }
}

// Run tests
runSmokeTests().catch((err) => {
  console.error('Smoke test runner error:', err);
  process.exit(1);
});
