#!/usr/bin/env ts-node
/**
 * Audit Flow Smoke Test
 * 
 * Tests end-to-end audit flow: Engagement → Test → Finding → Corrective Action → Evidence
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/smoke-audit-flow.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const BASE = (process.env.API_BASE || 'http://localhost:5002').replace(/\/+$/, '');
const TENANT = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
const EMAIL = process.env.SMOKE_USER || 'grc1@local';
const PASS = process.env.SMOKE_PASS || 'grc1';

async function jsonFetch(url: string, opts: any = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

async function login(): Promise<string | null> {
  console.log('[SMOKE] Logging in...');
  const login = await jsonFetch(`${BASE}/api/v2/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASS }),
    headers: { 'x-tenant-id': TENANT },
  });

  if ((login.status !== 200 && login.status !== 201) || !login.body?.access_token) {
    console.error('FAIL LOGIN', login.status, login.body);
    return null;
  }
  console.log('✅ PASS LOGIN');
  return login.body.access_token;
}

async function main() {
  console.log('=== Audit Flow Smoke Test ===\n');
  console.log(`Base URL: ${BASE}`);
  console.log(`Tenant ID: ${TENANT}\n`);

  // Step 1: Login
  const token = await login();
  if (!token) {
    console.error('❌ Cannot proceed without authentication');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': TENANT,
  };

  // Step 2: Create Audit Plan (required for engagement)
  console.log('\n[SMOKE] Creating audit plan...');
  const planCode = `PLAN-SMOKE-${Date.now()}`;
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const yearEnd = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
  const planPayload = {
    code: planCode,
    name: 'Smoke Test Audit Plan',
    period_start: yearStart,
    period_end: yearEnd,
    status: 'planned',
  };

  const createPlan = await jsonFetch(`${BASE}/api/v2/audit/plans`, {
    method: 'POST',
    body: JSON.stringify(planPayload),
    headers,
  });

  if (createPlan.status !== 201 && createPlan.status !== 200) {
    console.error('FAIL CREATE PLAN', createPlan.status, createPlan.body);
    process.exit(1);
  }

  const planId = createPlan.body.id;
  console.log('✅ PASS CREATE PLAN');
  console.log(`  Plan ID: ${planId}`);

  // Step 3: Create Engagement
  console.log('\n[SMOKE] Creating engagement...');
  const engagementCode = `ENG-SMOKE-${Date.now()}`;
  const engagementPayload = {
    plan_id: planId,
    code: engagementCode,
    name: 'Smoke Test Engagement',
    status: 'in_progress',
  };

  const createEngagement = await jsonFetch(`${BASE}/api/v2/audit/engagements`, {
    method: 'POST',
    body: JSON.stringify(engagementPayload),
    headers,
  });

  if (createEngagement.status !== 201 && createEngagement.status !== 200) {
    console.error('FAIL CREATE ENGAGEMENT', createEngagement.status, createEngagement.body);
    process.exit(1);
  }

  const engagementId = createEngagement.body.id;
  console.log('✅ PASS CREATE ENGAGEMENT');
  console.log(`  Engagement ID: ${engagementId}`);

  // Step 4: Create Test
  console.log('\n[SMOKE] Creating test...');
  const testCode = `TEST-SMOKE-${Date.now()}`;
  const testPayload = {
    engagement_id: engagementId,
    code: testCode,
    name: 'Smoke Test - MFA Check',
    status: 'failed', // FAIL to trigger finding creation
  };

  const createTest = await jsonFetch(`${BASE}/api/v2/audit/tests`, {
    method: 'POST',
    body: JSON.stringify(testPayload),
    headers,
  });

  if (createTest.status !== 201 && createTest.status !== 200) {
    console.error('FAIL CREATE TEST', createTest.status, createTest.body);
    process.exit(1);
  }

  const testId = createTest.body.id;
  console.log('✅ PASS CREATE TEST');
  console.log(`  Test ID: ${testId}`);

  // Step 5: Create Finding from Test
  console.log('\n[SMOKE] Creating finding from test...');
  const findingPayload = {
    title: 'MFA Gap in Critical Services',
    description: 'MFA not enabled on APP-FIN and SVC-LOGIN',
    severity: 'high',
    root_cause: 'Missing security controls',
  };

  const createFinding = await jsonFetch(`${BASE}/api/v2/audit/tests/${testId}/findings`, {
    method: 'POST',
    body: JSON.stringify(findingPayload),
    headers,
  });

  if (createFinding.status !== 201 && createFinding.status !== 200) {
    console.error('FAIL CREATE FINDING', createFinding.status, createFinding.body);
    process.exit(1);
  }

  const findingId = createFinding.body.id;
  console.log('✅ PASS CREATE FINDING');
  console.log(`  Finding ID: ${findingId}`);

  // Step 6: Create Corrective Action from Finding
  console.log('\n[SMOKE] Creating corrective action from finding...');
  const capCode = `CAP-SMOKE-${Date.now()}`;
  const capPayload = {
    code: capCode,
    title: 'Enable MFA on APP-FIN & SVC-LOGIN',
    description: 'Implement MFA controls',
    status: 'open',
  };

  const createCAP = await jsonFetch(`${BASE}/api/v2/audit/findings/${findingId}/corrective-actions`, {
    method: 'POST',
    body: JSON.stringify(capPayload),
    headers,
  });

  if (createCAP.status !== 201 && createCAP.status !== 200) {
    console.error('FAIL CREATE CAP', createCAP.status, createCAP.body);
    process.exit(1);
  }

  const capId = createCAP.body.id;
  console.log('✅ PASS CREATE CAP');
  console.log(`  CAP ID: ${capId}`);

  // Step 7: Add Evidence to Test
  console.log('\n[SMOKE] Adding evidence to test...');
  const evidencePayload = {
    type: 'link',
    file_url: 'https://example.com/evidence.pdf',
    note: 'Evidence link for smoke test',
    collected_at: new Date().toISOString(),
  };

  const createEvidence = await jsonFetch(`${BASE}/api/v2/audit/tests/${testId}/evidence`, {
    method: 'POST',
    body: JSON.stringify(evidencePayload),
    headers,
  });

  if (createEvidence.status !== 201 && createEvidence.status !== 200) {
    console.error('FAIL CREATE EVIDENCE', createEvidence.status, createEvidence.body);
    process.exit(1);
  }

  console.log('✅ PASS CREATE EVIDENCE');
  console.log(`  Evidence ID: ${createEvidence.body.id}`);

  console.log('\n✅ All Audit flow smoke tests passed!');
  console.log(`\nCreated entities:`);
  console.log(`  - Plan: ${planId}`);
  console.log(`  - Engagement: ${engagementId}`);
  console.log(`  - Test: ${testId}`);
  console.log(`  - Finding: ${findingId}`);
  console.log(`  - CAP: ${capId}`);
  process.exitCode = 0;
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

