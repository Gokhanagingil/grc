/**
 * Platform Core Phase 7 Migration Script
 * 
 * Standards Library + Metadata Engine + Requirement Mapping:
 * - Extends compliance_requirements table with standards fields
 * - Creates metadata_types, metadata_values, object_metadata tables
 * - Creates policy_requirements, risk_requirements mapping tables
 * - Extends finding_requirements with evidence_strength
 * - Creates audit_criteria table if not exists
 * 
 * Also seeds:
 * - Default metadata types (domain, classification, priority)
 * - Default metadata values
 * - ACL rules for metadata and mapping operations
 * - Permissions for standards and metadata management
 */

const db = require('../db');

// =============================================================================
// SQLite Schema
// =============================================================================

const SQLITE_SCHEMA = `
  -- Metadata Types table
  CREATE TABLE IF NOT EXISTS metadata_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_metadata_types_name ON metadata_types(name);

  -- Metadata Values table
  CREATE TABLE IF NOT EXISTS metadata_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_id INTEGER NOT NULL,
    value TEXT NOT NULL,
    color TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_id) REFERENCES metadata_types (id) ON DELETE CASCADE,
    UNIQUE (type_id, value)
  );

  CREATE INDEX IF NOT EXISTS idx_metadata_values_type ON metadata_values(type_id);

  -- Object Metadata table (many-to-many relationship)
  CREATE TABLE IF NOT EXISTS object_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_type TEXT NOT NULL CHECK (object_type IN ('requirement', 'policy', 'risk', 'finding', 'evidence', 'service', 'audit')),
    object_id INTEGER NOT NULL,
    metadata_value_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (metadata_value_id) REFERENCES metadata_values (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (object_type, object_id, metadata_value_id)
  );

  CREATE INDEX IF NOT EXISTS idx_object_metadata_object ON object_metadata(object_type, object_id);
  CREATE INDEX IF NOT EXISTS idx_object_metadata_value ON object_metadata(metadata_value_id);

  -- Policy Requirements mapping table
  CREATE TABLE IF NOT EXISTS policy_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_id INTEGER NOT NULL,
    requirement_id INTEGER NOT NULL,
    justification TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (policy_id) REFERENCES policies (id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES compliance_requirements (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (policy_id, requirement_id)
  );

  CREATE INDEX IF NOT EXISTS idx_policy_requirements_policy ON policy_requirements(policy_id);
  CREATE INDEX IF NOT EXISTS idx_policy_requirements_requirement ON policy_requirements(requirement_id);

  -- Risk Requirements mapping table
  CREATE TABLE IF NOT EXISTS risk_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risk_id INTEGER NOT NULL,
    requirement_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (risk_id) REFERENCES risks (id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES compliance_requirements (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (risk_id, requirement_id)
  );

  CREATE INDEX IF NOT EXISTS idx_risk_requirements_risk ON risk_requirements(risk_id);
  CREATE INDEX IF NOT EXISTS idx_risk_requirements_requirement ON risk_requirements(requirement_id);

  -- Audit Criteria table (if not exists from Phase 4)
  CREATE TABLE IF NOT EXISTS audit_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    requirement_id INTEGER NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (audit_id) REFERENCES audits (id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES compliance_requirements (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (audit_id, requirement_id)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_criteria_audit ON audit_criteria(audit_id);
  CREATE INDEX IF NOT EXISTS idx_audit_criteria_requirement ON audit_criteria(requirement_id);
`;

// =============================================================================
// PostgreSQL Schema
// =============================================================================

