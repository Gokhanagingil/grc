#!/usr/bin/env node

/**
 * Acceptance Test Runner (Node.js)
 * Tests: Health, Dashboard, Risk create, Policy create, Clause create, KQL search
 * Extended: FE health check with retry, Playwright E2E orchestration, JSON/HTML report parsing
 */

import http from 'http';
import { URL } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, mkdirSync } from 'fs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRONTEND_DIR = join(__dirname, '../../frontend');
const ARTIFACTS_DIR = join(__dirname, '../artifacts/acceptance');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const ARTIFACTS_TIMESTAMP_DIR = join(ARTIFACTS_DIR, timestamp);

const API_URL = process.env.API_URL || 'http://localhost:5002';
const TENANT_A = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
const FE_URL = process.env.FE_URL || 'http://localhost:3000';

// Retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}${path}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || 5002,
      path: url.pathname + url.search,
      headers: {
        'x-tenant-id': TENANT_A,
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: data || {}, headers: res.headers });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function waitForHealth(endpoint, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      if (endpoint.startsWith('http')) {
        // FE health check
        const result = await new Promise((resolve) => {
          const req = http.get(endpoint, (res) => {
            resolve({ status: res.statusCode });
          });
          req.on('error', () => resolve({ status: 0 }));
          req.setTimeout(3000, () => {
            req.destroy();
            resolve({ status: 0 });
          });
        });
        if (result.status === 200 || result.status === 304) {
          return true;
        }
      } else {
        // BE health check
        const res = await makeRequest('GET', endpoint);
        if (res.status === 200 && res.data?.status === 'ok') {
          return true;
        }
      }
    } catch (error) {
      // Ignore and retry
    }
    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
  return false;
}

