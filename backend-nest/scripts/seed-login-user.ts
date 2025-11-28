#!/usr/bin/env ts-node
/**
 * Seed Login User - Creates grc1@local user for smoke tests
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import AppDataSource from '../src/data-source';
import { UserEntity } from '../src/entities/auth/user.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';
import { RoleEntity } from '../src/entities/auth/role.entity';
import { randomUUID } from 'crypto';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID;
if (!DEFAULT_TENANT_ID) {
  console.error('❌ DEFAULT_TENANT_ID not set in environment');
  console.error('   Please set DEFAULT_TENANT_ID in .env file');
  process.exit(1);
}

const email = 'grc1@local';
const password = 'grc1';
const displayName = 'GRC Test User';

async function seedLoginUser() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const tenantRepo = AppDataSource.getRepository(TenantEntity);
    const userRepo = AppDataSource.getRepository(UserEntity);
    const roleRepo = AppDataSource.getRepository(RoleEntity);

    // Find or create tenant
    let tenant = await tenantRepo.findOne({ where: { id: DEFAULT_TENANT_ID } });
    if (!tenant) {
      console.log(`⚠️  Tenant ${DEFAULT_TENANT_ID} not found, creating...`);
      tenant = tenantRepo.create({
        id: DEFAULT_TENANT_ID,
        name: 'Default Tenant',
        slug: 'default',
        is_active: true,
      });
      tenant = await tenantRepo.save(tenant);
      console.log(`✅ Created tenant: ${tenant.id}`);
    }

    // Find or create ADMIN role
    let adminRole = await roleRepo.findOne({
      where: { tenant_id: tenant.id, name: 'ADMIN' },
    });
    if (!adminRole) {
      console.log('⚠️  ADMIN role not found, creating...');
      adminRole = roleRepo.create({
        id: randomUUID(),
        tenant_id: tenant.id,
        name: 'ADMIN',
        is_system: false,
      });
      adminRole = await roleRepo.save(adminRole);
      console.log(`✅ Created ADMIN role: ${adminRole.id}`);
    }

    // Check if user exists
    let user = await userRepo.findOne({
      where: { email, tenant_id: tenant.id },
    });

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    if (user) {
      // Update existing user
      user.password_hash = passwordHash;
      user.display_name = displayName;
      user.is_active = true;
      user.is_email_verified = true;
      user = await userRepo.save(user);
      console.log(`✅ Updated user: ${email} (${user.id.substring(0, 8)}...)`);
    } else {
      // Create new user
      user = userRepo.create({
        id: randomUUID(),
        tenant_id: tenant.id,
        email,
        password_hash: passwordHash,
        display_name: displayName,
        is_active: true,
        is_email_verified: true,
      });
      user = await userRepo.save(user);
      console.log(`✅ Created user: ${email} (${user.id.substring(0, 8)}...)`);
    }

    // Link user to ADMIN role
    await AppDataSource.query(
      `INSERT INTO auth.user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [user.id, adminRole.id],
    );

    console.log(`✅ User ${email} linked to ADMIN role`);

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    console.log('✅ Seed login user completed');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seed login user failed:', error.message);
    if (AppDataSource.isInitialized) {
      try {
        await AppDataSource.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    process.exit(1);
  }
}

seedLoginUser().catch((err) => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});

