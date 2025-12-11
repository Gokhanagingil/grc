/**
 * GRC Platform Acceptance Test Runner
 *
 * Automated end-to-end acceptance scenario runner that validates
 * the main user flows using the demo admin user.
 *
 * Usage: npm run acceptance:full
 *
 * Environment Variables:
 *   BASE_URL           - Backend API URL (default: http://localhost:3002)
 *   DEMO_ADMIN_EMAIL   - Demo admin email (default: admin@grc-platform.local)
 *   DEMO_ADMIN_PASSWORD - Demo admin password (default: TestPassword123!)
 *
 * Prerequisites:
 *   - NestJS backend running on BASE_URL
 *   - Demo data seeded (npm run seed:grc)
 */

import * as http from 'http';
import * as https from 'https';
import { config } from 'dotenv';

// Load environment variables
config();

// Configuration from environment variables
const BASE_URL = process.env.BASE_URL || process.env.NEST_API_URL || 'http://localhost:3002';
const DEMO_ADMIN_EMAIL =
  process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
const DEMO_ADMIN_PASSWORD =
  process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Types
interface ApiResponse {
  statusCode: number;
  data: unknown;
  error?: string;
}

interface ScenarioResult {
  name: string;
  passed: boolean;
  checks: CheckResult[];
  duration: number;
}

interface CheckResult {
  name: string;
  passed: boolean;
  message?: string;
}

// Global state
let authToken = '';
let tenantId = DEMO_TENANT_ID;
const createdEntities: {
  risks: string[];
  policies: string[];
  requirements: string[];
  incidents: string[];
} = {
  risks: [],
  policies: [],
  requirements: [],
  incidents: [],
};

/**
 * Make an HTTP/HTTPS request
 */
