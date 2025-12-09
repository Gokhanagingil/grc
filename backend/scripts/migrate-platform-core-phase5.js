/**
 * Platform Core Phase 5 Migration Script
 * 
 * Creates the following tables for Audit Reporting Engine:
 * - audit_reports: Audit report versions with lifecycle management
 * 
 * Also seeds:
 * - Audit report permissions
 * - ACL rules for report lifecycle
 * - Form layouts for audit reports
 * - UI policies for report lifecycle rules
 */

const db = require('../db');

// =============================================================================
// SQLite Schema
// =============================================================================

const SQLITE_SCHEMA = `
  -- Audit Reports table for generated audit reports
  CREATE TABLE IF NOT EXISTS audit_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'final', 'archived')),
    generated_html TEXT,
    generated_pdf_path TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (audit_id) REFERENCES audits (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_reports_audit ON audit_reports(audit_id);
  CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports(status);
  CREATE INDEX IF NOT EXISTS idx_audit_reports_version ON audit_reports(audit_id, version);
  CREATE INDEX IF NOT EXISTS idx_audit_reports_created_by ON audit_reports(created_by);
`;

// =============================================================================
// PostgreSQL Schema
// =============================================================================

const PG_SCHEMA = `
  -- Audit Reports table for generated audit reports
  CREATE TABLE IF NOT EXISTS audit_reports (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'final', 'archived')),
    generated_html TEXT,
    generated_pdf_path VARCHAR(500),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_audit_reports_audit ON audit_reports(audit_id);
  CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports(status);
  CREATE INDEX IF NOT EXISTS idx_audit_reports_version ON audit_reports(audit_id, version);
  CREATE INDEX IF NOT EXISTS idx_audit_reports_created_by ON audit_reports(created_by);
`;

// =============================================================================
// Permissions
// =============================================================================

const PHASE5_PERMISSIONS = [
  // Audit Report permissions
  { key: 'audit_reports.read', name: 'Read Audit Reports', description: 'View audit reports', module: 'audit' },
  { key: 'audit_reports.generate', name: 'Generate Audit Reports', description: 'Generate new audit report drafts', module: 'audit' },
  { key: 'audit_reports.submit_review', name: 'Submit Reports for Review', description: 'Submit draft reports for review', module: 'audit' },
  { key: 'audit_reports.finalize', name: 'Finalize Audit Reports', description: 'Finalize audit reports (audit manager only)', module: 'audit' },
  { key: 'audit_reports.archive', name: 'Archive Audit Reports', description: 'Archive finalized audit reports (governance/quality only)', module: 'audit' },
  { key: 'audit_reports.regenerate', name: 'Regenerate Audit Reports', description: 'Regenerate draft/under_review reports', module: 'audit' }
];

const PHASE5_ROLE_PERMISSIONS = {
  admin: [
    'audit_reports.read', 'audit_reports.generate', 'audit_reports.submit_review',
    'audit_reports.finalize', 'audit_reports.archive', 'audit_reports.regenerate'
  ],
  manager: [
    'audit_reports.read', 'audit_reports.generate', 'audit_reports.submit_review',
    'audit_reports.finalize', 'audit_reports.regenerate'
  ],
  user: [
    'audit_reports.read'
  ]
};

// =============================================================================
// ACL Rules
// =============================================================================

const PHASE5_ACL_RULES = [
  // Audit Report ACL rules
  {
    name: 'Auditors can generate and view reports',
    table_name: 'audit_reports',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager'] }),
    fields: null,
    actions: 'read,write',
    priority: 10
  },
  {
    name: 'Report creator can edit own draft reports',
    table_name: 'audit_reports',
    effect: 'allow',
    conditions: JSON.stringify({ created_by: '{{user.id}}', status: ['draft', 'under_review'] }),
    fields: null,
    actions: 'read,write',
    priority: 8
  },
  {
    name: 'All users can read final reports',
    table_name: 'audit_reports',
    effect: 'allow',
    conditions: JSON.stringify({ status: 'final' }),
    fields: null,
    actions: 'read',
    priority: 5
  },
  {
    name: 'Standard users cannot modify reports',
    table_name: 'audit_reports',
    effect: 'deny',
    conditions: JSON.stringify({ role: 'user' }),
    fields: null,
    actions: 'write,delete',
    priority: 15
  },
  {
    name: 'Final reports cannot be modified',
    table_name: 'audit_reports',
    effect: 'deny',
    conditions: JSON.stringify({ status: 'final' }),
    fields: JSON.stringify(['generated_html', 'generated_pdf_path', 'version']),
    actions: 'write',
    priority: 20
  }
];

// =============================================================================
// Form Layouts
// =============================================================================

