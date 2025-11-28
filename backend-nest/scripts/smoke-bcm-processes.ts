#!/usr/bin/env ts-node
/**
 * BCM Processes Smoke Test
 * 
 * Tests BCM processes list endpoint with pagination
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/smoke-bcm-processes.ts
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
  console.log('=== BCM Processes Smoke Test ===\n');
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

  // Step 2: List BCM Processes with page=0&pageSize=20
  console.log('\n[SMOKE] Listing BCM processes (page=0, pageSize=20)...');
  const list = await jsonFetch(`${BASE}/api/v2/bcm/processes?page=0&pageSize=20`, {
    method: 'GET',
    headers,
  });

  if (list.status !== 200) {
    console.error('FAIL LIST', list.status, list.body);
    process.exit(1);
  }

  const processes = list.body.items || [];
  console.log('✅ PASS LIST');
  console.log(`  Found ${processes.length} processes`);
  console.log(`  Total: ${list.body.total || 0}`);

  // Step 3: List with page=1&pageSize=5
  console.log('\n[SMOKE] Listing BCM processes (page=1, pageSize=5)...');
  const list2 = await jsonFetch(`${BASE}/api/v2/bcm/processes?page=1&pageSize=5`, {
    method: 'GET',
    headers,
  });

  if (list2.status !== 200) {
    console.error('FAIL LIST (page=1)', list2.status, list2.body);
    process.exit(1);
  }

  console.log('✅ PASS LIST (page=1)');
  console.log(`  Found ${(list2.body.items || []).length} processes`);

  console.log('\n✅ All BCM processes smoke tests passed!');
  process.exitCode = 0;
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

