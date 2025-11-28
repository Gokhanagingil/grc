#!/usr/bin/env ts-node
/**
 * BCM Validation Failed Test Script
 * 
 * Simulates frontend payload with empty strings to reproduce validation errors.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/test-bcm-validation.ts
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
  console.log('[TEST] Logging in...');
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
  console.log('=== BCM Validation Failed Test ===\n');
  console.log(`Base URL: ${BASE}`);
  console.log(`Tenant ID: ${TENANT}\n`);

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

  // Test 1: BCP Plan with empty string process_id and scope_entity_id
  console.log('\n[TEST 1] Creating BCP Plan with empty string process_id and scope_entity_id...');
  const planPayload1 = {
    code: `BCP-TEST-${Date.now()}`,
    name: 'Test BCP Plan',
    process_id: '',        // ⚠️ Empty string (should fail validation)
    scope_entity_id: '',  // ⚠️ Empty string (should fail validation)
    version: '1.0',
    status: 'draft',
  };
  console.log('Payload:', JSON.stringify(planPayload1, null, 2));
  
  const plan1 = await jsonFetch(`${BASE}/api/v2/bcm/plans`, {
    method: 'POST',
    body: JSON.stringify(planPayload1),
    headers,
  });

  if (plan1.status === 400 || plan1.status === 422) {
    console.log('✅ EXPECTED VALIDATION ERROR');
    console.log('Status:', plan1.status);
    console.log('Response:', JSON.stringify(plan1.body, null, 2));
    if (plan1.body?.message?.includes('Validation failed') || 
        plan1.body?.message?.some((m: string) => m.includes('UUID'))) {
      console.log('✅ Validation error detected (UUID validation failed)');
    } else {
      console.log('⚠️  Validation error but message format unexpected');
      errors++;
    }
  } else if (plan1.status === 201 || plan1.status === 200) {
    console.log('❌ UNEXPECTED: Request succeeded (should have failed validation)');
    console.log('Response:', JSON.stringify(plan1.body, null, 2));
    errors++;
  } else {
    console.log('⚠️  Unexpected status:', plan1.status);
    console.log('Response:', JSON.stringify(plan1.body, null, 2));
    errors++;
  }

  // Test 2: BIA Process with empty string owner_user_id
  console.log('\n[TEST 2] Creating BIA Process with empty string owner_user_id...');
  const processPayload = {
    code: `BIA-TEST-${Date.now()}`,
    name: 'Test BIA Process',
    owner_user_id: '',  // ⚠️ Empty string (should fail validation)
  };
  console.log('Payload:', JSON.stringify(processPayload, null, 2));
  
  const processRes = await jsonFetch(`${BASE}/api/v2/bcm/processes`, {
    method: 'POST',
    body: JSON.stringify(processPayload),
    headers,
  });

  if (processRes.status === 400 || processRes.status === 422) {
    console.log('✅ EXPECTED VALIDATION ERROR');
    console.log('Status:', processRes.status);
    console.log('Response:', JSON.stringify(processRes.body, null, 2));
    if (processRes.body?.message?.includes('Validation failed') || 
        processRes.body?.message?.some((m: string) => m.includes('UUID'))) {
      console.log('✅ Validation error detected (UUID validation failed)');
    } else {
      console.log('⚠️  Validation error but message format unexpected');
      errors++;
    }
  } else if (processRes.status === 201 || processRes.status === 200) {
    console.log('❌ UNEXPECTED: Request succeeded (should have failed validation)');
    console.log('Response:', JSON.stringify(processRes.body, null, 2));
    errors++;
  } else {
    console.log('⚠️  Unexpected status:', processRes.status);
    console.log('Response:', JSON.stringify(processRes.body, null, 2));
    errors++;
  }

  // Test 3: BCP Plan with valid UUID (should succeed)
  console.log('\n[TEST 3] Creating BCP Plan WITHOUT process_id/scope_entity_id (should succeed)...');
  const planPayload3 = {
    code: `BCP-TEST-${Date.now()}`,
    name: 'Test BCP Plan (no optional fields)',
    version: '1.0',
    status: 'draft',
  };
  console.log('Payload:', JSON.stringify(planPayload3, null, 2));
  
  const plan3 = await jsonFetch(`${BASE}/api/v2/bcm/plans`, {
    method: 'POST',
    body: JSON.stringify(planPayload3),
    headers,
  });

  if (plan3.status === 201 || plan3.status === 200) {
    console.log('✅ PASS: Request succeeded (as expected)');
    console.log('Plan ID:', plan3.body?.id);
  } else {
    console.log('❌ FAIL: Request failed unexpectedly');
    console.log('Status:', plan3.status);
    console.log('Response:', JSON.stringify(plan3.body, null, 2));
    errors++;
  }

  console.log('\n=== Test Summary ===');
  if (errors > 0) {
    console.log(`❌ Tests completed with ${errors} unexpected result(s)`);
    process.exit(1);
  } else {
    console.log('✅ All tests completed as expected');
    console.log('\nNote: Validation errors in Test 1 and Test 2 are EXPECTED.');
    console.log('These will be fixed in PHASE 2 with DTO transformers.');
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

