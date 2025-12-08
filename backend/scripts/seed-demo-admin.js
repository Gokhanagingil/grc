#!/usr/bin/env node

/**
 * Demo Admin User Seed Script
 * 
 * Creates a stable demo admin user for manual testing in dev/staging environments.
 * This script is idempotent - running it multiple times will not create duplicates.
 * 
 * Demo Admin Credentials:
 * - Email: demo.admin@grc.local
 * - Password: Set via DEMO_ADMIN_PASSWORD env var (see docs/DEMO-ADMIN-USER.md)
 * - Role: admin
 * 
 * Usage:
 *   DEMO_ADMIN_PASSWORD=YourPassword npm run seed:demo-admin
 *   node scripts/seed-demo-admin.js
 * 
 * Environment Variables:
 *   DEMO_ADMIN_PASSWORD - Required password for the demo admin user
 *   SEED_DEMO_ADMIN     - Set to 'true' to allow seeding in production
 *   NODE_ENV            - By default, will NOT run in production
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const mainDb = require('../db');

function getDemoAdminConfig() {
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!password) {
    throw new Error('DEMO_ADMIN_PASSWORD environment variable is required. See docs/DEMO-ADMIN-USER.md for setup instructions.');
  }
  
  return {
    username: 'demo.admin',
    email: 'demo.admin@grc.local',
    password: password,
    firstName: 'Demo',
    lastName: 'Admin',
    department: 'Administration',
    role: 'admin'
  };
}

async function seedDemoAdmin() {
  console.log('='.repeat(60));
  console.log('GRC Platform - Demo Admin User Seeding');
  console.log('='.repeat(60));
  
  // Check environment
  const isProduction = process.env.NODE_ENV === 'production';
  const forceInProduction = process.env.SEED_DEMO_ADMIN === 'true';
  
  if (isProduction && !forceInProduction) {
    console.log('\nSkipping demo admin seeding in production environment.');
    console.log('To force seeding in production, set SEED_DEMO_ADMIN=true');
    console.log('='.repeat(60));
    return { skipped: true, reason: 'production' };
  }
  
  // Get demo admin configuration (validates DEMO_ADMIN_PASSWORD is set)
  const DEMO_ADMIN = getDemoAdminConfig();
  
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Demo Admin Email: ${DEMO_ADMIN.email}`);
  console.log('='.repeat(60));
  
  try {
    // Initialize database connection
    await mainDb.init();
    console.log('\nDatabase connection established.');
    
    // Check if demo admin already exists
    const existingUser = await mainDb.get(
      'SELECT id, email, role FROM users WHERE email = $1',
      [DEMO_ADMIN.email]
    );
    
    if (existingUser) {
      console.log(`\nDemo admin user already exists (ID: ${existingUser.id})`);
      
      // Ensure the user has admin role
      if (existingUser.role !== 'admin') {
        console.log(`Updating role from '${existingUser.role}' to 'admin'...`);
        await mainDb.run(
          'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['admin', existingUser.id]
        );
        console.log('Role updated successfully.');
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('Demo admin user is ready for use.');
      console.log('='.repeat(60));
      return { created: false, updated: existingUser.role !== 'admin', userId: existingUser.id };
    }
    
    // Hash password
    console.log('\nCreating demo admin user...');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(DEMO_ADMIN.password, saltRounds);
    
    // Insert demo admin user
    const result = await mainDb.run(
      `INSERT INTO users (username, email, password, first_name, last_name, department, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        DEMO_ADMIN.username,
        DEMO_ADMIN.email,
        hashedPassword,
        DEMO_ADMIN.firstName,
        DEMO_ADMIN.lastName,
        DEMO_ADMIN.department,
        DEMO_ADMIN.role,
        true
      ]
    );
    
    const userId = result.rows?.[0]?.id || result.lastID;
    console.log(`Demo admin user created successfully (ID: ${userId})`);
    
    console.log('\n' + '='.repeat(60));
    console.log('Demo Admin User Created Successfully!');
    console.log('='.repeat(60));
    console.log(`Email: ${DEMO_ADMIN.email}`);
    console.log(`Password: ${DEMO_ADMIN.password}`);
    console.log(`Role: ${DEMO_ADMIN.role}`);
    console.log('='.repeat(60));
    
    return { created: true, userId };
    
  } catch (error) {
    console.error('\nFATAL: Demo admin seeding failed!');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nPlease ensure the database is running and accessible.');
    }
    
    throw error;
  } finally {
    // Close database connection
    try {
      await mainDb.close();
    } catch (e) {
      // Ignore close errors
    }
  }
}

// Run if called directly
if (require.main === module) {
  seedDemoAdmin()
    .then((result) => {
      if (result.skipped) {
        process.exit(0);
      }
      console.log('\nSeeding completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nSeeding failed:', error.message);
      process.exit(1);
    });
}

module.exports = { seedDemoAdmin, getDemoAdminConfig };
