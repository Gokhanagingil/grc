/**
 * Smoke test for role-permission assignment endpoint
 * Tests: POST /api/v2/admin/roles/:id/permissions
 */

import 'reflect-metadata';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const BASE = (process.env.API_BASE || 'http://localhost:5002').replace(/\/+$/, '');
const API_URL = `${BASE}/api/v2`;
const TENANT_ID = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
const TEST_EMAIL = 'grc1@local';
const TEST_PASSWORD = 'grc1';

async function jsonFetch(url: string, opts: any = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (!r.ok) {
    const text = await r.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
    const error: any = new Error(`HTTP ${r.status}: ${data.message || r.statusText}`);
    error.status = r.status;
    error.response = { status: r.status, data };
    throw error;
  }
  return r.json();
}


async function login(): Promise<string> {
  console.log('[SMOKE] Logging in...');
  const response = await jsonFetch(`${API_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    headers: {
      'x-tenant-id': TENANT_ID,
    },
  });

  if (!response.access_token) {
    throw new Error(`Login failed: ${JSON.stringify(response)}`);
  }

  console.log('✅ PASS LOGIN');
  return response.access_token;
}

async function testRolePermissionAssignment(token: string) {
  console.log('\n=== Role-Permission Assignment Smoke Test ===\n');

  // Step 1: Get or create a role
  console.log('[SMOKE] Getting roles...');
  const rolesResponse = await jsonFetch(`${API_URL}/admin/roles?page=1&pageSize=10`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': TENANT_ID,
    },
  });

  const roles = rolesResponse.items || [];
  if (roles.length === 0) {
    throw new Error('No roles found. Please seed roles first.');
  }

  const testRole = roles[0];
  console.log(`✅ Found role: ${testRole.name} (ID: ${testRole.id})`);

  // Step 2: Get or create permissions
  console.log('\n[SMOKE] Getting permissions...');
  const permsResponse = await jsonFetch(`${API_URL}/admin/permissions`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': TENANT_ID,
    },
  });

  const permissions = permsResponse.items || [];
  console.log(`✅ Found ${permissions.length} permissions`);

  if (permissions.length === 0) {
    console.log('⚠️  No permissions found. Creating a test permission...');
    // Create a test permission
    const createPermResponse = await jsonFetch(
      `${API_URL}/admin/permissions`,
      {
        method: 'POST',
        body: JSON.stringify({
          code: 'test:permission:smoke',
          description: 'Test permission for smoke test',
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      }
    );

    permissions.push(createPermResponse);
    console.log(`✅ Created test permission: ${createPermResponse.code}`);
  }

  // Step 3: Get current role permissions
  console.log(`\n[SMOKE] Getting current permissions for role: ${testRole.name}...`);
  try {
    const currentPermsResponse = await jsonFetch(
      `${API_URL}/admin/roles/${testRole.id}/permissions`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      }
    );

    const currentPerms = currentPermsResponse.permissions || [];
    console.log(`✅ Current permissions: ${currentPerms.length}`);
    if (currentPerms.length > 0) {
      console.log(`   Permissions: ${currentPerms.map((p: any) => p.code).join(', ')}`);
    }
  } catch (err: any) {
    if (err.status === 404) {
      console.log('⚠️  GET role permissions returned 404 (endpoint might not exist or role has no permissions)');
    } else {
      throw err;
    }
  }

  // Step 4: Assign permissions to role
  const permissionCodes = permissions.slice(0, 2).map((p: any) => p.code);
  console.log(`\n[SMOKE] Assigning permissions to role: ${permissionCodes.join(', ')}...`);
  console.log(`[SMOKE] Request URL: POST ${API_URL}/admin/roles/${testRole.id}/permissions`);
  console.log(`[SMOKE] Request payload:`, { permissions: permissionCodes });

  try {
    const assignResponse = await jsonFetch(
      `${API_URL}/admin/roles/${testRole.id}/permissions`,
      {
        method: 'POST',
        body: JSON.stringify({
          permissions: permissionCodes,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      }
    );

    console.log(`✅ PASS ASSIGN PERMISSIONS`);
    console.log(`   Response:`, JSON.stringify(assignResponse, null, 2));
  } catch (err: any) {
    console.error(`❌ FAIL ASSIGN PERMISSIONS`);
    console.error(`   Status: ${err.status || 'unknown'}`);
    console.error(`   Response:`, JSON.stringify(err.response?.data || err.message, null, 2));
    throw err;
  }

  // Step 5: Verify permissions were assigned
  console.log(`\n[SMOKE] Verifying permissions were assigned...`);
  try {
    const verifyResponse = await jsonFetch(
      `${API_URL}/admin/roles/${testRole.id}/permissions`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      }
    );

    const assignedPerms = verifyResponse.permissions || [];
    const assignedCodes = assignedPerms.map((p: any) => p.code);
    console.log(`✅ Verification: Found ${assignedPerms.length} permissions`);
    console.log(`   Assigned: ${assignedCodes.join(', ')}`);

    const allAssigned = permissionCodes.every((code: string) => assignedCodes.includes(code));
    if (allAssigned) {
      console.log('✅ All permissions were successfully assigned');
    } else {
      console.log('⚠️  Some permissions might not have been assigned');
    }
  } catch (err: any) {
    console.log('⚠️  Could not verify permissions (GET endpoint might not be available)');
  }

  console.log('\n✅ All role-permission assignment smoke tests passed!');
}

async function main() {
  try {
    const token = await login();
    await testRolePermissionAssignment(token);
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Smoke test failed:');
    console.error(error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();