const PG_SCHEMA = `
  -- Metadata Types table
  CREATE TABLE IF NOT EXISTS metadata_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_metadata_types_name ON metadata_types(name);

  -- Metadata Values table
  CREATE TABLE IF NOT EXISTS metadata_values (
    id SERIAL PRIMARY KEY,
    type_id INTEGER NOT NULL REFERENCES metadata_types(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    color VARCHAR(7),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (type_id, value)
  );

  CREATE INDEX IF NOT EXISTS idx_metadata_values_type ON metadata_values(type_id);

  -- Object Metadata table (many-to-many relationship)
  CREATE TABLE IF NOT EXISTS object_metadata (
    id SERIAL PRIMARY KEY,
    object_type VARCHAR(20) NOT NULL CHECK (object_type IN ('requirement', 'policy', 'risk', 'finding', 'evidence', 'service', 'audit')),
    object_id INTEGER NOT NULL,
    metadata_value_id INTEGER NOT NULL REFERENCES metadata_values(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (object_type, object_id, metadata_value_id)
  );

  CREATE INDEX IF NOT EXISTS idx_object_metadata_object ON object_metadata(object_type, object_id);
  CREATE INDEX IF NOT EXISTS idx_object_metadata_value ON object_metadata(metadata_value_id);

  -- Policy Requirements mapping table
  CREATE TABLE IF NOT EXISTS policy_requirements (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    requirement_id INTEGER NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
    justification TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (policy_id, requirement_id)
  );

  CREATE INDEX IF NOT EXISTS idx_policy_requirements_policy ON policy_requirements(policy_id);
  CREATE INDEX IF NOT EXISTS idx_policy_requirements_requirement ON policy_requirements(requirement_id);

  -- Risk Requirements mapping table
  CREATE TABLE IF NOT EXISTS risk_requirements (
    id SERIAL PRIMARY KEY,
    risk_id INTEGER NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
    requirement_id INTEGER NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (risk_id, requirement_id)
  );

  CREATE INDEX IF NOT EXISTS idx_risk_requirements_risk ON risk_requirements(risk_id);
  CREATE INDEX IF NOT EXISTS idx_risk_requirements_requirement ON risk_requirements(requirement_id);

  -- Audit Criteria table (if not exists from Phase 4)
  CREATE TABLE IF NOT EXISTS audit_criteria (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    requirement_id INTEGER NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (audit_id, requirement_id)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_criteria_audit ON audit_criteria(audit_id);
  CREATE INDEX IF NOT EXISTS idx_audit_criteria_requirement ON audit_criteria(requirement_id);
`;

// =============================================================================
// Compliance Requirements Table Extensions (ALTER TABLE statements)
// =============================================================================

const SQLITE_REQUIREMENTS_EXTENSIONS = [
  { column: 'family', sql: "ALTER TABLE compliance_requirements ADD COLUMN family TEXT CHECK (family IN ('iso27001', 'iso27002', 'iso20000', 'iso9001', 'cobit2019', 'nistcsf', 'kvkk', 'gdpr'))" },
  { column: 'code', sql: 'ALTER TABLE compliance_requirements ADD COLUMN code TEXT' },
  { column: 'version', sql: 'ALTER TABLE compliance_requirements ADD COLUMN version TEXT' },
  { column: 'hierarchy_level', sql: "ALTER TABLE compliance_requirements ADD COLUMN hierarchy_level TEXT CHECK (hierarchy_level IN ('clause', 'control', 'subcontrol'))" },
  { column: 'domain', sql: 'ALTER TABLE compliance_requirements ADD COLUMN domain TEXT' },
  { column: 'description_long', sql: 'ALTER TABLE compliance_requirements ADD COLUMN description_long TEXT' }
];

const PG_REQUIREMENTS_EXTENSIONS = [
  { column: 'family', sql: "ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS family VARCHAR(20) CHECK (family IN ('iso27001', 'iso27002', 'iso20000', 'iso9001', 'cobit2019', 'nistcsf', 'kvkk', 'gdpr'))" },
  { column: 'code', sql: 'ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS code VARCHAR(50)' },
  { column: 'version', sql: 'ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS version VARCHAR(20)' },
  { column: 'hierarchy_level', sql: "ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS hierarchy_level VARCHAR(20) CHECK (hierarchy_level IN ('clause', 'control', 'subcontrol'))" },
  { column: 'domain', sql: 'ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS domain VARCHAR(50)' },
  { column: 'description_long', sql: 'ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS description_long TEXT' }
];

