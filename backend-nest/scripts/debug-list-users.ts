#!/usr/bin/env ts-node
/**
 * Debug Script: List Users
 * 
 * Lists all users in the database with their key fields.
 * 
 * Usage: npm run debug:list-users
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { dbConfigFactory } from '../src/config/database.config';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

async function listUsers() {
  console.log('=== Debug: List Users ===\n');

  const dbConfig = dbConfigFactory();
  const dataSource = new DataSource(dbConfig as any);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    // List tenants
    const tenants = await dataSource.query(`
      SELECT id, name, slug, is_active
      FROM tenants
      ORDER BY name
    `);
    console.log(`📋 Tenants (${tenants.length}):`);
    tenants.forEach((t: any) => {
      console.log(`   - ${t.id}`);
      console.log(`     Name: ${t.name}, Slug: ${t.slug}, Active: ${t.is_active}`);
    });
    console.log('');

    // List users
    const users = await dataSource.query(`
      SELECT id, email, tenant_id, display_name, is_active, is_email_verified, 
             failed_attempts, locked_until, roles
      FROM users
      ORDER BY email
    `);
    console.log(`👥 Users (${users.length}):`);
    users.forEach((u: any) => {
      console.log(`   - ${u.email}`);
      console.log(`     ID: ${u.id}`);
      console.log(`     Tenant ID: ${u.tenant_id}`);
      console.log(`     Display Name: ${u.display_name || '(none)'}`);
      console.log(`     Active: ${u.is_active}, Email Verified: ${u.is_email_verified}`);
      console.log(`     Failed Attempts: ${u.failed_attempts || 0}`);
      console.log(`     Locked Until: ${u.locked_until || '(none)'}`);
      console.log(`     Roles: ${JSON.stringify(u.roles || [])}`);
      console.log('');
    });

    // Check for specific demo users
    const demoTenantId = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
    const demoUsers = await dataSource.query(`
      SELECT email, tenant_id, is_active, is_email_verified
      FROM users
      WHERE tenant_id = ? AND email IN (?, ?)
    `, [demoTenantId, 'grc1@local', 'grc2@local']);
    
    console.log(`🔍 Demo Users Check (Tenant: ${demoTenantId}):`);
    if (demoUsers.length === 0) {
      console.log('   ❌ No demo users found!');
    } else {
      demoUsers.forEach((u: any) => {
        console.log(`   ✅ ${u.email} - Active: ${u.is_active}, Verified: ${u.is_email_verified}`);
      });
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
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

listUsers().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