function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown,
): Promise<ApiResponse> {
  return new Promise((resolve) => {
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
 * Get auth headers for authenticated requests
 */
function getAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${authToken}`,
    'x-tenant-id': tenantId,
  };
}

/**
 * Print scenario header
 */
function printScenarioHeader(name: string) {
  console.log('\n' + '-'.repeat(50));
  console.log(`Scenario: ${name}`);
  console.log('-'.repeat(50));
}

/**
 * Print check result
 */
function printCheck(name: string, passed: boolean, message?: string) {
  const icon = passed ? '[PASS]' : '[FAIL]';
  console.log(`  ${icon} ${name}`);
  if (message && !passed) {
    console.log(`        ${message}`);
  }
}

// ============================================================================
// SCENARIO 1: Login + Dashboard
// ============================================================================
async function runScenario1LoginDashboard(): Promise<ScenarioResult> {
  const startTime = Date.now();
  const checks: CheckResult[] = [];

  printScenarioHeader('1. Login + Dashboard');

  // 1.1 Health Check
  const healthResponse = await makeRequest('GET', '/health/live');
  const healthData = (healthResponse.data as { data?: { status?: string } })?.data || healthResponse.data;
  const healthPassed =
    healthResponse.statusCode === 200 &&
    (healthData as { status?: string })?.status === 'ok';
  checks.push({
    name: 'Health check',
    passed: healthPassed,
    message: healthPassed
      ? undefined
      : `Status: ${healthResponse.statusCode}, Error: ${healthResponse.error || 'Unknown'}`,
  });
  printCheck('Health check', healthPassed, checks[checks.length - 1].message);

  if (!healthPassed) {
    console.log('\n  [ERROR] Backend is not running! Cannot continue.');
    return {
      name: 'Login + Dashboard',
      passed: false,
      checks,
      duration: Date.now() - startTime,
    };
  }

  // 1.2 Login
  const loginResponse = await makeRequest(
    'POST',
    '/auth/login',
    {},
    {
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
    },
  );

  let loginPassed = false;
  if (loginResponse.statusCode === 200 || loginResponse.statusCode === 201) {
    const loginData = loginResponse.data as {
      access_token?: string;
      data?: { accessToken?: string; user?: { tenantId?: string } };
    };
    authToken =
      loginData.access_token ||
      loginData.data?.accessToken ||
      (loginData as { accessToken?: string }).accessToken ||
      '';
    tenantId =
      loginData.data?.user?.tenantId ||
      (loginData as { user?: { tenantId?: string } }).user?.tenantId ||
      DEMO_TENANT_ID;
    loginPassed = !!authToken;
  }
  checks.push({
    name: 'Login',
    passed: loginPassed,
    message: loginPassed
      ? undefined
      : `Status: ${loginResponse.statusCode}, No token received`,
  });
  printCheck('Login', loginPassed, checks[checks.length - 1].message);

  if (!loginPassed) {
    console.log('\n  [ERROR] Login failed! Cannot continue.');
    return {
      name: 'Login + Dashboard',
      passed: false,
      checks,
      duration: Date.now() - startTime,
    };
  }

  // 1.3 User Profile Verification
  const userMeResponse = await makeRequest(
    'GET',
    '/users/me',
    getAuthHeaders(),
  );
  const userData =
    (userMeResponse.data as { data?: unknown })?.data || userMeResponse.data;
  const userEmail = (userData as { email?: string })?.email;
  const userRole = (userData as { role?: string })?.role;
  const userProfilePassed =
    userMeResponse.statusCode === 200 &&
    userEmail === DEMO_ADMIN_EMAIL &&
    userRole === 'admin';
  checks.push({
    name: 'User profile verification',
    passed: userProfilePassed,
    message: userProfilePassed
      ? undefined
      : `Email: ${userEmail}, Role: ${userRole}`,
  });
  printCheck(
    'User profile verification',
    userProfilePassed,
    checks[checks.length - 1].message,
  );

  // 1.4 Dashboard Summaries
  const summaryEndpoints = [
    { path: '/grc/risks/summary', name: 'Risk summary' },
    { path: '/grc/policies/summary', name: 'Policy summary' },
    { path: '/grc/requirements/summary', name: 'Requirement summary' },
    { path: '/itsm/incidents/summary', name: 'Incident summary' },
  ];

  for (const endpoint of summaryEndpoints) {
    const response = await makeRequest('GET', endpoint.path, getAuthHeaders());
    const passed = response.statusCode === 200;
    checks.push({
      name: endpoint.name,
      passed,
      message: passed ? undefined : `Status: ${response.statusCode}`,
    });
    printCheck(endpoint.name, passed, checks[checks.length - 1].message);
  }

  const allPassed = checks.every((c) => c.passed);
  return {
    name: 'Login + Dashboard',
    passed: allPassed,
    checks,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// SCENARIO 2: Risk Lifecycle
// ============================================================================
async function runScenario2RiskLifecycle(): Promise<ScenarioResult> {
  const startTime = Date.now();
  const checks: CheckResult[] = [];

  printScenarioHeader('2. Risk Lifecycle');

  // 2.1 Create a new risk
  const createRiskResponse = await makeRequest(
    'POST',
    '/grc/risks',
    getAuthHeaders(),
    {
      title: 'Acceptance Test Risk - ' + Date.now(),
      description: 'Risk created by acceptance test runner',
      category: 'Operational',
      severity: 'high',
      likelihood: 'possible',
      status: 'identified',
    },
  );

  const riskData =
    (createRiskResponse.data as { data?: unknown })?.data ||
    createRiskResponse.data;
  const riskId = (riskData as { id?: string })?.id;
  const createRiskPassed = createRiskResponse.statusCode === 201 && !!riskId;

  if (riskId) {
    createdEntities.risks.push(riskId);
  }

  checks.push({
    name: 'Create risk',
    passed: createRiskPassed,
    message: createRiskPassed
      ? undefined
      : `Status: ${createRiskResponse.statusCode}`,
  });
  printCheck(
    'Create risk',
    createRiskPassed,
    checks[checks.length - 1].message,
  );

  if (!createRiskPassed) {
    return {
      name: 'Risk Lifecycle',
      passed: false,
      checks,
      duration: Date.now() - startTime,
    };
  }

  // 2.2 Fetch risk details
  const getRiskResponse = await makeRequest(
    'GET',
    `/grc/risks/${riskId}`,
    getAuthHeaders(),
  );
  const getRiskPassed = getRiskResponse.statusCode === 200;
  checks.push({
    name: 'Fetch risk details',
    passed: getRiskPassed,
    message: getRiskPassed
      ? undefined
      : `Status: ${getRiskResponse.statusCode}`,
  });
  printCheck(
    'Fetch risk details',
    getRiskPassed,
    checks[checks.length - 1].message,
  );

  // 2.3 Get existing policy to link
  const policiesResponse = await makeRequest(
    'GET',
    '/grc/policies',
    getAuthHeaders(),
  );
  const policiesData =
    (policiesResponse.data as { data?: unknown[] })?.data ||
    (policiesResponse.data as unknown[]);
  const existingPolicyId = Array.isArray(policiesData)
    ? (policiesData[0] as { id?: string })?.id
    : undefined;

  let linkPolicyPassed = false;
  let linkPolicyResponse: ApiResponse | null = null;
  if (existingPolicyId) {
    linkPolicyResponse = await makeRequest(
      'POST',
      `/grc/risks/${riskId}/policies`,
      getAuthHeaders(),
      { policyIds: [existingPolicyId] },
    );
    linkPolicyPassed =
      linkPolicyResponse.statusCode >= 200 &&
      linkPolicyResponse.statusCode < 300;
  }
  checks.push({
    name: 'Link policy to risk',
    passed: linkPolicyPassed,
    message: linkPolicyPassed
      ? undefined
      : existingPolicyId
        ? `Status: ${linkPolicyResponse?.statusCode || 'N/A'}`
        : 'No existing policy found',
  });
  printCheck(
    'Link policy to risk',
    linkPolicyPassed,
    checks[checks.length - 1].message,
  );

  // 2.4 Get existing requirement to link
  const requirementsResponse = await makeRequest(
    'GET',
    '/grc/requirements',
    getAuthHeaders(),
  );
  const requirementsData =
    (requirementsResponse.data as { data?: unknown[] })?.data ||
    (requirementsResponse.data as unknown[]);
  const existingRequirementId = Array.isArray(requirementsData)
    ? (requirementsData[0] as { id?: string })?.id
    : undefined;

  let linkRequirementPassed = false;
  let linkRequirementResponse: ApiResponse | null = null;
  if (existingRequirementId) {
    linkRequirementResponse = await makeRequest(
      'POST',
      `/grc/risks/${riskId}/requirements`,
      getAuthHeaders(),
      { requirementIds: [existingRequirementId] },
    );
    linkRequirementPassed =
      linkRequirementResponse.statusCode >= 200 &&
      linkRequirementResponse.statusCode < 300;
  }
  checks.push({
    name: 'Link requirement to risk',
    passed: linkRequirementPassed,
    message: linkRequirementPassed
      ? undefined
      : existingRequirementId
        ? `Status: ${linkRequirementResponse?.statusCode || 'N/A'}`
        : 'No existing requirement found',
  });
  printCheck(
    'Link requirement to risk',
    linkRequirementPassed,
    checks[checks.length - 1].message,
  );

  // 2.5 Verify relations
  const riskPoliciesResponse = await makeRequest(
    'GET',
    `/grc/risks/${riskId}/policies`,
    getAuthHeaders(),
  );
  const verifyPoliciesPassed =
    riskPoliciesResponse.statusCode === 200 &&
    Array.isArray(
      (riskPoliciesResponse.data as { data?: unknown[] })?.data ||
        riskPoliciesResponse.data,
    );
  checks.push({
    name: 'Verify policy relations',
    passed: verifyPoliciesPassed,
    message: verifyPoliciesPassed
      ? undefined
      : `Status: ${riskPoliciesResponse.statusCode}`,
  });
  printCheck(
    'Verify policy relations',
    verifyPoliciesPassed,
    checks[checks.length - 1].message,
  );

  const riskRequirementsResponse = await makeRequest(
    'GET',
    `/grc/risks/${riskId}/requirements`,
    getAuthHeaders(),
  );
  const verifyRequirementsPassed =
    riskRequirementsResponse.statusCode === 200 &&
    Array.isArray(
      (riskRequirementsResponse.data as { data?: unknown[] })?.data ||
        riskRequirementsResponse.data,
    );
  checks.push({
    name: 'Verify requirement relations',
    passed: verifyRequirementsPassed,
    message: verifyRequirementsPassed
      ? undefined
      : `Status: ${riskRequirementsResponse.statusCode}`,
  });
  printCheck(
    'Verify requirement relations',
    verifyRequirementsPassed,
    checks[checks.length - 1].message,
  );

  const allPassed = checks.every((c) => c.passed);
  return {
    name: 'Risk Lifecycle',
    passed: allPassed,
    checks,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// SCENARIO 3: Incident Lifecycle
// ============================================================================
async function runScenario3IncidentLifecycle(): Promise<ScenarioResult> {
  const startTime = Date.now();
  const checks: CheckResult[] = [];

  printScenarioHeader('3. Incident Lifecycle');

  // 3.1 Create a new incident
  const createIncidentResponse = await makeRequest(
    'POST',
    '/itsm/incidents',
    getAuthHeaders(),
    {
      shortDescription: 'Acceptance Test Incident - ' + Date.now(),
      description: 'Incident created by acceptance test runner',
      category: 'software',
      impact: 'medium',
      urgency: 'medium',
      source: 'user',
      assignmentGroup: 'IT Support',
    },
  );

  const incidentData =
    (createIncidentResponse.data as { data?: unknown })?.data ||
    createIncidentResponse.data;
  const incidentId = (incidentData as { id?: string })?.id;
  const incidentNumber = (incidentData as { number?: string })?.number;
  const incidentStatus = (incidentData as { status?: string })?.status;
  const incidentPriority = (incidentData as { priority?: string })?.priority;

  const createIncidentPassed =
    createIncidentResponse.statusCode === 201 &&
    !!incidentId &&
    incidentStatus === 'open' &&
    incidentPriority === 'p3';

  if (incidentId) {
    createdEntities.incidents.push(incidentId);
  }

  checks.push({
    name: 'Create incident',
    passed: createIncidentPassed,
    message: createIncidentPassed
      ? `Number: ${incidentNumber}`
      : `Status: ${createIncidentResponse.statusCode}, incident status: ${incidentStatus}, priority: ${incidentPriority}`,
  });
  printCheck(
    'Create incident',
    createIncidentPassed,
    createIncidentPassed ? `Number: ${incidentNumber}` : undefined,
  );

  if (!createIncidentPassed) {
    return {
      name: 'Incident Lifecycle',
      passed: false,
      checks,
      duration: Date.now() - startTime,
    };
  }

  // 3.2 Update incident status to in_progress
  const updateIncidentResponse = await makeRequest(
    'PATCH',
    `/itsm/incidents/${incidentId}`,
    getAuthHeaders(),
    { status: 'in_progress' },
  );
  const updateData =
    (updateIncidentResponse.data as { data?: unknown })?.data ||
    updateIncidentResponse.data;
  const updatedStatus = (updateData as { status?: string })?.status;
  const updatePassed =
    updateIncidentResponse.statusCode === 200 &&
    updatedStatus === 'in_progress';
  checks.push({
    name: 'Update status to in_progress',
    passed: updatePassed,
    message: updatePassed
      ? undefined
      : `Status: ${updateIncidentResponse.statusCode}, incident status: ${updatedStatus}`,
  });
  printCheck(
    'Update status to in_progress',
    updatePassed,
    checks[checks.length - 1].message,
  );

  // 3.3 Resolve incident
  const resolveResponse = await makeRequest(
    'POST',
    `/itsm/incidents/${incidentId}/resolve`,
    getAuthHeaders(),
    { resolutionNotes: 'Resolved by acceptance test runner' },
  );
  const resolveData =
    (resolveResponse.data as { data?: unknown })?.data || resolveResponse.data;
  const resolvedStatus = (resolveData as { status?: string })?.status;
  const resolvedAt = (resolveData as { resolvedAt?: string })?.resolvedAt;
  const resolvePassed =
    resolveResponse.statusCode === 201 &&
    resolvedStatus === 'resolved' &&
    !!resolvedAt;
  checks.push({
    name: 'Resolve incident',
    passed: resolvePassed,
    message: resolvePassed
      ? undefined
      : `Status: ${resolveResponse.statusCode}, incident status: ${resolvedStatus}`,
  });
  printCheck(
    'Resolve incident',
    resolvePassed,
    checks[checks.length - 1].message,
  );

  // 3.4 Close incident
  const closeResponse = await makeRequest(
    'POST',
    `/itsm/incidents/${incidentId}/close`,
    getAuthHeaders(),
  );
  const closeData =
    (closeResponse.data as { data?: unknown })?.data || closeResponse.data;
  const closedStatus = (closeData as { status?: string })?.status;
  const closePassed =
    closeResponse.statusCode === 201 && closedStatus === 'closed';
  checks.push({
    name: 'Close incident',
    passed: closePassed,
    message: closePassed
      ? undefined
      : `Status: ${closeResponse.statusCode}, incident status: ${closedStatus}`,
  });
  printCheck('Close incident', closePassed, checks[checks.length - 1].message);

  // 3.5 Verify in statistics
  const statsResponse = await makeRequest(
    'GET',
    '/itsm/incidents/statistics',
    getAuthHeaders(),
  );
  const statsPassed = statsResponse.statusCode === 200;
  checks.push({
    name: 'Verify statistics',
    passed: statsPassed,
    message: statsPassed ? undefined : `Status: ${statsResponse.statusCode}`,
  });
  printCheck(
    'Verify statistics',
    statsPassed,
    checks[checks.length - 1].message,
  );

  const allPassed = checks.every((c) => c.passed);
  return {
    name: 'Incident Lifecycle',
    passed: allPassed,
    checks,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// SCENARIO 4: Governance & Compliance
// ============================================================================
async function runScenario4GovernanceCompliance(): Promise<ScenarioResult> {
  const startTime = Date.now();
  const checks: CheckResult[] = [];

  printScenarioHeader('4. Governance & Compliance');

  // 4.1 Create a new policy
  const createPolicyResponse = await makeRequest(
    'POST',
    '/grc/policies',
    getAuthHeaders(),
    {
      name: 'Acceptance Test Policy - ' + Date.now(),
      code: 'POL-ACC-' + Date.now(),
      version: '1.0',
      status: 'draft',
      category: 'Security',
      summary: 'Policy created by acceptance test runner',
    },
  );

  const policyData =
    (createPolicyResponse.data as { data?: unknown })?.data ||
    createPolicyResponse.data;
  const policyId = (policyData as { id?: string })?.id;
  const createPolicyPassed =
    createPolicyResponse.statusCode === 201 && !!policyId;

  if (policyId) {
    createdEntities.policies.push(policyId);
  }

  checks.push({
    name: 'Create policy',
    passed: createPolicyPassed,
    message: createPolicyPassed
      ? undefined
      : `Status: ${createPolicyResponse.statusCode}`,
  });
  printCheck(
    'Create policy',
    createPolicyPassed,
    checks[checks.length - 1].message,
  );

  // 4.2 Create a new requirement
  const createRequirementResponse = await makeRequest(
    'POST',
    '/grc/requirements',
    getAuthHeaders(),
    {
      framework: 'iso27001',
      referenceCode: 'A.ACC.' + Date.now(),
      title: 'Acceptance Test Requirement - ' + Date.now(),
      description: 'Requirement created by acceptance test runner',
      category: 'Security',
      priority: 'High',
      status: 'Pending',
    },
  );

  const requirementData =
    (createRequirementResponse.data as { data?: unknown })?.data ||
    createRequirementResponse.data;
  const requirementId = (requirementData as { id?: string })?.id;
  const createRequirementPassed =
    createRequirementResponse.statusCode === 201 && !!requirementId;

  if (requirementId) {
    createdEntities.requirements.push(requirementId);
  }

  checks.push({
    name: 'Create requirement',
    passed: createRequirementPassed,
    message: createRequirementPassed
      ? undefined
      : `Status: ${createRequirementResponse.statusCode}`,
  });
  printCheck(
    'Create requirement',
    createRequirementPassed,
    checks[checks.length - 1].message,
  );

  // 4.3 Create a risk to link
  const createRiskResponse = await makeRequest(
    'POST',
    '/grc/risks',
    getAuthHeaders(),
    {
      title: 'Governance Test Risk - ' + Date.now(),
      description: 'Risk for governance scenario',
      category: 'Compliance',
      severity: 'medium',
      likelihood: 'unlikely',
      status: 'identified',
    },
  );

  const riskData =
    (createRiskResponse.data as { data?: unknown })?.data ||
    createRiskResponse.data;
  const riskId = (riskData as { id?: string })?.id;
  const createRiskPassed = createRiskResponse.statusCode === 201 && !!riskId;

  if (riskId) {
    createdEntities.risks.push(riskId);
  }

  checks.push({
    name: 'Create risk for linking',
    passed: createRiskPassed,
    message: createRiskPassed
      ? undefined
      : `Status: ${createRiskResponse.statusCode}`,
  });
  printCheck(
    'Create risk for linking',
    createRiskPassed,
    checks[checks.length - 1].message,
  );

  if (!createRiskPassed || !policyId || !requirementId) {
    return {
      name: 'Governance & Compliance',
      passed: false,
      checks,
      duration: Date.now() - startTime,
    };
  }

  // 4.4 Link policy to risk
  const linkPolicyResponse = await makeRequest(
    'POST',
    `/grc/risks/${riskId}/policies`,
    getAuthHeaders(),
    { policyIds: [policyId] },
  );
  const linkPolicyPassed =
    linkPolicyResponse.statusCode >= 200 &&
    linkPolicyResponse.statusCode < 300;
  checks.push({
    name: 'Link policy to risk',
    passed: linkPolicyPassed,
    message: linkPolicyPassed
      ? undefined
      : `Status: ${linkPolicyResponse.statusCode}`,
  });
  printCheck(
    'Link policy to risk',
    linkPolicyPassed,
    checks[checks.length - 1].message,
  );

  // 4.5 Link requirement to risk
  const linkRequirementResponse = await makeRequest(
    'POST',
    `/grc/risks/${riskId}/requirements`,
    getAuthHeaders(),
    { requirementIds: [requirementId] },
  );
  const linkRequirementPassed =
    linkRequirementResponse.statusCode >= 200 &&
    linkRequirementResponse.statusCode < 300;
  checks.push({
    name: 'Link requirement to risk',
    passed: linkRequirementPassed,
    message: linkRequirementPassed
      ? undefined
      : `Status: ${linkRequirementResponse.statusCode}`,
  });
  printCheck(
    'Link requirement to risk',
    linkRequirementPassed,
    checks[checks.length - 1].message,
  );

  // 4.6 Verify reverse associations
  const policyRisksResponse = await makeRequest(
    'GET',
    `/grc/policies/${policyId}/risks`,
    getAuthHeaders(),
  );
  const policyRisksData =
    (policyRisksResponse.data as { data?: unknown[] })?.data ||
    (policyRisksResponse.data as unknown[]);
  const verifyPolicyRisksPassed =
    policyRisksResponse.statusCode === 200 &&
    Array.isArray(policyRisksData) &&
    policyRisksData.some((r) => (r as { id?: string })?.id === riskId);
  checks.push({
    name: 'Verify policy->risk association',
    passed: verifyPolicyRisksPassed,
    message: verifyPolicyRisksPassed
      ? undefined
      : `Status: ${policyRisksResponse.statusCode}`,
  });
  printCheck(
    'Verify policy->risk association',
    verifyPolicyRisksPassed,
    checks[checks.length - 1].message,
  );

  const requirementRisksResponse = await makeRequest(
    'GET',
    `/grc/requirements/${requirementId}/risks`,
    getAuthHeaders(),
  );
  const requirementRisksData =
    (requirementRisksResponse.data as { data?: unknown[] })?.data ||
    (requirementRisksResponse.data as unknown[]);
  const verifyRequirementRisksPassed =
    requirementRisksResponse.statusCode === 200 &&
    Array.isArray(requirementRisksData) &&
    requirementRisksData.some((r) => (r as { id?: string })?.id === riskId);
  checks.push({
    name: 'Verify requirement->risk association',
    passed: verifyRequirementRisksPassed,
    message: verifyRequirementRisksPassed
      ? undefined
      : `Status: ${requirementRisksResponse.statusCode}`,
  });
  printCheck(
    'Verify requirement->risk association',
    verifyRequirementRisksPassed,
    checks[checks.length - 1].message,
  );

  const allPassed = checks.every((c) => c.passed);
  return {
    name: 'Governance & Compliance',
    passed: allPassed,
    checks,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// SCENARIO 5: Basic Users Check
// ============================================================================
async function runScenario5UsersCheck(): Promise<ScenarioResult> {
  const startTime = Date.now();
  const checks: CheckResult[] = [];

  printScenarioHeader('5. Basic Users Check');

  // 5.1 List users
  const usersResponse = await makeRequest('GET', '/users', getAuthHeaders());
  const usersData = (usersResponse.data as { data?: { users?: unknown[] } })
    ?.data?.users;
  const listUsersPassed =
    usersResponse.statusCode === 200 && Array.isArray(usersData);
  checks.push({
    name: 'List users',
    passed: listUsersPassed,
    message: listUsersPassed
      ? `Found ${usersData?.length || 0} users`
      : `Status: ${usersResponse.statusCode}`,
  });
  printCheck(
    'List users',
    listUsersPassed,
    listUsersPassed ? `Found ${usersData?.length || 0} users` : undefined,
  );

  // 5.2 Verify demo admin user
  let demoAdminFound = false;
  let demoAdminRole = '';
  let demoAdminActive = false;

  if (Array.isArray(usersData)) {
    const demoAdmin = usersData.find(
      (u) => (u as { email?: string })?.email === DEMO_ADMIN_EMAIL,
    );
    if (demoAdmin) {
      demoAdminFound = true;
      demoAdminRole = (demoAdmin as { role?: string })?.role || '';
      demoAdminActive = (demoAdmin as { isActive?: boolean })?.isActive ?? true;
    }
  }

  const verifyDemoAdminPassed =
    demoAdminFound && demoAdminRole === 'admin' && demoAdminActive;
  checks.push({
    name: 'Verify demo admin user',
    passed: verifyDemoAdminPassed,
    message: verifyDemoAdminPassed
      ? undefined
      : `Found: ${demoAdminFound}, Role: ${demoAdminRole}, Active: ${demoAdminActive}`,
  });
  printCheck(
    'Verify demo admin user',
    verifyDemoAdminPassed,
    checks[checks.length - 1].message,
  );

  // 5.3 Get user statistics
  const statsResponse = await makeRequest(
    'GET',
    '/users/statistics/overview',
    getAuthHeaders(),
  );
  const statsData = (statsResponse.data as { data?: unknown })?.data;
  const statsPassed =
    statsResponse.statusCode === 200 &&
    typeof (statsData as { total?: number })?.total === 'number' &&
    typeof (statsData as { admins?: number })?.admins === 'number';
  checks.push({
    name: 'Get user statistics',
    passed: statsPassed,
    message: statsPassed
      ? `Total: ${(statsData as { total?: number })?.total}, Admins: ${(statsData as { admins?: number })?.admins}`
      : `Status: ${statsResponse.statusCode}`,
  });
  printCheck(
    'Get user statistics',
    statsPassed,
    statsPassed
      ? `Total: ${(statsData as { total?: number })?.total}, Admins: ${(statsData as { admins?: number })?.admins}`
      : undefined,
  );

  // 5.4 Verify user count
  const countResponse = await makeRequest('GET', '/users/count');
  const countData = (countResponse.data as { data?: { count?: number } })?.data;
  const countPassed =
    countResponse.statusCode === 200 &&
    typeof countData?.count === 'number' &&
    countData.count > 0;
  checks.push({
    name: 'Verify user count',
    passed: countPassed,
    message: countPassed
      ? `Count: ${countData?.count}`
      : `Status: ${countResponse.statusCode}`,
  });
  printCheck(
    'Verify user count',
    countPassed,
    countPassed ? `Count: ${countData?.count}` : undefined,
  );

  const allPassed = checks.every((c) => c.passed);
  return {
    name: 'Basic Users Check',
    passed: allPassed,
    checks,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// CLEANUP
// ============================================================================
async function cleanup(): Promise<void> {
  console.log('\n' + '-'.repeat(50));
  console.log('Cleanup');
  console.log('-'.repeat(50));

  let cleaned = 0;

  // Cleanup risks
  for (const riskId of createdEntities.risks) {
    const response = await makeRequest(
      'DELETE',
      `/grc/risks/${riskId}`,
      getAuthHeaders(),
    );
    if (response.statusCode === 204) {
      cleaned++;
    }
  }

  // Cleanup policies
  for (const policyId of createdEntities.policies) {
    const response = await makeRequest(
      'DELETE',
      `/grc/policies/${policyId}`,
      getAuthHeaders(),
    );
    if (response.statusCode === 204) {
      cleaned++;
    }
  }

  // Cleanup requirements
  for (const requirementId of createdEntities.requirements) {
    const response = await makeRequest(
      'DELETE',
      `/grc/requirements/${requirementId}`,
      getAuthHeaders(),
    );
    if (response.statusCode === 204) {
      cleaned++;
    }
  }

  // Cleanup incidents
  for (const incidentId of createdEntities.incidents) {
    const response = await makeRequest(
      'DELETE',
      `/itsm/incidents/${incidentId}`,
      getAuthHeaders(),
    );
    if (response.statusCode === 204) {
      cleaned++;
    }
  }

  const total =
    createdEntities.risks.length +
    createdEntities.policies.length +
    createdEntities.requirements.length +
    createdEntities.incidents.length;

  console.log(`  Cleaned up ${cleaned}/${total} test entities`);
}

// ============================================================================
// MAIN
// ============================================================================
async function runAcceptanceTests(): Promise<void> {
  const startTime = Date.now();

  console.log('========================================');
  console.log('GRC Platform Acceptance Test Runner');
  console.log('========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Demo User: ${DEMO_ADMIN_EMAIL}`);
  console.log(`Tenant ID: ${DEMO_TENANT_ID}`);
  console.log('');

  const results: ScenarioResult[] = [];

  // Run all scenarios
  results.push(await runScenario1LoginDashboard());

  // Only continue if login succeeded
  if (authToken) {
    results.push(await runScenario2RiskLifecycle());
    results.push(await runScenario3IncidentLifecycle());
    results.push(await runScenario4GovernanceCompliance());
    results.push(await runScenario5UsersCheck());

    // Cleanup test data
    await cleanup();
  }

  // Print summary
  const totalDuration = Date.now() - startTime;
  const passedScenarios = results.filter((r) => r.passed).length;
  const failedScenarios = results.filter((r) => !r.passed).length;
  const totalChecks = results.reduce((sum, r) => sum + r.checks.length, 0);
  const passedChecks = results.reduce(
    (sum, r) => sum + r.checks.filter((c) => c.passed).length,
    0,
  );
  const failedChecks = totalChecks - passedChecks;

  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log(
    `Scenarios: ${passedScenarios} passed, ${failedScenarios} failed`,
  );
  console.log(`Total checks: ${passedChecks} passed, ${failedChecks} failed`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log('');

  if (failedScenarios === 0) {
    console.log('[SUCCESS] All acceptance scenarios passed!');
  } else {
    console.log('[FAILURE] Some acceptance scenarios failed.');
    console.log('');
    console.log('Failed scenarios:');
    for (const result of results) {
      if (!result.passed) {
        console.log(`  - ${result.name}`);
        for (const check of result.checks) {
          if (!check.passed) {
            console.log(`      [FAIL] ${check.name}: ${check.message || ''}`);
          }
        }
      }
    }
  }

  console.log('\n========================================\n');

  process.exit(failedScenarios > 0 ? 1 : 0);
}

// Run the acceptance tests
runAcceptanceTests().catch((error) => {
  console.error('Acceptance test error:', error);
  process.exit(1);
});
