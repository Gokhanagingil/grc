#!/usr/bin/env node

/**
 * GRC Core Health / Smoke Test Script
 * 
 * This script validates the core GRC functionality:
 * 1. Auth endpoints (login, /auth/me)
 * 2. GRC endpoints (risks, policies, requirements)
 * 3. Dashboard/overview endpoint
 * 4. Users endpoint
 * 
 * Usage: node scripts/smoke-grc-core.js [--base-url=http://localhost:3001]
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
  log(`  + ${message}`, 'green');
}

function logError(message) {
  log(`  x ${message}`, 'red');
}

function logInfo(message) {
  log(`  i ${message}`, 'yellow');
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
  log('  GRC Core Health / Smoke Test', 'blue');
  log('========================================', 'blue');
  log(`Base URL: ${BASE_URL}`);

  let token = null;
  let passed = 0;
  let failed = 0;

  try {
    // Step 1: Health check
    logStep(1, 'API Health Check');
    try {
      const healthResponse = await makeRequest('GET', '/api/health');
      if (healthResponse.status === 200 && healthResponse.data.status === 'OK') {
        logSuccess(`Health check passed: ${healthResponse.data.message}`);
        passed++;
      } else {
        logError(`Health check failed: ${JSON.stringify(healthResponse.data)}`);
        failed++;
      }
    } catch (err) {
      logError(`Health check request failed: ${err.message}`);
      failed++;
    }

    // Step 2: Login
    logStep(2, 'Auth - Login');
    try {
      const loginResponse = await makeRequest('POST', '/api/auth/login', {
        username: 'demo.admin',
        password: 'admin123',
      });

      if (loginResponse.status === 200 && loginResponse.data.token) {
        token = loginResponse.data.token;
        logSuccess(`Login successful (token: ${token.substring(0, 20)}...)`);
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

    // Step 3: Get current user (/auth/me)
    logStep(3, 'Auth - Get Current User (/auth/me)');
    if (token) {
      try {
        const meResponse = await makeRequest('GET', '/api/auth/me', null, token);
        if (meResponse.status === 200 && meResponse.data.username) {
          logSuccess(`Current user: ${meResponse.data.username} (role: ${meResponse.data.role})`);
          passed++;
        } else {
          logError(`Get current user failed: ${meResponse.status} - ${JSON.stringify(meResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`Get current user request failed: ${err.message}`);
        failed++;
      }
    } else {
      logInfo('Skipping - no token available');
    }

    // Step 4: Dashboard Overview
    logStep(4, 'Dashboard - Overview');
    if (token) {
      try {
        const dashboardResponse = await makeRequest('GET', '/api/dashboard/overview', null, token);
        if (dashboardResponse.status === 200) {
          const data = dashboardResponse.data;
          logSuccess(`Dashboard overview: Risks=${data.risks?.total || 0}, Policies=${data.policies?.total || 0}, Compliance=${data.compliance?.total || 0}`);
          passed++;
        } else {
          logError(`Dashboard overview failed: ${dashboardResponse.status} - ${JSON.stringify(dashboardResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`Dashboard overview request failed: ${err.message}`);
        failed++;
      }
    } else {
      logInfo('Skipping - no token available');
    }

    // Step 5: Risk Management - List Risks
    logStep(5, 'GRC - List Risks (/risk/risks)');
    if (token) {
      try {
        const risksResponse = await makeRequest('GET', '/api/risk/risks?page=1&limit=5', null, token);
        if (risksResponse.status === 200) {
          const risks = risksResponse.data.risks || [];
          const total = risksResponse.data.pagination?.total || 0;
          logSuccess(`Risks listed: ${risks.length} items (total: ${total})`);
          passed++;
        } else {
          logError(`List risks failed: ${risksResponse.status} - ${JSON.stringify(risksResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`List risks request failed: ${err.message}`);
        failed++;
      }
    } else {
      logInfo('Skipping - no token available');
    }

    // Step 6: Governance - List Policies
    logStep(6, 'GRC - List Policies (/governance/policies)');
    if (token) {
      try {
        const policiesResponse = await makeRequest('GET', '/api/governance/policies?page=1&limit=5', null, token);
        if (policiesResponse.status === 200) {
          const policies = policiesResponse.data.policies || [];
          const total = policiesResponse.data.pagination?.total || 0;
          logSuccess(`Policies listed: ${policies.length} items (total: ${total})`);
          passed++;
        } else {
          logError(`List policies failed: ${policiesResponse.status} - ${JSON.stringify(policiesResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`List policies request failed: ${err.message}`);
        failed++;
      }
    } else {
      logInfo('Skipping - no token available');
    }

    // Step 7: Compliance - List Requirements
    logStep(7, 'GRC - List Requirements (/grc/requirements)');
    if (token) {
      try {
        const requirementsResponse = await makeRequest('GET', '/api/grc/requirements?page=1&limit=5', null, token);
        if (requirementsResponse.status === 200) {
          const requirements = requirementsResponse.data.requirements || requirementsResponse.data.data || [];
          const total = requirementsResponse.data.pagination?.total || requirementsResponse.data.meta?.total || 0;
          logSuccess(`Requirements listed: ${Array.isArray(requirements) ? requirements.length : 0} items (total: ${total})`);
          passed++;
        } else {
          logError(`List requirements failed: ${requirementsResponse.status} - ${JSON.stringify(requirementsResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`List requirements request failed: ${err.message}`);
        failed++;
      }
    } else {
      logInfo('Skipping - no token available');
    }

    // Step 8: Users - List Users
    logStep(8, 'Users - List Users (/users)');
    if (token) {
      try {
        const usersResponse = await makeRequest('GET', '/api/users?page=1&limit=5', null, token);
        if (usersResponse.status === 200) {
          const users = usersResponse.data.users || [];
          const total = usersResponse.data.pagination?.total || 0;
          logSuccess(`Users listed: ${users.length} items (total: ${total})`);
          passed++;
        } else if (usersResponse.status === 403) {
          logInfo(`Users list requires admin/manager role (got 403)`);
          passed++; // This is expected behavior for non-admin users
        } else {
          logError(`List users failed: ${usersResponse.status} - ${JSON.stringify(usersResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`List users request failed: ${err.message}`);
        failed++;
      }
    } else {
      logInfo('Skipping - no token available');
    }

    // Step 9: Dashboard - Risk Trends
    logStep(9, 'Dashboard - Risk Trends');
    if (token) {
      try {
        const trendsResponse = await makeRequest('GET', '/api/dashboard/risk-trends?days=30', null, token);
        if (trendsResponse.status === 200) {
          const trends = Array.isArray(trendsResponse.data) ? trendsResponse.data : [];
          logSuccess(`Risk trends: ${trends.length} data points`);
          passed++;
        } else {
          logError(`Risk trends failed: ${trendsResponse.status} - ${JSON.stringify(trendsResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`Risk trends request failed: ${err.message}`);
        failed++;
      }
    } else {
      logInfo('Skipping - no token available');
    }

    // Step 10: Dashboard - Compliance by Regulation
    logStep(10, 'Dashboard - Compliance by Regulation');
    if (token) {
      try {
        const complianceResponse = await makeRequest('GET', '/api/dashboard/compliance-by-regulation', null, token);
        if (complianceResponse.status === 200) {
          const data = Array.isArray(complianceResponse.data) ? complianceResponse.data : [];
          logSuccess(`Compliance by regulation: ${data.length} regulations`);
          passed++;
        } else {
          logError(`Compliance by regulation failed: ${complianceResponse.status} - ${JSON.stringify(complianceResponse.data)}`);
          failed++;
        }
      } catch (err) {
        logError(`Compliance by regulation request failed: ${err.message}`);
        failed++;
      }
    } else {
      logInfo('Skipping - no token available');
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
    log('  2. Database is initialized', 'yellow');
    log('  3. Demo admin user exists (npm run seed:demo-admin)', 'yellow');
    process.exit(1);
  }

  log('All GRC core endpoints are healthy!', 'green');
  process.exit(0);
}

runSmokeTests().catch(err => {
  logError(`Fatal error: ${err.message}`);
  process.exit(1);
});
