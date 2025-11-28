#!/usr/bin/env ts-node
/**
 * Requirement Module Smoke Test
 * 
 * Tests basic CRUD operations for Compliance/Requirement module.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/smoke-requirements.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const BASE = (process.env.API_BASE || 'http://localhost:5002').replace(/\/+$/, '');
const TENANT = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
const EMAIL = process.env.SMOKE_USER || 'grc1@local';
const PASS = process.env.SMOKE_PASS || 'grc1';

interface Requirement {
  id: string;
  title: string;
  status: string;
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
  console.log('=== Requirement Module Smoke Test ===\n');
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

  // Step 2: Create Requirement
  console.log('\n[SMOKE] Creating requirement...');
  const createPayload = {
    title: `Smoke Test Requirement ${Date.now()}`,
    status: 'pending',
  };

  const create = await jsonFetch(`${BASE}/api/v2/compliance`, {
    method: 'POST',
    body: JSON.stringify(createPayload),
    headers,
  });

  if (create.status !== 201 && create.status !== 200) {
    console.error('FAIL CREATE', create.status, create.body);
    process.exit(1);
  }

  const createdRequirement: Requirement = create.body;
  console.log('✅ PASS CREATE');
  console.log(`  Requirement ID: ${createdRequirement.id}`);
  console.log(`  Title: ${createdRequirement.title}`);

  // Step 3: List Requirements
  console.log('\n[SMOKE] Listing requirements...');
  const list = await jsonFetch(`${BASE}/api/v2/compliance/requirements?page=1&pageSize=10`, {
    method: 'GET',
    headers,
  });

  if (list.status !== 200) {
    console.error('FAIL LIST', list.status, list.body);
    process.exit(1);
  }

  const requirements = list.body.items || [];
  const found = requirements.find((r: Requirement) => r.id === createdRequirement.id);
  if (!found) {
    console.error('FAIL LIST - Created requirement not found in list');
    process.exit(1);
  }
  console.log('✅ PASS LIST');
  console.log(`  Found ${requirements.length} requirements`);

  // Step 4: Get Requirement by ID
  console.log('\n[SMOKE] Getting requirement by ID...');
  const get = await jsonFetch(`${BASE}/api/v2/compliance/${createdRequirement.id}`, {
    method: 'GET',
    headers,
  });

  if (get.status !== 200) {
    console.error('FAIL GET', get.status, get.body);
    process.exit(1);
  }

  const requirement: Requirement = get.body;
  if (requirement.id !== createdRequirement.id) {
    console.error('FAIL GET - Requirement data mismatch');
    process.exit(1);
  }
  console.log('✅ PASS GET');
  console.log(`  Title: ${requirement.title}`);

  console.log('\n✅ All Requirement smoke tests passed!');
  process.exitCode = 0;
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

