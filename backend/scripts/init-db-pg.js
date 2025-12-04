#!/usr/bin/env node

/**
 * PostgreSQL Database Initialization Script
 * 
 * Creates all necessary tables for the GRC Platform
 * Run with: npm run db:init:pg
 * 
 * Prerequisites:
 * - PostgreSQL server running
 * - Database created (e.g., CREATE DATABASE grc_platform;)
 * - Environment variables set in .env
 */

require('dotenv').config();

const { Pool } = require('pg');

// PostgreSQL configuration from environment
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'grc_platform'
};

const schema = `
-- =============================================================================
-- GRC Platform PostgreSQL Schema
-- =============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  department VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Policies table
CREATE TABLE IF NOT EXISTS policies (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(255),
  version VARCHAR(50) DEFAULT '1.0',
  status VARCHAR(50) DEFAULT 'draft',
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  effective_date DATE,
  review_date DATE,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_policies_owner ON policies(owner_id);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_category ON policies(category);

-- Risks table
CREATE TABLE IF NOT EXISTS risks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(255),
  severity VARCHAR(50),
  likelihood VARCHAR(50),
  impact VARCHAR(50),
  risk_score INTEGER,
  status VARCHAR(50) DEFAULT 'open',
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  mitigation_plan TEXT,
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risks_owner ON risks(owner_id);
CREATE INDEX IF NOT EXISTS idx_risks_assigned ON risks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status);
CREATE INDEX IF NOT EXISTS idx_risks_category ON risks(category);
CREATE INDEX IF NOT EXISTS idx_risks_score ON risks(risk_score);

-- Compliance requirements table
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  regulation VARCHAR(255),
  category VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  due_date DATE,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  evidence TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_owner ON compliance_requirements(owner_id);
CREATE INDEX IF NOT EXISTS idx_compliance_assigned ON compliance_requirements(assigned_to);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_requirements(status);
CREATE INDEX IF NOT EXISTS idx_compliance_regulation ON compliance_requirements(regulation);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(255),
  entity_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(255),
  parent_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_id);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);

-- Risk assessments table
CREATE TABLE IF NOT EXISTS risk_assessments (
  id SERIAL PRIMARY KEY,
  risk_id INTEGER REFERENCES risks(id) ON DELETE CASCADE,
  assessor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assessment_date DATE,
  likelihood_score INTEGER,
  impact_score INTEGER,
  overall_score INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_risk ON risk_assessments(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_assessor ON risk_assessments(assessor_id);

-- =============================================================================
-- Update timestamp trigger function
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at column
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
    AND table_schema = 'public'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END;
$$ language 'plpgsql';
`;

async function initDatabase() {
  console.log('='.repeat(60));
  console.log('GRC Platform - PostgreSQL Database Initialization');
  console.log('='.repeat(60));
  console.log(`Host: ${pgConfig.host}:${pgConfig.port}`);
  console.log(`Database: ${pgConfig.database}`);
  console.log(`User: ${pgConfig.user}`);
  console.log('='.repeat(60));
  
  const pool = new Pool(pgConfig);
  
  try {
    // Test connection
    console.log('\nTesting database connection...');
    const client = await pool.connect();
    await client.query('SELECT 1');
    console.log('Connection successful!\n');
    
    // Execute schema
    console.log('Creating tables and indexes...');
    await client.query(schema);
    console.log('Schema created successfully!\n');
    
    // Verify tables
    console.log('Verifying tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Count indexes
    const indexResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `);
    console.log(`\nIndexes created: ${indexResult.rows[0].count}`);
    
    client.release();
    
    console.log('\n' + '='.repeat(60));
    console.log('Database initialization completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\nFATAL: Database initialization failed!');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nPlease ensure PostgreSQL is running and accessible.');
      console.error('You may need to:');
      console.error('  1. Start PostgreSQL service');
      console.error('  2. Create the database: CREATE DATABASE grc_platform;');
      console.error('  3. Check your .env configuration');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase, schema };