// =============================================================================
// Finding Requirements Table Extensions (evidence_strength)
// =============================================================================

const SQLITE_FINDING_REQUIREMENTS_EXTENSIONS = [
  { column: 'evidence_strength', sql: "ALTER TABLE finding_requirements ADD COLUMN evidence_strength TEXT CHECK (evidence_strength IN ('strong', 'medium', 'weak'))" }
];

const PG_FINDING_REQUIREMENTS_EXTENSIONS = [
  { column: 'evidence_strength', sql: "ALTER TABLE finding_requirements ADD COLUMN IF NOT EXISTS evidence_strength VARCHAR(10) CHECK (evidence_strength IN ('strong', 'medium', 'weak'))" }
];

// =============================================================================
// Permissions
// =============================================================================

const PHASE7_PERMISSIONS = [
  // Standards Library permissions
  { key: 'standards.read', name: 'View Standards Library', description: 'View standards and requirements', module: 'compliance' },
  { key: 'standards.import', name: 'Import Standards', description: 'Import standards from JSON files', module: 'compliance' },
  // Metadata permissions
  { key: 'metadata.types.manage', name: 'Manage Metadata Types', description: 'Create and manage metadata types', module: 'platform' },
  { key: 'metadata.values.manage', name: 'Manage Metadata Values', description: 'Create and manage metadata values', module: 'platform' },
  { key: 'metadata.assign', name: 'Assign Metadata', description: 'Assign metadata to objects', module: 'platform' },
  // Mapping permissions
  { key: 'requirements.map.policy', name: 'Map Requirements to Policies', description: 'Link requirements to policies', module: 'compliance' },
  { key: 'requirements.map.risk', name: 'Map Requirements to Risks', description: 'Link requirements to risks', module: 'compliance' },
  { key: 'requirements.map.finding', name: 'Map Requirements to Findings', description: 'Link requirements to findings', module: 'audit' },
  { key: 'requirements.map.audit', name: 'Map Requirements to Audits', description: 'Link requirements to audits', module: 'audit' }
];

const PHASE7_ROLE_PERMISSIONS = {
  admin: [
    'standards.read', 'standards.import',
    'metadata.types.manage', 'metadata.values.manage', 'metadata.assign',
    'requirements.map.policy', 'requirements.map.risk', 'requirements.map.finding', 'requirements.map.audit'
  ],
  manager: [
    'standards.read',
    'metadata.assign',
    'requirements.map.policy', 'requirements.map.risk', 'requirements.map.finding', 'requirements.map.audit'
  ],
  user: [
    'standards.read'
  ]
};

// =============================================================================
// ACL Rules
// =============================================================================

const PHASE7_ACL_RULES = [
  // Metadata types ACL
  {
    name: 'Admins can manage metadata types',
    table_name: 'metadata_types',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin'] }),
    fields: null,
    actions: 'read,write,delete',
    priority: 10
  },
  {
    name: 'All users can view metadata types',
    table_name: 'metadata_types',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager', 'user'] }),
    fields: null,
    actions: 'read',
    priority: 5
  },
  // Metadata values ACL
  {
    name: 'Admins can manage metadata values',
    table_name: 'metadata_values',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin'] }),
    fields: null,
    actions: 'read,write,delete',
    priority: 10
  },
  {
    name: 'All users can view metadata values',
    table_name: 'metadata_values',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager', 'user'] }),
    fields: null,
    actions: 'read',
    priority: 5
  },
  // Object metadata ACL
  {
    name: 'Managers can assign metadata',
    table_name: 'object_metadata',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager'] }),
    fields: null,
    actions: 'read,write,delete',
    priority: 10
  },
  {
    name: 'Users can view object metadata',
    table_name: 'object_metadata',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager', 'user'] }),
    fields: null,
    actions: 'read',
    priority: 5
  },
  // Policy requirements mapping ACL
  {
    name: 'Managers can map policies to requirements',
    table_name: 'policy_requirements',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager'] }),
    fields: null,
    actions: 'read,write,delete',
    priority: 10
  },
  // Risk requirements mapping ACL
  {
    name: 'Managers can map risks to requirements',
    table_name: 'risk_requirements',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager'] }),
    fields: null,
    actions: 'read,write,delete',
    priority: 10
  }
];

