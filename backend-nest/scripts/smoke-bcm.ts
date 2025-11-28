#!/usr/bin/env ts-node
/**
 * BCM Module Smoke Test
 * 
 * Tests basic CRUD operations for BCM module (BIA Process, BCP Plan, BCP Exercise).
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/smoke-bcm.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const BASE = (process.env.API_BASE || 'http://localhost:5002').replace(/\/+$/, '');
const TENANT = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
const EMAIL = process.env.SMOKE_USER || 'grc1@local';
const PASS = process.env.SMOKE_PASS || 'grc1';

interface BIAProcess {
  id: string;
  code: string;
  name: string;
  tenant_id: string;
}

interface BCPPlan {
  id: string;
  code: string;
  name: string;
  tenant_id: string;
}

interface BCPExercise {
  id: string;
  code: string;
  name: string;
  plan_id: string;
  tenant_id: string;
}

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
  console.log('=== BCM Module Smoke Test ===\n');
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

  let errors = 0;

  // Step 2: Create BIA Process
  console.log('\n[SMOKE] Creating BIA Process...');
  const processCode = `BIA-SMOKE-${Date.now()}`;
  const createProcessPayload = {
    code: processCode,
    name: 'Smoke Test BIA Process',
    description: 'Test process for smoke testing',
  };

  const createProcess = await jsonFetch(`${BASE}/api/v2/bcm/processes`, {
    method: 'POST',
    body: JSON.stringify(createProcessPayload),
    headers,
  });

  if (createProcess.status !== 201 && createProcess.status !== 200) {
    console.error('FAIL CREATE BIA PROCESS', createProcess.status, createProcess.body);
    errors++;
  } else {
    const createdProcess: BIAProcess = createProcess.body;
    console.log('✅ PASS CREATE BIA PROCESS');
    console.log(`  Process ID: ${createdProcess.id}`);
    console.log(`  Code: ${createdProcess.code}`);

    // Step 3: Create BCP Plan (with process_id)
    console.log('\n[SMOKE] Creating BCP Plan...');
    const planCode = `BCP-SMOKE-${Date.now()}`;
    const createPlanPayload = {
      code: planCode,
      name: 'Smoke Test BCP Plan',
      process_id: createdProcess.id, // Use created process
      status: 'draft',
    };

    const createPlan = await jsonFetch(`${BASE}/api/v2/bcm/plans`, {
      method: 'POST',
      body: JSON.stringify(createPlanPayload),
      headers,
    });

    if (createPlan.status !== 201 && createPlan.status !== 200) {
      console.error('FAIL CREATE BCP PLAN', createPlan.status, createPlan.body);
      errors++;
    } else {
      const createdPlan: BCPPlan = createPlan.body;
      console.log('✅ PASS CREATE BCP PLAN');
      console.log(`  Plan ID: ${createdPlan.id}`);
      console.log(`  Code: ${createdPlan.code}`);

      // Step 4: Create BCP Exercise (with plan_id)
      console.log('\n[SMOKE] Creating BCP Exercise...');
      const exerciseCode = `EX-SMOKE-${Date.now()}`;
      const exerciseDate = new Date().toISOString().split('T')[0]; // yyyy-MM-dd
      const createExercisePayload = {
        plan_id: createdPlan.id, // Use created plan
        code: exerciseCode,
        name: 'Smoke Test BCP Exercise',
        date: exerciseDate,
      };

      const createExercise = await jsonFetch(`${BASE}/api/v2/bcm/exercises`, {
        method: 'POST',
        body: JSON.stringify(createExercisePayload),
        headers,
      });

      if (createExercise.status !== 201 && createExercise.status !== 200) {
        console.error('FAIL CREATE BCP EXERCISE', createExercise.status, createExercise.body);
        errors++;
      } else {
        const createdExercise: BCPExercise = createExercise.body;
        console.log('✅ PASS CREATE BCP EXERCISE');
        console.log(`  Exercise ID: ${createdExercise.id}`);
        console.log(`  Code: ${createdExercise.code}`);
      }
    }
  }

  // Step 5: List BIA Processes
  console.log('\n[SMOKE] Listing BIA Processes...');
  const listProcesses = await jsonFetch(`${BASE}/api/v2/bcm/processes?page=1&pageSize=10`, {
    method: 'GET',
    headers,
  });

  if (listProcesses.status !== 200) {
    console.error('FAIL LIST BIA PROCESSES', listProcesses.status, listProcesses.body);
    errors++;
  } else {
    const processes = listProcesses.body.items || listProcesses.body || [];
    console.log('✅ PASS LIST BIA PROCESSES');
    console.log(`  Found ${Array.isArray(processes) ? processes.length : 0} processes`);
  }

  if (errors > 0) {
    console.error(`\n❌ BCM smoke test failed with ${errors} error(s)`);
    process.exit(1);
  } else {
    console.log('\n✅ All BCM smoke tests passed!');
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

