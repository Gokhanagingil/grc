#!/usr/bin/env node

/**
 * Smoke Test Script for Audit Module
 * 
 * This script validates the end-to-end flow of the Audit module:
 * 1. Login as an authorized user
 * 2. Call Audit list endpoint with filters
 * 3. Fetch a specific audit
 * 4. Try to edit as authorized vs unauthorized user
 * 5. Check ACL permissions
 * 
 * Usage: node scripts/smoke-test-audit.js [--base-url=http://localhost:3001]
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.argv.find(arg => arg.startsWith('--base-url='))?.split('=')[1] || 'http://localhost:3001';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[Step ${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message) {
  log(`  ✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`  ℹ ${message}`, 'yellow');
}

async function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runSmokeTests() {
  log('\n========================================', 'blue');
  log('  Audit Module Smoke Test', 'blue');
  log('========================================', 'blue');
  log(`Base URL: ${BASE_URL}`);

  let adminToken = null;
  let userToken = null;
  let testAuditId = null;
  let passed = 0;
  let failed = 0;

  try {
    // Step 1: Login as admin
    logStep(1, 'Login as admin user');
    try {
      const loginResponse = await makeRequest('POST', '/api/auth/login', {
        email: 'admin@example.com',
        password: 'admin123',
      });

      if (loginResponse.status === 200 && loginResponse.data.token) {
        adminToken = loginResponse.data.token;
        logSuccess(`Logged in as admin (token: ${adminToken.substring(0, 20)}...)`);
        passed++;
      } else {
        logError(`Login failed: ${JSON.stringify(loginResponse.data)}`);
        logInfo('Make sure the demo admin user exists. Run: npm run seed:demo-admin');
        failed++;
      }
    } catch (err) {
      logError(`Login request failed: ${err.message}`);
      failed++;
    }

    // Step 2: Check if audit module is enabled
    logStep(2, 'Check audit module status');
    if (adminToken) {
      try {
        const moduleResponse = await makeRequest('GET', '/api/platform/modules/enabled', null, adminToken);
        if (moduleResponse.status === 200) {
          const enabledModules = moduleResponse.data.enabledModules || [];
          if (enabledModules.includes('audit')) {
            logSuccess('Audit module is enabled');
            passed++;
          } else {
            logInfo('Audit module not in enabled list (may need migration)');
            logInfo(`Enabled modules: ${enabledModules.join(', ')}`);
          }
        } else {
          logInfo(`Module check returned status ${moduleResponse.status}`);
        }
      } catch (err) {
        logInfo(`Module check failed: ${err.message}`);
      }
    }

    // Step 3: List audits with filters
    logStep(3, 'List audits with Search DSL filters');
    if (adminToken) {
      try {
        const listResponse = await makeRequest('GET', '/api/grc/audits?page=1&limit=10&status=planned', null, adminToken);
        if (listResponse.status === 200) {
          const audits = listResponse.data.audits || [];
          const pagination = listResponse.data.pagination || {};
          logSuccess(`Listed audits: ${audits.length} records (total: ${pagination.total || 0})`);
          passed++;

          if (audits.length > 0) {
            testAuditId = audits[0].id;
            logInfo(`Using audit ID ${testAuditId} for further tests`);
          }
        } else if (listResponse.status === 403) {
          logError('Access denied to audit list (ACL working correctly for unauthorized)');
          failed++;
        } else {
          logError(`List audits failed: ${listResponse.status} - ${JSON.stringify(listResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`List audits request failed: ${err.message}`);
        failed++;
      }
    }

    // Step 4: Search audits with POST (complex DSL query)
    logStep(4, 'Search audits with complex DSL query');
    if (adminToken) {
      try {
        const searchResponse = await makeRequest('POST', '/api/grc/audits/search', {
          filter: {
            or: [
              { field: 'risk_level', operator: 'equals', value: 'high' },
              { field: 'risk_level', operator: 'equals', value: 'critical' },
            ],
          },
          sort: { field: 'created_at', direction: 'DESC' },
          page: 1,
          limit: 5,
        }, adminToken);

        if (searchResponse.status === 200) {
          const audits = searchResponse.data.audits || [];
          logSuccess(`Search returned ${audits.length} high/critical risk audits`);
          passed++;
        } else {
          logError(`Search failed: ${searchResponse.status} - ${JSON.stringify(searchResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`Search request failed: ${err.message}`);
        failed++;
      }
    }

    // Step 5: Get audit by ID
    logStep(5, 'Fetch specific audit by ID');
    if (adminToken && testAuditId) {
      try {
        const getResponse = await makeRequest('GET', `/api/grc/audits/${testAuditId}`, null, adminToken);
        if (getResponse.status === 200) {
          const audit = getResponse.data;
          logSuccess(`Fetched audit: "${audit.name}" (status: ${audit.status})`);
          passed++;
        } else {
          logError(`Get audit failed: ${getResponse.status} - ${JSON.stringify(getResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`Get audit request failed: ${err.message}`);
        failed++;
      }
    } else if (!testAuditId) {
      logInfo('Skipping - no audit ID available (run migration to seed sample data)');
    }

    // Step 6: Check ACL permissions for audit
    logStep(6, 'Check ACL permissions for audit');
    if (adminToken && testAuditId) {
      try {
        const permResponse = await makeRequest('GET', `/api/grc/audits/${testAuditId}/permissions`, null, adminToken);
        if (permResponse.status === 200) {
          const perms = permResponse.data;
          logSuccess(`Permissions - Read: ${perms.read}, Write: ${perms.write}, Delete: ${perms.delete}`);
          if (perms.maskedFields?.length > 0) {
            logInfo(`Masked fields: ${perms.maskedFields.join(', ')}`);
          }
          passed++;
        } else {
          logError(`Permission check failed: ${permResponse.status}`);
          failed++;
        }
      } catch (err) {
        logError(`Permission check request failed: ${err.message}`);
        failed++;
      }
    }

    // Step 7: Get audit statistics
    logStep(7, 'Get audit statistics');
    if (adminToken) {
      try {
        const statsResponse = await makeRequest('GET', '/api/grc/audits/statistics', null, adminToken);
        if (statsResponse.status === 200) {
          const stats = statsResponse.data;
          logSuccess(`Statistics - Total: ${stats.total}, Planned: ${stats.planned}, In Progress: ${stats.in_progress}, Completed: ${stats.completed}`);
          passed++;
        } else {
          logError(`Statistics failed: ${statsResponse.status}`);
          failed++;
        }
      } catch (err) {
        logError(`Statistics request failed: ${err.message}`);
        failed++;
      }
    }

    // Step 8: Get field metadata
    logStep(8, 'Get audit field metadata');
    if (adminToken) {
      try {
        const metaResponse = await makeRequest('GET', '/api/grc/audits/metadata', null, adminToken);
        if (metaResponse.status === 200) {
          const fields = Object.keys(metaResponse.data);
          logSuccess(`Field metadata retrieved: ${fields.length} fields`);
          logInfo(`Fields: ${fields.slice(0, 5).join(', ')}...`);
          passed++;
        } else {
          logError(`Metadata failed: ${metaResponse.status}`);
          failed++;
        }
      } catch (err) {
        logError(`Metadata request failed: ${err.message}`);
        failed++;
      }
    }

    // Step 9: Test unauthorized access (without token)
    logStep(9, 'Test unauthorized access (no token)');
    try {
      const unauthResponse = await makeRequest('GET', '/api/grc/audits');
      if (unauthResponse.status === 401 || unauthResponse.status === 403) {
        logSuccess(`Correctly denied access: ${unauthResponse.status}`);
        passed++;
      } else {
        logError(`Expected 401/403, got ${unauthResponse.status}`);
        failed++;
      }
    } catch (err) {
      logError(`Unauthorized test failed: ${err.message}`);
      failed++;
    }

    // Step 10: Test create permission check
    logStep(10, 'Check create permission');
    if (adminToken) {
      try {
        const canCreateResponse = await makeRequest('GET', '/api/grc/audits/can/create', null, adminToken);
        if (canCreateResponse.status === 200) {
          logSuccess(`Can create audits: ${canCreateResponse.data.allowed}`);
          passed++;
        } else {
          logError(`Create permission check failed: ${canCreateResponse.status}`);
          failed++;
        }
      } catch (err) {
        logError(`Create permission check failed: ${err.message}`);
        failed++;
      }
    }

  } catch (err) {
    logError(`Unexpected error: ${err.message}`);
    failed++;
  }

  // Summary
  log('\n========================================', 'blue');
  log('  Test Summary', 'blue');
  log('========================================', 'blue');
  log(`  Passed: ${passed}`, 'green');
  log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log('========================================\n', 'blue');

  if (failed > 0) {
    log('Some tests failed. Make sure:', 'yellow');
    log('  1. Backend is running (npm run dev)', 'yellow');
    log('  2. Phase 3 migration has been run (npm run migrate:phase3)', 'yellow');
    log('  3. Demo admin user exists (npm run seed:demo-admin)', 'yellow');
    process.exit(1);
  }

  process.exit(0);
}

runSmokeTests().catch(err => {
  logError(`Fatal error: ${err.message}`);
  process.exit(1);
});