// =============================================================================
// Default Metadata Types and Values
// =============================================================================

const DEFAULT_METADATA_TYPES = [
  { name: 'domain', description: 'Domain classification for requirements and controls' },
  { name: 'priority', description: 'Priority level for implementation' },
  { name: 'classification', description: 'Data classification level' },
  { name: 'status_tag', description: 'Custom status tags for tracking' }
];

const DEFAULT_METADATA_VALUES = [
  // Domain values
  { type: 'domain', value: 'security', color: '#e53935', description: 'Information security domain' },
  { type: 'domain', value: 'privacy', color: '#8e24aa', description: 'Data privacy domain' },
  { type: 'domain', value: 'itservice', color: '#1e88e5', description: 'IT service management domain' },
  { type: 'domain', value: 'quality', color: '#43a047', description: 'Quality management domain' },
  { type: 'domain', value: 'governance', color: '#fb8c00', description: 'Corporate governance domain' },
  // Priority values
  { type: 'priority', value: 'critical', color: '#d32f2f', description: 'Critical priority - immediate action required' },
  { type: 'priority', value: 'high', color: '#f57c00', description: 'High priority - action required soon' },
  { type: 'priority', value: 'medium', color: '#fbc02d', description: 'Medium priority - standard timeline' },
  { type: 'priority', value: 'low', color: '#388e3c', description: 'Low priority - when resources available' },
  // Classification values
  { type: 'classification', value: 'public', color: '#4caf50', description: 'Public information' },
  { type: 'classification', value: 'internal', color: '#2196f3', description: 'Internal use only' },
  { type: 'classification', value: 'confidential', color: '#ff9800', description: 'Confidential information' },
  { type: 'classification', value: 'restricted', color: '#f44336', description: 'Restricted access' },
  // Status tag values
  { type: 'status_tag', value: 'needs_review', color: '#9c27b0', description: 'Needs review' },
  { type: 'status_tag', value: 'in_progress', color: '#03a9f4', description: 'Work in progress' },
  { type: 'status_tag', value: 'blocked', color: '#e91e63', description: 'Blocked by dependency' },
  { type: 'status_tag', value: 'approved', color: '#4caf50', description: 'Approved and ready' }
];

// =============================================================================
// Helper Functions
// =============================================================================

async function columnExists(tableName, columnName) {
  if (db.isPostgres()) {
    const result = await db.get(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = $1 AND column_name = $2`,
      [tableName, columnName]
    );
    return !!result;
  } else {
    const result = await db.all(`PRAGMA table_info(${tableName})`);
    return result.some(col => col.name === columnName);
  }
}

async function tableExists(tableName) {
  if (db.isPostgres()) {
    const result = await db.get(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_name = $1`,
      [tableName]
    );
    return !!result;
  } else {
    const result = await db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    return !!result;
  }
}

// =============================================================================
// Migration Function
// =============================================================================

