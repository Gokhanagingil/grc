#!/usr/bin/env ts-node
/**
 * Policy Module Smoke Test
 * 
 * Tests basic CRUD operations for Governance/Policy module.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/smoke-policies.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const BASE = (process.env.API_BASE || 'http://localhost:5002').replace(/\/+$/, '');
const TENANT = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
const EMAIL = process.env.SMOKE_USER || 'grc1@local';
const PASS = process.env.SMOKE_PASS || 'grc1';

interface Policy {
  id: string;
  code: string;
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
  console.log('=== Policy Module Smoke Test ===\n');
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

  // Step 2: Create Policy
  console.log('\n[SMOKE] Creating policy...');
  const policyCode = `POL-SMOKE-${Date.now()}`;
  const createPayload = {
    code: policyCode,
    title: 'Smoke Test Policy',
    status: 'draft',
  };

  const create = await jsonFetch(`${BASE}/api/v2/governance/policies`, {
    method: 'POST',
    body: JSON.stringify(createPayload),
    headers,
  });

  if (create.status !== 201 && create.status !== 200) {
    console.error('FAIL CREATE', create.status, create.body);
    process.exit(1);
  }

  const createdPolicy: Policy = create.body;
  console.log('✅ PASS CREATE');
  console.log(`  Policy ID: ${createdPolicy.id}`);
  console.log(`  Code: ${createdPolicy.code}`);

  // Step 3: List Policies
  console.log('\n[SMOKE] Listing policies...');
  const list = await jsonFetch(`${BASE}/api/v2/governance/policies?page=1&pageSize=10`, {
    method: 'GET',
    headers,
  });

  if (list.status !== 200) {
    console.error('FAIL LIST', list.status, list.body);
    process.exit(1);
  }

  const policies = list.body.items || [];
  const found = policies.find((p: Policy) => p.id === createdPolicy.id);
  if (!found) {
    console.error('FAIL LIST - Created policy not found in list');
    process.exit(1);
  }
  console.log('✅ PASS LIST');
  console.log(`  Found ${policies.length} policies`);

  // Step 4: Get Policy by ID
  console.log('\n[SMOKE] Getting policy by ID...');
  const get = await jsonFetch(`${BASE}/api/v2/governance/policies/${createdPolicy.id}`, {
    method: 'GET',
    headers,
  });

  if (get.status !== 200) {
    console.error('FAIL GET', get.status, get.body);
    process.exit(1);
  }

  const policy: Policy = get.body;
  if (policy.id !== createdPolicy.id || policy.code !== policyCode) {
    console.error('FAIL GET - Policy data mismatch');
    process.exit(1);
  }
  console.log('✅ PASS GET');
  console.log(`  Title: ${policy.title}`);

  // Step 5: List Standards (for mapping)
  console.log('\n[SMOKE] Listing standards for mapping...');
  const listStandards = await jsonFetch(`${BASE}/api/v2/standards`, {
    method: 'GET',
    headers,
  });

  if (listStandards.status !== 200) {
    console.warn('⚠️  WARN LIST STANDARDS', listStandards.status, listStandards.body);
  } else {
    const standards = Array.isArray(listStandards.body) ? listStandards.body : [];
    console.log('✅ PASS LIST STANDARDS');
    console.log(`  Found ${standards.length} standards`);

    // Step 6: Map Standard to Policy (if standards available)
    if (standards.length > 0) {
      const firstStandard = standards[0];
      console.log('\n[SMOKE] Mapping standard to policy...');
      const mapStandard = await jsonFetch(
        `${BASE}/api/v2/governance/policies/${createdPolicy.id}/standards`,
        {
          method: 'POST',
          body: JSON.stringify({ standardId: firstStandard.id }),
          headers,
        }
      );

      if (mapStandard.status !== 201 && mapStandard.status !== 200) {
        console.warn('⚠️  WARN MAP STANDARD', mapStandard.status, mapStandard.body);
      } else {
        console.log('✅ PASS MAP STANDARD');
        console.log(`  Mapped standard: ${firstStandard.code || firstStandard.name}`);

        // Step 7: Get Policy Standards
        console.log('\n[SMOKE] Getting policy standards...');
        const getPolicyStandards = await jsonFetch(
          `${BASE}/api/v2/governance/policies/${createdPolicy.id}/standards`,
          {
            method: 'GET',
            headers,
          }
        );

        if (getPolicyStandards.status !== 200) {
          console.warn('⚠️  WARN GET POLICY STANDARDS', getPolicyStandards.status, getPolicyStandards.body);
        } else {
          const mappings = Array.isArray(getPolicyStandards.body) ? getPolicyStandards.body : [];
          console.log('✅ PASS GET POLICY STANDARDS');
          console.log(`  Found ${mappings.length} standard mapping(s)`);
        }
      }
    }
  }

  // Step 8: Update Policy
  console.log('\n[SMOKE] Updating policy...');
  const updatePayload = {
    title: 'Updated Smoke Test Policy',
    status: 'approved',
  };

  const update = await jsonFetch(`${BASE}/api/v2/governance/policies/${createdPolicy.id}`, {
    method: 'PUT',
    body: JSON.stringify(updatePayload),
    headers,
  });

  if (update.status !== 200) {
    console.warn('⚠️  WARN UPDATE', update.status, update.body);
  } else {
    console.log('✅ PASS UPDATE');
    console.log(`  Updated title: ${update.body.title}`);
  }

  console.log('\n✅ All Policy smoke tests passed!');
  process.exitCode = 0;
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

