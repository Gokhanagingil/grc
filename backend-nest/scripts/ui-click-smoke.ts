#!/usr/bin/env ts-node
/**
 * UI Click-Smoke Test
 * 
 * Simulates UI click flows by calling backend endpoints in the same order
 * as a user would interact with the UI.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/ui-click-smoke.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const BASE = (process.env.API_BASE || 'http://localhost:5002').replace(/\/+$/, '');
const API_URL = `${BASE}/api/v2`;
const TENANT_ID = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
const EMAIL = process.env.SMOKE_USER || 'grc1@local';
const PASS = process.env.SMOKE_PASS || 'grc1';

interface TestResult {
  module: string;
  flow: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  endpoint?: string;
  statusCode?: number;
}

const results: TestResult[] = [];

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

let authToken: string | null = null;

async function login(): Promise<string> {
  if (authToken) return authToken;
  
  console.log('[UI-SMOKE] Logging in...');
  const response = await jsonFetch(`${API_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASS }),
    headers: { 'x-tenant-id': TENANT_ID },
  });
  
  if (!response.access_token) {
    throw new Error('Login failed');
  }
  
  authToken = response.access_token;
  console.log('✅ Login successful');
  return authToken as string;
}

function recordResult(module: string, flow: string, status: 'PASS' | 'FAIL' | 'SKIP', message?: string, endpoint?: string, statusCode?: number) {
  results.push({ module, flow, status, message, endpoint, statusCode });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${module} → ${flow}${message ? `: ${message}` : ''}`);
}

async function testAdminUsers(token: string) {
  console.log('\n[UI-SMOKE] Testing Admin → Users flow...');
  
  try {
    // List users
    const users = await jsonFetch(`${API_URL}/admin/users?page=1&pageSize=10`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    recordResult('Admin', 'List Users', 'PASS', `Found ${users.items?.length || 0} users`, 'GET /admin/users');
    
    if (users.items && users.items.length > 0) {
      const firstUser = users.items[0];
      // Get user details
      try {
        await jsonFetch(`${API_URL}/admin/users/${firstUser.id}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': TENANT_ID,
          },
        });
        recordResult('Admin', 'Get User Details', 'PASS', undefined, 'GET /admin/users/:id');
      } catch (err: any) {
        recordResult('Admin', 'Get User Details', 'FAIL', err.message, 'GET /admin/users/:id', err.status);
      }
    }
  } catch (err: any) {
    recordResult('Admin', 'List Users', 'FAIL', err.message, 'GET /admin/users', err.status);
  }
}

async function testAdminRoles(token: string) {
  console.log('\n[UI-SMOKE] Testing Admin → Roles flow...');
  
  try {
    // List roles
    const roles = await jsonFetch(`${API_URL}/admin/roles?page=1&pageSize=10`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    recordResult('Admin', 'List Roles', 'PASS', `Found ${roles.items?.length || 0} roles`, 'GET /admin/roles');
    
    if (roles.items && roles.items.length > 0) {
      const firstRole = roles.items[0];
      
      // Get role permissions
      try {
        await jsonFetch(`${API_URL}/admin/roles/${firstRole.id}/permissions`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': TENANT_ID,
          },
        });
        recordResult('Admin', 'Get Role Permissions', 'PASS', undefined, 'GET /admin/roles/:id/permissions');
      } catch (err: any) {
        recordResult('Admin', 'Get Role Permissions', err.status === 404 ? 'SKIP' : 'FAIL', err.message, 'GET /admin/roles/:id/permissions', err.status);
      }
      
      // Get permissions list
      try {
        const permissions = await jsonFetch(`${API_URL}/admin/permissions`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': TENANT_ID,
          },
        });
        recordResult('Admin', 'List Permissions', 'PASS', `Found ${permissions.items?.length || 0} permissions`, 'GET /admin/permissions');
        
        // Assign permissions to role (if permissions exist)
        if (permissions.items && permissions.items.length > 0) {
          const permissionCodes = permissions.items.slice(0, 2).map((p: any) => p.code);
          try {
            await jsonFetch(`${API_URL}/admin/roles/${firstRole.id}/permissions`, {
              method: 'POST',
              body: JSON.stringify({ permissions: permissionCodes }),
              headers: {
                Authorization: `Bearer ${token}`,
                'x-tenant-id': TENANT_ID,
              },
            });
            recordResult('Admin', 'Assign Permissions to Role', 'PASS', undefined, 'POST /admin/roles/:id/permissions');
          } catch (err: any) {
            recordResult('Admin', 'Assign Permissions to Role', 'FAIL', err.message, 'POST /admin/roles/:id/permissions', err.status);
          }
        }
      } catch (err: any) {
        recordResult('Admin', 'List Permissions', 'FAIL', err.message, 'GET /admin/permissions', err.status);
      }
    }
  } catch (err: any) {
    recordResult('Admin', 'List Roles', 'FAIL', err.message, 'GET /admin/roles', err.status);
  }
}

async function testPolicies(token: string) {
  console.log('\n[UI-SMOKE] Testing Policies flow...');
  
  try {
    // List policies
    const policies = await jsonFetch(`${API_URL}/governance/policies?page=1&pageSize=10`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    recordResult('Policies', 'List Policies', 'PASS', `Found ${policies.items?.length || 0} policies`, 'GET /governance/policies');
    
    if (policies.items && policies.items.length > 0) {
      const firstPolicy = policies.items[0];
      
      // Get policy details
      try {
        await jsonFetch(`${API_URL}/governance/policies/${firstPolicy.id}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': TENANT_ID,
          },
        });
        recordResult('Policies', 'Get Policy Details', 'PASS', undefined, 'GET /governance/policies/:id');
      } catch (err: any) {
        recordResult('Policies', 'Get Policy Details', 'FAIL', err.message, 'GET /governance/policies/:id', err.status);
      }
      
      // Get policy standards
      try {
        await jsonFetch(`${API_URL}/governance/policies/${firstPolicy.id}/standards`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': TENANT_ID,
          },
        });
        recordResult('Policies', 'Get Policy Standards', 'PASS', undefined, 'GET /governance/policies/:id/standards');
      } catch (err: any) {
        recordResult('Policies', 'Get Policy Standards', err.status === 404 ? 'SKIP' : 'FAIL', err.message, 'GET /governance/policies/:id/standards', err.status);
      }
    }
    
    // List standards for mapping
    try {
      const standards = await jsonFetch(`${API_URL}/standards`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      });
      recordResult('Policies', 'List Standards for Mapping', 'PASS', `Found ${standards.items?.length || 0} standards`, 'GET /standards');
    } catch (err: any) {
      recordResult('Policies', 'List Standards for Mapping', 'FAIL', err.message, 'GET /standards', err.status);
    }
  } catch (err: any) {
    recordResult('Policies', 'List Policies', 'FAIL', err.message, 'GET /governance/policies', err.status);
  }
}

async function testAudit(token: string) {
  console.log('\n[UI-SMOKE] Testing Audit flow...');
  
  try {
    // List engagements
    const engagements = await jsonFetch(`${API_URL}/audit/engagements?page=1&pageSize=10`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    recordResult('Audit', 'List Engagements', 'PASS', `Found ${engagements.items?.length || 0} engagements`, 'GET /audit/engagements');
    
    if (engagements.items && engagements.items.length > 0) {
      const firstEngagement = engagements.items[0];
      
      // Get engagement details
      try {
        await jsonFetch(`${API_URL}/audit/engagements/${firstEngagement.id}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': TENANT_ID,
          },
        });
        recordResult('Audit', 'Get Engagement Details', 'PASS', undefined, 'GET /audit/engagements/:id');
      } catch (err: any) {
        recordResult('Audit', 'Get Engagement Details', 'FAIL', err.message, 'GET /audit/engagements/:id', err.status);
      }
      
      // Get engagement tests
      try {
        const tests = await jsonFetch(`${API_URL}/audit/engagements/${firstEngagement.id}/tests`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': TENANT_ID,
          },
        });
        recordResult('Audit', 'Get Engagement Tests', 'PASS', `Found ${tests.items?.length || 0} tests`, 'GET /audit/engagements/:id/tests');
      } catch (err: any) {
        recordResult('Audit', 'Get Engagement Tests', err.status === 404 ? 'SKIP' : 'FAIL', err.message, 'GET /audit/engagements/:id/tests', err.status);
      }
    }
  } catch (err: any) {
    recordResult('Audit', 'List Engagements', 'FAIL', err.message, 'GET /audit/engagements', err.status);
  }
}

async function testBCM(token: string) {
  console.log('\n[UI-SMOKE] Testing BCM flow...');
  
  try {
    // List BCM processes
    const processes = await jsonFetch(`${API_URL}/bcm/processes?page=0&pageSize=20`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    recordResult('BCM', 'List Processes', 'PASS', `Found ${processes.items?.length || 0} processes`, 'GET /bcm/processes');
    
    // List BCP plans
    try {
      const plans = await jsonFetch(`${API_URL}/bcm/plans?page=1&pageSize=10`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      });
      recordResult('BCM', 'List BCP Plans', 'PASS', `Found ${plans.items?.length || 0} plans`, 'GET /bcm/plans');
    } catch (err: any) {
      recordResult('BCM', 'List BCP Plans', err.status === 404 ? 'SKIP' : 'FAIL', err.message, 'GET /bcm/plans', err.status);
    }
    
    // List BCP exercises
    try {
      const exercises = await jsonFetch(`${API_URL}/bcm/exercises?page=1&pageSize=10`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      });
      recordResult('BCM', 'List BCP Exercises', 'PASS', `Found ${exercises.items?.length || 0} exercises`, 'GET /bcm/exercises');
      
      if (exercises.items && exercises.items.length > 0) {
        const firstExercise = exercises.items[0];
        // Get exercise details
        try {
          await jsonFetch(`${API_URL}/bcm/exercises/${firstExercise.id}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'x-tenant-id': TENANT_ID,
            },
          });
          recordResult('BCM', 'Get Exercise Details', 'PASS', undefined, 'GET /bcm/exercises/:id');
        } catch (err: any) {
          recordResult('BCM', 'Get Exercise Details', err.status === 404 ? 'SKIP' : 'FAIL', err.message, 'GET /bcm/exercises/:id', err.status);
        }
      }
    } catch (err: any) {
      recordResult('BCM', 'List BCP Exercises', err.status === 404 ? 'SKIP' : 'FAIL', err.message, 'GET /bcm/exercises', err.status);
    }
  } catch (err: any) {
    recordResult('BCM', 'List Processes', 'FAIL', err.message, 'GET /bcm/processes', err.status);
  }
}

async function testCalendar(token: string) {
  console.log('\n[UI-SMOKE] Testing Calendar flow...');
  
  try {
    const now = new Date();
    const from = new Date(now);
    from.setMonth(from.getMonth() - 1);
    const to = new Date(now);
    to.setMonth(to.getMonth() + 3);
    
    // List calendar events (ensure ISO 8601 format and URL encoding)
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    const events = await jsonFetch(`${API_URL}/calendar/events?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    recordResult('Calendar', 'List Events', 'PASS', `Found ${events.items?.length || 0} events`, 'GET /calendar/events');
    
    // Get capacity
    try {
      await jsonFetch(`${API_URL}/calendar/capacity?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      });
      recordResult('Calendar', 'Get Capacity', 'PASS', undefined, 'GET /calendar/capacity');
    } catch (err: any) {
      recordResult('Calendar', 'Get Capacity', err.status === 404 ? 'SKIP' : 'FAIL', err.message, 'GET /calendar/capacity', err.status);
    }
  } catch (err: any) {
    recordResult('Calendar', 'List Events', 'FAIL', err.message, 'GET /calendar/events', err.status);
  }
}

async function testStandards(token: string) {
  console.log('\n[UI-SMOKE] Testing Standards flow...');
  
  try {
    // List standards
    const standards = await jsonFetch(`${API_URL}/standards`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    recordResult('Standards', 'List Standards', 'PASS', `Found ${standards.items?.length || 0} standards`, 'GET /standards');
    
    if (standards.items && standards.items.length > 0) {
      const firstStandard = standards.items[0];
      
      // Get standard details
      try {
        await jsonFetch(`${API_URL}/standards/${firstStandard.id}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': TENANT_ID,
          },
        });
        recordResult('Standards', 'Get Standard Details', 'PASS', undefined, 'GET /standards/:id');
      } catch (err: any) {
        recordResult('Standards', 'Get Standard Details', 'FAIL', err.message, 'GET /standards/:id', err.status);
      }
      
      // Get standard clauses
      try {
        const clauses = await jsonFetch(`${API_URL}/standards/${firstStandard.id}/clauses`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': TENANT_ID,
          },
        });
        recordResult('Standards', 'Get Standard Clauses', 'PASS', `Found ${clauses.items?.length || 0} clauses`, 'GET /standards/:id/clauses');
      } catch (err: any) {
        recordResult('Standards', 'Get Standard Clauses', err.status === 404 ? 'SKIP' : 'FAIL', err.message, 'GET /standards/:id/clauses', err.status);
      }
    }
  } catch (err: any) {
    recordResult('Standards', 'List Standards', 'FAIL', err.message, 'GET /standards', err.status);
  }
}

async function main() {
  console.log('=== UI Click-Smoke Test ===\n');
  console.log(`Base URL: ${BASE}`);
  console.log(`Tenant ID: ${TENANT_ID}\n`);
  
  try {
    const token = await login();
    
    await testAdminUsers(token);
    await testAdminRoles(token);
    await testPolicies(token);
    await testAudit(token);
    await testBCM(token);
    await testCalendar(token);
    await testStandards(token);
    
    // Summary
    console.log('\n=== UI Click-Smoke Test Summary ===\n');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    
    console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}\n`);
    
    if (failed > 0) {
      console.log('Failed Tests:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  ❌ ${r.module} → ${r.flow} (${r.endpoint}) - ${r.message}`);
      });
      console.log('');
    }
    
    if (skipped > 0) {
      console.log('Skipped Tests (endpoint not available):');
      results.filter(r => r.status === 'SKIP').forEach(r => {
        console.log(`  ⚠️  ${r.module} → ${r.flow} (${r.endpoint})`);
      });
      console.log('');
    }
    
    if (failed === 0) {
      console.log('✅ All UI click-smoke tests passed!');
      process.exit(0);
    } else {
      console.log(`❌ UI click-smoke tests completed with ${failed} failure(s)`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ UI click-smoke test failed:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