async function runMigration() {
  console.log('Starting Platform Core Phase 7 migration...');
  console.log('Standards Library + Metadata Engine + Requirement Mapping\n');
  
  try {
    await db.init();
    
    // Step 1: Extend compliance_requirements table
    console.log('Step 1: Extending compliance_requirements table...');
    const reqExtensions = db.isPostgres() ? PG_REQUIREMENTS_EXTENSIONS : SQLITE_REQUIREMENTS_EXTENSIONS;
    for (const ext of reqExtensions) {
      const exists = await columnExists('compliance_requirements', ext.column);
      if (!exists) {
        try {
          await db.run(ext.sql);
          console.log(`  Added column: ${ext.column}`);
        } catch (err) {
          if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
            throw err;
          }
          console.log(`  Column already exists: ${ext.column}`);
        }
      } else {
        console.log(`  Column already exists: ${ext.column}`);
      }
    }
    
    // Create indexes for new columns
    console.log('  Creating indexes for new columns...');
    try {
      await db.run('CREATE INDEX IF NOT EXISTS idx_compliance_requirements_family ON compliance_requirements(family)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_compliance_requirements_code ON compliance_requirements(code)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_compliance_requirements_domain ON compliance_requirements(domain)');
      console.log('  Indexes created successfully.');
    } catch (err) {
      console.log('  Some indexes may already exist.');
    }
    
    // Step 2: Extend finding_requirements table if it exists
    console.log('\nStep 2: Extending finding_requirements table...');
    const findingReqExists = await tableExists('finding_requirements');
    if (findingReqExists) {
      const findingReqExtensions = db.isPostgres() ? PG_FINDING_REQUIREMENTS_EXTENSIONS : SQLITE_FINDING_REQUIREMENTS_EXTENSIONS;
      for (const ext of findingReqExtensions) {
        const exists = await columnExists('finding_requirements', ext.column);
        if (!exists) {
          try {
            await db.run(ext.sql);
            console.log(`  Added column: ${ext.column}`);
          } catch (err) {
            if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
              throw err;
            }
            console.log(`  Column already exists: ${ext.column}`);
          }
        } else {
          console.log(`  Column already exists: ${ext.column}`);
        }
      }
    } else {
      console.log('  finding_requirements table does not exist, skipping extension.');
    }
    
    // Step 3: Create new tables
    console.log('\nStep 3: Creating Phase 7 tables...');
    const schema = db.isPostgres() ? PG_SCHEMA : SQLITE_SCHEMA;
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await db.run(stmt);
        } catch (err) {
          // Ignore "already exists" errors
          if (!err.message.includes('already exists')) {
            console.log(`  Warning: ${err.message}`);
          }
        }
      }
    }
    console.log('  Phase 7 tables created successfully.');
    
    // Step 4: Seed permissions
    console.log('\nStep 4: Seeding Phase 7 permissions...');
    for (const perm of PHASE7_PERMISSIONS) {
      const placeholder = db.isPostgres() ? '$1' : '?';
      const existing = await db.get(
        `SELECT id FROM permissions WHERE key = ${placeholder}`,
        [perm.key]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO permissions (key, name, description, module) VALUES ($1, $2, $3, $4)`,
            [perm.key, perm.name, perm.description, perm.module]
          );
        } else {
          await db.run(
            `INSERT INTO permissions (key, name, description, module) VALUES (?, ?, ?, ?)`,
            [perm.key, perm.name, perm.description, perm.module]
          );
        }
        console.log(`  Added permission: ${perm.key}`);
      }
    }
    
    // Step 5: Seed role permissions
    console.log('\nStep 5: Seeding Phase 7 role permissions...');
    for (const [role, permKeys] of Object.entries(PHASE7_ROLE_PERMISSIONS)) {
      for (const permKey of permKeys) {
        const placeholder = db.isPostgres() ? '$1' : '?';
        const perm = await db.get(
          `SELECT id FROM permissions WHERE key = ${placeholder}`,
          [permKey]
        );
        if (perm) {
          const placeholder2 = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
          const existing = await db.get(
            `SELECT id FROM role_permissions WHERE role = ${placeholder2[0]} AND permission_id = ${placeholder2[1]}`,
            [role, perm.id]
          );
          if (!existing) {
            if (db.isPostgres()) {
              await db.run(
                `INSERT INTO role_permissions (role, permission_id) VALUES ($1, $2)`,
                [role, perm.id]
              );
            } else {
              await db.run(
                `INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)`,
                [role, perm.id]
              );
            }
          }
        }
      }
    }
    console.log('  Role permissions seeded.');
    
    // Step 6: Seed ACL rules
    console.log('\nStep 6: Seeding Phase 7 ACL rules...');
    for (const rule of PHASE7_ACL_RULES) {
      const placeholder = db.isPostgres() ? '$1' : '?';
      const existing = await db.get(
        `SELECT id FROM acl_rules WHERE name = ${placeholder}`,
        [rule.name]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO acl_rules (name, table_name, effect, conditions, fields, actions, priority) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [rule.name, rule.table_name, rule.effect, rule.conditions, rule.fields, rule.actions, rule.priority]
          );
        } else {
          await db.run(
            `INSERT INTO acl_rules (name, table_name, effect, conditions, fields, actions, priority) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [rule.name, rule.table_name, rule.effect, rule.conditions, rule.fields, rule.actions, rule.priority]
          );
        }
        console.log(`  Added ACL rule: ${rule.name}`);
      }
    }
    
    // Step 7: Seed default metadata types
    console.log('\nStep 7: Seeding default metadata types...');
    for (const type of DEFAULT_METADATA_TYPES) {
      const placeholder = db.isPostgres() ? '$1' : '?';
      const existing = await db.get(
        `SELECT id FROM metadata_types WHERE name = ${placeholder}`,
        [type.name]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO metadata_types (name, description) VALUES ($1, $2)`,
            [type.name, type.description]
          );
        } else {
          await db.run(
            `INSERT INTO metadata_types (name, description) VALUES (?, ?)`,
            [type.name, type.description]
          );
        }
        console.log(`  Added metadata type: ${type.name}`);
      }
    }
    
    // Step 8: Seed default metadata values
    console.log('\nStep 8: Seeding default metadata values...');
    for (const val of DEFAULT_METADATA_VALUES) {
      const placeholder = db.isPostgres() ? '$1' : '?';
      const type = await db.get(
        `SELECT id FROM metadata_types WHERE name = ${placeholder}`,
        [val.type]
      );
      if (type) {
        const placeholder2 = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
        const existing = await db.get(
          `SELECT id FROM metadata_values WHERE type_id = ${placeholder2[0]} AND value = ${placeholder2[1]}`,
          [type.id, val.value]
        );
        if (!existing) {
          if (db.isPostgres()) {
            await db.run(
              `INSERT INTO metadata_values (type_id, value, color, description) VALUES ($1, $2, $3, $4)`,
              [type.id, val.value, val.color, val.description]
            );
          } else {
            await db.run(
              `INSERT INTO metadata_values (type_id, value, color, description) VALUES (?, ?, ?, ?)`,
              [type.id, val.value, val.color, val.description]
            );
          }
          console.log(`  Added metadata value: ${val.type}/${val.value}`);
        }
      }
    }
    
    console.log('\n========================================');
    console.log('Platform Core Phase 7 migration completed successfully!');
    console.log('========================================\n');
    console.log('Summary:');
    console.log('  - Extended compliance_requirements table with standards fields');
    console.log('  - Created metadata_types, metadata_values, object_metadata tables');
    console.log('  - Created policy_requirements, risk_requirements mapping tables');
    console.log('  - Created audit_criteria table');
    console.log('  - Seeded permissions, ACL rules, and default metadata');
    console.log('\nNext steps:');
    console.log('  1. Run the standards importer: npm run import:standards');
    console.log('  2. Configure metadata types in Admin Panel');
    console.log('  3. Start mapping requirements to policies/risks/findings');
    
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('\nMigration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
runMigration();
