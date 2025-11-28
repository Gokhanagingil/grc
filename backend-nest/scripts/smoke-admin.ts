#!/usr/bin/env ts-node
/**
 * Admin Module Smoke Test
 * 
 * Tests admin endpoints (requires admin role).
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/smoke-admin.ts
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
  console.log('=== Admin Module Smoke Test ===\n');
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

  // Test 1: Admin Health
  console.log('\n[SMOKE] Testing admin health endpoint...');
  const health = await jsonFetch(`${BASE}/api/v2/admin/health`, {
    method: 'GET',
    headers,
  });

  if (health.status !== 200) {
    console.error('FAIL ADMIN HEALTH', health.status, health.body);
    errors++;
  } else {
    console.log('✅ PASS ADMIN HEALTH');
    console.log('  Response:', JSON.stringify(health.body, null, 2));
  }

  // Test 2: Admin Summary
  console.log('\n[SMOKE] Testing admin summary endpoint...');
  const summary = await jsonFetch(`${BASE}/api/v2/admin/summary`, {
    method: 'GET',
    headers,
  });

  if (summary.status !== 200) {
    console.error('FAIL ADMIN SUMMARY', summary.status, summary.body);
    errors++;
  } else {
    console.log('✅ PASS ADMIN SUMMARY');
    console.log('  Statistics:', JSON.stringify(summary.body.statistics, null, 2));
    console.log('  Version:', summary.body.version);
  }

  // Test 3: List Roles
  console.log('\n[SMOKE] Testing list roles endpoint...');
  const listRoles = await jsonFetch(`${BASE}/api/v2/admin/roles?page=1&pageSize=10`, {
    method: 'GET',
    headers,
  });

  if (listRoles.status !== 200) {
    console.error('FAIL LIST ROLES', listRoles.status, listRoles.body);
    errors++;
  } else {
    console.log('✅ PASS LIST ROLES');
    console.log(`  Found ${listRoles.body.items?.length || 0} roles`);
  }

  // Test 4: Create Role
  console.log('\n[SMOKE] Testing create role endpoint...');
  const roleName = `test-role-${Date.now()}`;
  const createRole = await jsonFetch(`${BASE}/api/v2/admin/roles`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: roleName,
      description: 'Test role for smoke test',
    }),
  });

  if (createRole.status !== 201) {
    console.error('FAIL CREATE ROLE', createRole.status, createRole.body);
    errors++;
  } else {
    console.log('✅ PASS CREATE ROLE');
    const roleId = createRole.body.id;
    console.log(`  Created role: ${roleName} (ID: ${roleId})`);

    // Test 5: Update Role
    console.log('\n[SMOKE] Testing update role endpoint...');
    const updateRole = await jsonFetch(`${BASE}/api/v2/admin/roles/${roleId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        description: 'Updated test role description',
      }),
    });

    if (updateRole.status !== 200) {
      console.error('FAIL UPDATE ROLE', updateRole.status, updateRole.body);
      errors++;
    } else {
      console.log('✅ PASS UPDATE ROLE');
    }

    // Test 6: Delete Role
    console.log('\n[SMOKE] Testing delete role endpoint...');
    const deleteRole = await jsonFetch(`${BASE}/api/v2/admin/roles/${roleId}`, {
      method: 'DELETE',
      headers,
    });

    if (deleteRole.status !== 200) {
      console.error('FAIL DELETE ROLE', deleteRole.status, deleteRole.body);
      errors++;
    } else {
      console.log('✅ PASS DELETE ROLE');
    }
  }

  // Test 7: List Permissions
  console.log('\n[SMOKE] Testing list permissions endpoint...');
  const listPermissions = await jsonFetch(`${BASE}/api/v2/admin/permissions`, {
    method: 'GET',
    headers,
  });

  if (listPermissions.status !== 200) {
    console.error('FAIL LIST PERMISSIONS', listPermissions.status, listPermissions.body);
    errors++;
  } else {
    console.log('✅ PASS LIST PERMISSIONS');
    console.log(`  Found ${listPermissions.body.items?.length || 0} permissions`);
  }

  if (errors > 0) {
    console.error(`\n❌ Admin smoke test failed with ${errors} error(s)`);
    process.exit(1);
  } else {
    console.log('\n✅ All admin smoke tests passed!');
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