const PHASE5_FORM_LAYOUTS = [
  // Audit Report form layouts
  {
    table_name: 'audit_reports',
    role: 'user',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Report Information',
          fields: ['version', 'status', 'created_at']
        }
      ],
      hiddenFields: ['generated_html', 'generated_pdf_path', 'created_by'],
      readonlyFields: ['version', 'status', 'created_at', 'updated_at']
    })
  },
  {
    table_name: 'audit_reports',
    role: 'manager',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Report Information',
          fields: ['version', 'status']
        },
        {
          title: 'Content',
          fields: ['generated_html']
        },
        {
          title: 'Metadata',
          fields: ['created_by', 'created_at', 'updated_at']
        }
      ],
      hiddenFields: [],
      readonlyFields: ['version', 'created_at', 'updated_at', 'created_by']
    })
  },
  {
    table_name: 'audit_reports',
    role: 'admin',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Report Information',
          fields: ['audit_id', 'version', 'status']
        },
        {
          title: 'Content',
          fields: ['generated_html', 'generated_pdf_path']
        },
        {
          title: 'Metadata',
          fields: ['created_by', 'created_at', 'updated_at']
        }
      ],
      hiddenFields: [],
      readonlyFields: ['version', 'created_at', 'updated_at']
    })
  }
];

// =============================================================================
// UI Policies
// =============================================================================

const PHASE5_UI_POLICIES = [
  // Audit Report UI policies
  {
    name: 'Make all fields readonly when report is final',
    table_name: 'audit_reports',
    condition: JSON.stringify({ field: 'status', operator: 'equals', value: 'final' }),
    actions: JSON.stringify([
      { type: 'readonly', fields: ['generated_html', 'generated_pdf_path', 'version', 'status'] }
    ]),
    priority: 10
  },
  {
    name: 'Make all fields readonly when report is archived',
    table_name: 'audit_reports',
    condition: JSON.stringify({ field: 'status', operator: 'equals', value: 'archived' }),
    actions: JSON.stringify([
      { type: 'readonly', fields: ['generated_html', 'generated_pdf_path', 'version', 'status'] }
    ]),
    priority: 10
  },
  {
    name: 'Allow status change for draft reports',
    table_name: 'audit_reports',
    condition: JSON.stringify({ field: 'status', operator: 'equals', value: 'draft' }),
    actions: JSON.stringify([
      { type: 'visible', fields: ['status'] }
    ]),
    priority: 5
  }
];

// =============================================================================
// Migration Function
// =============================================================================

async function runMigration() {
  console.log('Starting Platform Core Phase 5 migration...');
  
  try {
    await db.init();
    
    // Create tables
    console.log('Creating Phase 5 tables...');
    const schema = db.isPostgres() ? PG_SCHEMA : SQLITE_SCHEMA;
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.run(stmt);
      }
    }
    console.log('Phase 5 tables created successfully.');
    
    // Seed permissions
    console.log('Seeding Phase 5 permissions...');
    for (const perm of PHASE5_PERMISSIONS) {
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
      }
    }
    console.log('Phase 5 permissions seeded.');
    
    // Seed role permissions
    console.log('Seeding Phase 5 role permissions...');
    for (const [role, permKeys] of Object.entries(PHASE5_ROLE_PERMISSIONS)) {
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
    console.log('Phase 5 role permissions seeded.');
    
    // Seed ACL rules
    console.log('Seeding Phase 5 ACL rules...');
    for (const rule of PHASE5_ACL_RULES) {
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
      }
    }
    console.log('Phase 5 ACL rules seeded.');
    
    // Seed form layouts
    console.log('Seeding Phase 5 form layouts...');
    for (const layout of PHASE5_FORM_LAYOUTS) {
      const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
      const existing = await db.get(
        `SELECT id FROM form_layouts WHERE table_name = ${placeholder[0]} AND role = ${placeholder[1]}`,
        [layout.table_name, layout.role]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO form_layouts (table_name, role, layout_json) VALUES ($1, $2, $3)`,
            [layout.table_name, layout.role, layout.layout_json]
          );
        } else {
          await db.run(
            `INSERT INTO form_layouts (table_name, role, layout_json) VALUES (?, ?, ?)`,
            [layout.table_name, layout.role, layout.layout_json]
          );
        }
      }
    }
    console.log('Phase 5 form layouts seeded.');
    
    // Seed UI policies
    console.log('Seeding Phase 5 UI policies...');
    for (const policy of PHASE5_UI_POLICIES) {
      const placeholder = db.isPostgres() ? '$1' : '?';
      const existing = await db.get(
        `SELECT id FROM ui_policies WHERE name = ${placeholder}`,
        [policy.name]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO ui_policies (name, table_name, condition, actions, priority) VALUES ($1, $2, $3, $4, $5)`,
            [policy.name, policy.table_name, policy.condition, policy.actions, policy.priority]
          );
        } else {
          await db.run(
            `INSERT INTO ui_policies (name, table_name, condition, actions, priority) VALUES (?, ?, ?, ?, ?)`,
            [policy.name, policy.table_name, policy.condition, policy.actions, policy.priority]
          );
        }
      }
    }
    console.log('Phase 5 UI policies seeded.');
    
    console.log('\n===========================================');
    console.log('Platform Core Phase 5 migration completed!');
    console.log('===========================================');
    console.log('Created tables:');
    console.log('  - audit_reports');
    console.log('===========================================');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
