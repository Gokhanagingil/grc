#!/usr/bin/env ts-node
/**
 * Test Login Script
 * 
 * Tests the login endpoint with demo credentials.
 * 
 * Usage: npm run test:login
 */

import 'reflect-metadata';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

async function testLogin() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:5002';
  const tenantId = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
  const email = 'grc1@local';
  const password = 'grc1';

  console.log('=== Test Login ===\n');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Email: ${email}`);
  console.log('');

  try {
    const response = await fetch(`${baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const status = response.status;
    const body = await response.json();

    console.log(`Status: ${status}`);
    console.log('Response:');
    console.log(JSON.stringify(body, null, 2));

    if (status === 200 && body.access_token) {
      console.log('\n✅ Login successful!');
      console.log(`   Access Token: ${body.access_token.substring(0, 50)}...`);
      if (body.user) {
        console.log(`   User: ${body.user.email} (${body.user.displayName})`);
        console.log(`   Roles: ${JSON.stringify(body.user.roles)}`);
      }
      process.exit(0);
    } else {
      console.log('\n❌ Login failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      if (error.stack) {
        console.error('   Stack:', error.stack);
      }
    }
    process.exit(1);
  }
}

testLogin();

