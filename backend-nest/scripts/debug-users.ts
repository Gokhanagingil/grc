/**
 * Debug script to inspect users in the database.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/debug-users.ts
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from '../src/entities/auth/user.entity';
import { dbConfigFactory } from '../src/config/database.config';
import { config } from 'dotenv';

config({ path: process.env.ENV_FILE || '.env' });

async function main() {
  console.log('=== Debug Users Script ===\n');

  // Create DataSource
  const dbConfig = dbConfigFactory();
  const dataSource = new DataSource(dbConfig as any);

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established\n');

    const userRepo = dataSource.getRepository(UserEntity);

    // Get all users (full entity to check password_hash)
    const allUsers = await userRepo.find({
      order: { created_at: 'DESC' },
    });

    console.log(`Total users in database: ${allUsers.length}\n`);

    if (allUsers.length === 0) {
      console.log('⚠️  No users found in database!\n');
      console.log('Expected user for smoke test:');
      console.log('  Email: grc1@local');
      console.log('  Tenant ID: 217492b2-f814-4ba0-ae50-4e4f8ecf6216');
      console.log('  Password: grc1\n');
      console.log('Run: npm run seed:dev-users\n');
      await dataSource.destroy();
      process.exit(1);
    }

    // List all users
    console.log('All users:');
    console.log('─'.repeat(100));
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Tenant ID: ${user.tenant_id}`);
      console.log(`   Display Name: ${user.display_name || '(empty)'}`);
      console.log(`   Password Hash: ${user.password_hash ? `✅ present (${user.password_hash.length} chars)` : '❌ MISSING'}`);
      console.log(`   Is Active: ${user.is_active}`);
      console.log(`   Is Email Verified: ${user.is_email_verified}`);
      console.log(`   MFA Enabled: ${user.mfa_enabled}`);
      console.log(`   Failed Attempts: ${user.failed_attempts || 0}`);
      if (user.locked_until) {
        const now = new Date();
        if (user.locked_until > now) {
          console.log(`   ⚠️  Locked Until: ${user.locked_until.toISOString()} (LOCKED)`);
        } else {
          console.log(`   Locked Until: ${user.locked_until.toISOString()} (expired)`);
        }
      } else {
        console.log(`   Locked Until: null (unlocked)`);
      }
      console.log('');
    });

    // Check for expected user
    const expectedEmail = 'grc1@local';
    const expectedTenantId = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

    console.log('Checking for expected smoke test user:');
    console.log(`  Email: ${expectedEmail}`);
    console.log(`  Tenant ID: ${expectedTenantId}\n`);

    const matchingUser = allUsers.find(
      (u) => u.email.toLowerCase() === expectedEmail.toLowerCase() && u.tenant_id === expectedTenantId,
    );

    if (matchingUser) {
      console.log('✅ Expected user found!');
      console.log(`   ID: ${matchingUser.id}`);
      console.log(`   Email: ${matchingUser.email}`);
      console.log(`   Tenant ID: ${matchingUser.tenant_id}`);
      console.log(`   Display Name: ${matchingUser.display_name || '(empty)'}`);
      console.log(`   MFA Enabled: ${matchingUser.mfa_enabled}`);
      console.log(`   Active: ${matchingUser.is_active}`);
      console.log(`   Failed Attempts: ${matchingUser.failed_attempts || 0}`);
      if (matchingUser.locked_until) {
        const now = new Date();
        if (matchingUser.locked_until > now) {
          console.log(`   ⚠️  Account is LOCKED until: ${matchingUser.locked_until.toISOString()}`);
        } else {
          console.log(`   Locked Until (expired): ${matchingUser.locked_until.toISOString()}`);
        }
      }
      console.log('');

      // Check password hash (already loaded)
      if (matchingUser.password_hash) {
        console.log('   Password hash: ✅ present');
        console.log(`   Hash length: ${matchingUser.password_hash.length} characters`);
      } else {
        console.log('   ⚠️  Password hash missing or empty!');
      }
      
      // Check email verification
      console.log(`   Is Email Verified: ${matchingUser.is_email_verified}`);
    } else {
      console.log('❌ Expected user NOT found!\n');

      // Check for email match (different tenant)
      const emailMatch = allUsers.find((u) => u.email.toLowerCase() === expectedEmail.toLowerCase());
      if (emailMatch) {
        console.log(`⚠️  User with email "${expectedEmail}" found but with different tenant:`);
        console.log(`   Found tenant ID: ${emailMatch.tenant_id}`);
        console.log(`   Expected tenant ID: ${expectedTenantId}`);
        console.log('\n   Solution: Update user tenant_id or create new user with correct tenant_id\n');
      } else {
        console.log(`⚠️  No user found with email "${expectedEmail}"\n`);
        console.log('   Solution: Run seed script to create user:\n');
        console.log('   npm run seed:dev-users\n');
      }
    }

    await dataSource.destroy();
    console.log('\n✅ Script completed');
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