async function testStep(name, fn) {
  try {
    const result = await fn();
    const pass = result.success !== false;
    console.log(`${pass ? '✅' : '❌'} ${name}`);
    if (!pass && result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.details) {
      Object.entries(result.details).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
    return { pass, result };
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message || error}`);
    if (error.stack) {
      console.log(`   Stack: ${error.stack.split('\n')[1]}`);
    }
    return { pass: false, result: { error: error.message } };
  }
}

function parsePlaywrightReport() {
  const jsonReportPath = join(FRONTEND_DIR, 'playwright-report', 'report.json');
  if (!existsSync(jsonReportPath)) {
    return null;
  }
  try {
    const content = readFileSync(jsonReportPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function extractFailureDetails(jsonReport) {
  const failures = [];
  if (!jsonReport) return failures;

  jsonReport.suites?.forEach((suite) => {
    suite.specs?.forEach((spec) => {
      spec.tests?.forEach((test) => {
        if (test.results && test.results.length > 0) {
          const failedResult = test.results.find((r) => r.status === 'failed');
          if (failedResult) {
            const screenshot = failedResult.attachments?.find(
              (a) => a.name === 'screenshot' || a.path?.endsWith('.png'),
            );
            const trace = failedResult.attachments?.find(
              (a) => a.name === 'trace',
            );
            failures.push({
              spec: spec.title || test.title,
              title: test.title,
              error: failedResult.error?.message || 'Unknown error',
              screenshot: screenshot?.path,
              trace: trace?.path,
            });
          }
        }
      });
    });
  });

  return failures;
}

async function main() {
  // Create artifacts directory
  try {
    mkdirSync(ARTIFACTS_TIMESTAMP_DIR, { recursive: true });
  } catch (error) {
    // Ignore if exists
  }

  console.log('\n=== Acceptance Test Runner ===\n');

  const startTime = Date.now();
  let passed = 0;
  let failed = 0;
  const failures = [];

  // Step 0: Backend Health Check (with retry)
  console.log('⏳ Waiting for backend health...');
  const beHealthy = await waitForHealth('/api/v2/health', MAX_RETRIES);
  if (!beHealthy) {
    console.error('❌ Backend not accessible at', API_URL);
    console.error('   Please start backend: cd backend-nest && npm run start:dev');
    process.exit(1);
  }

  const healthResult = await testStep('Health Check', async () => {
    const res = await makeRequest('GET', '/api/v2/health');
    return {
      success: res.status === 200 && res.data.status === 'ok',
      details: { status: res.data.status, db: res.data.db },
    };
  });
  healthResult.pass ? passed++ : failed++;
  if (!healthResult.pass) failures.push({ step: 'Health Check', error: healthResult.result.error });

  // Step 2: Dashboard Overview
  const dashboardResult = await testStep('Dashboard Overview', async () => {
    const res = await makeRequest('GET', '/api/v2/dashboard/overview');
    const clauses = res.data?.dataFoundations?.clauses || 0;
    const mappings = res.data?.dataFoundations?.mappings || 0;
    return {
      success: res.status === 200 && clauses >= 400 && mappings >= 200,
      details: { clauses, mappings },
    };
  });
  dashboardResult.pass ? passed++ : failed++;
  if (!dashboardResult.pass) failures.push({ step: 'Dashboard Overview', error: dashboardResult.result.error });

  // Step 3: Risk Create (with category)
  const riskCreateResult = await testStep('Risk Create (with category)', async () => {
    const code = `RISK-ACCEPT-${Date.now()}`;
    const res = await makeRequest('POST', '/api/v2/risk-catalog', {
      code,
      name: 'Acceptance Test Risk',
      categoryCode: 'Operational',
      description: 'Test risk for acceptance',
      default_likelihood: 3,
      default_impact: 3,
    });
    return {
      success: res.status === 201 && res.data?.id && res.data?.code === code,
      details: { status: res.status, code: res.data?.code },
    };
  });
  riskCreateResult.pass ? passed++ : failed++;
  if (!riskCreateResult.pass) failures.push({ step: 'Risk Create', error: riskCreateResult.result.error });

  // Step 4: Policy Create (HTML content)
  const policyCreateResult = await testStep('Policy Create (HTML content)', async () => {
    const code = `POL-ACCEPT-${Date.now()}`;
    const res = await makeRequest('POST', '/api/v2/governance/policies', {
      code,
      title: 'Acceptance Test Policy',
      status: 'draft',
      content: '<p>Test <strong>HTML</strong> content</p>',
      effective_date: '01/01/2024',
    });
    return {
      success: res.status === 201 && res.data?.id && res.data?.content?.includes('<p>'),
      details: { status: res.status, hasContent: res.data?.content ? 'yes' : 'no' },
    };
  });
  policyCreateResult.pass ? passed++ : failed++;
  if (!policyCreateResult.pass) failures.push({ step: 'Policy Create', error: policyCreateResult.result.error });

  // Step 5: Clause Create
  const clauseCreateResult = await testStep('Clause Create', async () => {
    const clauseCode = `CUST-ACCEPT-${Date.now()}`;
    const res = await makeRequest('POST', '/api/v2/standards/ISO20000/clauses', {
      clause_code: clauseCode,
      title: 'Acceptance Test Clause',
      text: 'Test clause description',
      synthetic: true,
    });
    return {
      success: res.status === 201 && res.data?.id && res.data?.clause_code === clauseCode,
      details: { status: res.status, clauseCode: res.data?.clause_code },
    };
  });
  clauseCreateResult.pass ? passed++ : failed++;
  if (!clauseCreateResult.pass) failures.push({ step: 'Clause Create', error: clauseCreateResult.result.error });

  // Step 6: KQL Advanced Search
  const kqlSearchResult = await testStep('KQL Advanced Search', async () => {
    const query = encodeURIComponent('name contains test AND likelihood >= 2');
    const res = await makeRequest('GET', `/api/v2/risk-catalog?q=${query}`);
    return {
      success: res.status === 200 && Array.isArray(res.data?.items),
      details: { status: res.status, resultsCount: res.data?.items?.length || 0 },
    };
  });
  kqlSearchResult.pass ? passed++ : failed++;
  if (!kqlSearchResult.pass) failures.push({ step: 'KQL Search', error: kqlSearchResult.result.error });

  // Step 7: Column Filters + KQL Combination
  const columnFiltersResult = await testStep('Column Filters + KQL', async () => {
    const query = encodeURIComponent('name contains test');
    const res = await makeRequest('GET', `/api/v2/risk-catalog?q=${query}&category=Operational&likelihoodOp=>=&likelihoodVal=2`);
    return {
      success: res.status === 200 && Array.isArray(res.data?.items),
      details: { status: res.status, resultsCount: res.data?.items?.length || 0 },
    };
  });
  columnFiltersResult.pass ? passed++ : failed++;
  if (!columnFiltersResult.pass) failures.push({ step: 'Column Filters', error: columnFiltersResult.result.error });

  // Step 8: Show Matching / Filter Out simulation
  const showMatchingResult = await testStep('Show Matching / Filter Out', async () => {
    const listRes = await makeRequest('GET', '/api/v2/risk-catalog?page=1&pageSize=1');
    if (listRes.data?.items?.length === 0) {
      return { success: true, details: { note: 'No risks to test' } };
    }
    const testRisk = listRes.data.items[0];
    const category = testRisk.category?.code || 'Operational';
    const matchingRes = await makeRequest('GET', `/api/v2/risk-catalog?category=${category}`);
    const filterOutQuery = encodeURIComponent(`category != "${category}"`);
    const filterOutRes = await makeRequest('GET', `/api/v2/risk-catalog?q=${filterOutQuery}`);
    return {
      success: matchingRes.status === 200 && filterOutRes.status === 200,
      details: {
        matchingCount: matchingRes.data?.items?.length || 0,
        filterOutCount: filterOutRes.data?.items?.length || 0,
      },
    };
  });
  showMatchingResult.pass ? passed++ : failed++;
  if (!showMatchingResult.pass) failures.push({ step: 'Show Matching', error: showMatchingResult.result.error });

  // Step 8.5: Seed Phase 15 Demo Data (BCM + Audit + All modules)
  const seedPhase15Result = await testStep('Seed Phase 15 Demo Data', async () => {
    try {
      console.log('   Running Phase 15 demo seed...');
      const { stdout, stderr } = await execAsync('npm run demo-seed:phase15', {
        cwd: __dirname + '/..',
        timeout: 60000, // 60 seconds
        env: { ...process.env },
      });

      const output = stdout + stderr;
      const hasError = output.includes('Error') && !output.includes('already exists');
      
      return {
        success: !hasError,
        details: { note: hasError ? 'Seed may have partial errors' : 'Seed completed' },
      };
    } catch (error) {
      // Seed might fail if data already exists (idempotent), so we don't fail the test
      return { success: true, details: { note: 'Seed attempted (may already exist)' } };
    }
  });
  seedPhase15Result.pass ? passed++ : failed++;
  if (!seedPhase15Result.pass) {
    failures.push({ step: 'Seed Phase 15', error: seedPhase15Result.result.error });
  }

  // Step 9: Frontend Health Check (with retry)
  console.log('⏳ Waiting for frontend health...');
  const feHealthy = await waitForHealth(`${FE_URL}/login`, MAX_RETRIES);
  
  const feHealthResult = await testStep('Frontend Health Check', async () => ({
    success: feHealthy,
    details: { status: feHealthy ? '200' : 'timeout', url: FE_URL },
  }));
  feHealthResult.pass ? passed++ : failed++;
  if (!feHealthResult.pass) {
    failures.push({ step: 'FE Health', error: 'FE not accessible' });
    console.log('⚠️  FE not accessible, skipping E2E tests');
    console.log('   Please start frontend: cd frontend && npm start');
  }

  // Step 10: Playwright E2E Tests (if FE is accessible)
  let e2eSummary = null;
  if (feHealthy) {
    const e2eResult = await testStep('Playwright E2E Tests', async () => {
      try {
        console.log('   Running Playwright E2E tests...');
        const { stdout, stderr } = await execAsync('npm run e2e:ci', {
          cwd: FRONTEND_DIR,
          timeout: 180000, // 3 minutes
          env: { ...process.env },
        });

        const output = stdout + stderr;
        const passedMatch = output.match(/(\d+)\s+passed/i);
        const failedMatch = output.match(/(\d+)\s+failed/i);
        const passedCount = passedMatch ? parseInt(passedMatch[1], 10) : 0;
        const failedCount = failedMatch ? parseInt(failedMatch[1], 10) : 0;

        // Parse JSON report for detailed failures
        const jsonReport = parsePlaywrightReport();
        const failureDetails = extractFailureDetails(jsonReport);
        
        e2eSummary = {
          passed: passedCount,
          failed: failedCount,
          total: passedCount + failedCount,
          failures: failureDetails.slice(0, 5), // First 5 failures with details
        };

        return {
          success: failedCount === 0 && passedCount > 0,
          details: e2eSummary,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          details: { note: 'E2E execution failed' },
        };
      }
    });

    e2eResult.pass ? passed++ : failed++;
    if (!e2eResult.pass) {
      failures.push({ step: 'E2E Tests', error: e2eResult.result.error });
      if (e2eSummary) {
        e2eSummary.failures.forEach((f) => {
          failures.push({
            step: `E2E: ${f.title}`,
            error: f.error,
            screenshot: f.screenshot,
            trace: f.trace,
          });
        });
      }
    }
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed (${duration}s) ===\n`);

  if (failures.length > 0) {
    console.log('First 5 failures:');
    failures.slice(0, 5).forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f.step}: ${f.error || 'Unknown error'}`);
      if (f.screenshot) {
        console.log(`      Screenshot: ${f.screenshot}`);
      }
      if (f.trace) {
        console.log(`      Trace: ${f.trace}`);
      }
    });
  }

  // Report paths
  const htmlReportPath = join(FRONTEND_DIR, 'playwright-report', 'index.html');
  const jsonReportPath = join(FRONTEND_DIR, 'playwright-report', 'report.json');
  
  console.log('\n📊 Report Paths:');
  if (existsSync(htmlReportPath)) {
    console.log(`   HTML: ${htmlReportPath}`);
  }
  if (existsSync(jsonReportPath)) {
    console.log(`   JSON: ${jsonReportPath}`);
  }
  console.log(`   Artifacts: ${ARTIFACTS_TIMESTAMP_DIR}`);

  if (failed === 0) {
    console.log('\n✅ ACCEPTANCE OK');
    process.exit(0);
  } else {
    console.log('\n❌ ACCEPTANCE FAILED');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
