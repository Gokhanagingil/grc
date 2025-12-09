/**
 * Platform Core Phase 3 Migration Script
 * 
 * Creates the audits table and seeds:
 * - Audit permissions
 * - Audit ACL rules
 * - Audit form layouts
 * - Audit UI policies
 * - Demo tenant configurations
 */

const db = require('../db');

const SQLITE_AUDITS_TABLE = `
  -- Audits table for Audit Management module
  CREATE TABLE IF NOT EXISTS audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    audit_type TEXT DEFAULT 'internal',
    status TEXT DEFAULT 'planned',
    risk_level TEXT DEFAULT 'medium',
    department TEXT,
    owner_id INTEGER,
    lead_auditor_id INTEGER,
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    scope TEXT,
    objectives TEXT,
    methodology TEXT,
    findings_summary TEXT,
    recommendations TEXT,
    conclusion TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (lead_auditor_id) REFERENCES users (id) ON DELETE SET NULL
  );

  -- Create indexes for audits table
  CREATE INDEX IF NOT EXISTS idx_audits_owner ON audits(owner_id);
  CREATE INDEX IF NOT EXISTS idx_audits_lead_auditor ON audits(lead_auditor_id);
  CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
  CREATE INDEX IF NOT EXISTS idx_audits_risk_level ON audits(risk_level);
  CREATE INDEX IF NOT EXISTS idx_audits_department ON audits(department);
  CREATE INDEX IF NOT EXISTS idx_audits_audit_type ON audits(audit_type);
`;

const PG_AUDITS_TABLE = `
  -- Audits table for Audit Management module
  CREATE TABLE IF NOT EXISTS audits (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    audit_type VARCHAR(50) DEFAULT 'internal',
    status VARCHAR(50) DEFAULT 'planned',
    risk_level VARCHAR(50) DEFAULT 'medium',
    department VARCHAR(255),
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    lead_auditor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    scope TEXT,
    objectives TEXT,
    methodology TEXT,
    findings_summary TEXT,
    recommendations TEXT,
    conclusion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes for audits table
  CREATE INDEX IF NOT EXISTS idx_audits_owner ON audits(owner_id);
  CREATE INDEX IF NOT EXISTS idx_audits_lead_auditor ON audits(lead_auditor_id);
  CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
  CREATE INDEX IF NOT EXISTS idx_audits_risk_level ON audits(risk_level);
  CREATE INDEX IF NOT EXISTS idx_audits_department ON audits(department);
  CREATE INDEX IF NOT EXISTS idx_audits_audit_type ON audits(audit_type);
`;

const AUDIT_PERMISSIONS = [
  { key: 'audits.read', name: 'Read Audits', description: 'View audit records', module: 'audit' },
  { key: 'audits.write', name: 'Write Audits', description: 'Create and update audit records', module: 'audit' },
  { key: 'audits.delete', name: 'Delete Audits', description: 'Delete audit records', module: 'audit' },
  { key: 'audits.assign', name: 'Assign Audits', description: 'Assign audits to users', module: 'audit' },
  { key: 'audits.close', name: 'Close Audits', description: 'Close audit records', module: 'audit' }
];

const AUDIT_ROLE_PERMISSIONS = {
  admin: ['audits.read', 'audits.write', 'audits.delete', 'audits.assign', 'audits.close'],
  manager: ['audits.read', 'audits.write', 'audits.assign', 'audits.close'],
  user: ['audits.read']
};

const AUDIT_ACL_RULES = [
  {
    name: 'Owner can edit own audits',
    table_name: 'audits',
    effect: 'allow',
    conditions: JSON.stringify({ owner_id: '{{user.id}}' }),
    fields: null,
    actions: 'read,write',
    priority: 10
  },
  {
    name: 'Lead auditor can edit assigned audits',
    table_name: 'audits',
    effect: 'allow',
    conditions: JSON.stringify({ lead_auditor_id: '{{user.id}}' }),
    fields: null,
    actions: 'read,write',
    priority: 10
  },
  {
    name: 'Hide sensitive audit fields from standard users',
    table_name: 'audits',
    effect: 'deny',
    conditions: JSON.stringify({ role: 'user' }),
    fields: JSON.stringify(['findings_summary', 'recommendations', 'conclusion']),
    actions: 'read',
    priority: 5
  },
  {
    name: 'Department-based audit access',
    table_name: 'audits',
    effect: 'allow',
    conditions: JSON.stringify({ department: '{{user.department}}' }),
    fields: null,
    actions: 'read',
    priority: 8
  }
];

const AUDIT_FORM_LAYOUTS = [
  {
    table_name: 'audits',
    role: 'user',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'audit_type', 'status', 'department']
        },
        {
          title: 'Schedule',
          fields: ['planned_start_date', 'planned_end_date']
        },
        {
          title: 'Scope & Objectives',
          fields: ['scope', 'objectives']
        }
      ],
      hiddenFields: ['findings_summary', 'recommendations', 'conclusion', 'methodology', 'owner_id', 'lead_auditor_id'],
      readonlyFields: ['status', 'risk_level', 'actual_start_date', 'actual_end_date', 'created_at', 'updated_at']
    })
  },
  {
    table_name: 'audits',
    role: 'manager',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'audit_type', 'status', 'risk_level', 'department']
        },
        {
          title: 'Assignment',
          fields: ['owner_id', 'lead_auditor_id']
        },
        {
          title: 'Schedule',
          fields: ['planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date']
        },
        {
          title: 'Scope & Objectives',
          fields: ['scope', 'objectives', 'methodology']
        },
        {
          title: 'Findings & Recommendations',
          fields: ['findings_summary', 'recommendations', 'conclusion']
        }
      ],
      hiddenFields: [],
      readonlyFields: ['created_at', 'updated_at']
    })
  },
  {
    table_name: 'audits',
    role: 'admin',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'audit_type', 'status', 'risk_level', 'department']
        },
        {
          title: 'Assignment',
          fields: ['owner_id', 'lead_auditor_id']
        },
        {
          title: 'Schedule',
          fields: ['planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date']
        },
        {
          title: 'Scope & Objectives',
          fields: ['scope', 'objectives', 'methodology']
        },
        {
          title: 'Findings & Recommendations',
          fields: ['findings_summary', 'recommendations', 'conclusion']
        },
        {
          title: 'Metadata',
          fields: ['created_at', 'updated_at']
        }
      ],
      hiddenFields: [],
      readonlyFields: ['created_at', 'updated_at']
    })
  }
];

const AUDIT_UI_POLICIES = [
  {
    name: 'Make fields readonly when audit is closed',
    table_name: 'audits',
    condition: JSON.stringify({ field: 'status', operator: 'equals', value: 'closed' }),
    actions: JSON.stringify([
      { type: 'readonly', fields: ['name', 'description', 'audit_type', 'risk_level', 'department', 'scope', 'objectives', 'methodology', 'planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', 'owner_id', 'lead_auditor_id'] }
    ]),
    priority: 10
  },
  {
    name: 'Hide findings when audit is planned',
    table_name: 'audits',
    condition: JSON.stringify({ field: 'status', operator: 'equals', value: 'planned' }),
    actions: JSON.stringify([
      { type: 'hide', fields: ['findings_summary', 'recommendations', 'conclusion', 'actual_start_date', 'actual_end_date'] }
    ]),
    priority: 10
  },
  {
    name: 'Require justification for high risk audits',
    table_name: 'audits',
    condition: JSON.stringify({ field: 'risk_level', operator: 'equals', value: 'high' }),
    actions: JSON.stringify([
      { type: 'mandatory', fields: ['scope', 'objectives', 'methodology'] }
    ]),
    priority: 8
  },
  {
    name: 'Require justification for critical risk audits',
    table_name: 'audits',
    condition: JSON.stringify({ field: 'risk_level', operator: 'equals', value: 'critical' }),
    actions: JSON.stringify([
      { type: 'mandatory', fields: ['scope', 'objectives', 'methodology', 'lead_auditor_id'] }
    ]),
    priority: 9
  },
  {
    name: 'Make name mandatory',
    table_name: 'audits',
    condition: JSON.stringify({ always: true }),
    actions: JSON.stringify([{ type: 'mandatory', fields: ['name'] }]),
    priority: 1
  },
  {
    name: 'Show actual dates when audit is in progress',
    table_name: 'audits',
    condition: JSON.stringify({ field: 'status', operator: 'equals', value: 'in_progress' }),
    actions: JSON.stringify([
      { type: 'show', fields: ['actual_start_date'] },
      { type: 'mandatory', fields: ['actual_start_date'] }
    ]),
    priority: 10
  }
];

const DEMO_TENANT_MODULES = [
  // Demo tenant with audit enabled
  { tenant_id: 'demo-full', module_key: 'risk', status: 'enabled' },
  { tenant_id: 'demo-full', module_key: 'policy', status: 'enabled' },
  { tenant_id: 'demo-full', module_key: 'compliance', status: 'enabled' },
  { tenant_id: 'demo-full', module_key: 'audit', status: 'enabled' },
  { tenant_id: 'demo-full', module_key: 'itsm.incident', status: 'enabled' },
  // Demo tenant with audit disabled
  { tenant_id: 'demo-basic', module_key: 'risk', status: 'enabled' },
  { tenant_id: 'demo-basic', module_key: 'policy', status: 'enabled' },
  { tenant_id: 'demo-basic', module_key: 'compliance', status: 'enabled' },
  { tenant_id: 'demo-basic', module_key: 'audit', status: 'disabled' }
];

const SAMPLE_AUDITS = [
  {
    name: 'Q4 2024 Financial Controls Audit',
    description: 'Annual audit of financial controls and processes',
    audit_type: 'internal',
    status: 'completed',
    risk_level: 'high',
    department: 'Finance',
    planned_start_date: '2024-10-01',
    planned_end_date: '2024-10-31',
    actual_start_date: '2024-10-01',
    actual_end_date: '2024-11-05',
    scope: 'Review of all financial controls including accounts payable, accounts receivable, and general ledger processes',
    objectives: 'Ensure compliance with SOX requirements and identify control gaps',
    methodology: 'Control testing, walkthrough procedures, and substantive testing',
    findings_summary: 'Two minor control deficiencies identified in AP approval process',
    recommendations: 'Implement dual approval for invoices over $10,000',
    conclusion: 'Overall control environment is effective with minor improvements needed'
  },
  {
    name: 'IT Security Assessment 2024',
    description: 'Comprehensive IT security and access control review',
    audit_type: 'internal',
    status: 'in_progress',
    risk_level: 'critical',
    department: 'IT',
    planned_start_date: '2024-11-15',
    planned_end_date: '2024-12-15',
    actual_start_date: '2024-11-15',
    scope: 'Review of network security, access controls, and incident response procedures',
    objectives: 'Assess IT security posture and compliance with ISO 27001',
    methodology: 'Vulnerability scanning, penetration testing, and policy review'
  },
  {
    name: 'GDPR Compliance Audit',
    description: 'Data privacy and GDPR compliance assessment',
    audit_type: 'external',
    status: 'planned',
    risk_level: 'high',
    department: 'Legal',
    planned_start_date: '2025-01-15',
    planned_end_date: '2025-02-15',
    scope: 'Review of data processing activities, consent mechanisms, and data subject rights procedures',
    objectives: 'Ensure full compliance with GDPR requirements'
  },
  {
    name: 'Vendor Management Review',
    description: 'Assessment of third-party vendor risk management',
    audit_type: 'internal',
    status: 'planned',
    risk_level: 'medium',
    department: 'Procurement',
    planned_start_date: '2025-02-01',
    planned_end_date: '2025-02-28',
    scope: 'Review of vendor selection, onboarding, and monitoring processes',
    objectives: 'Evaluate effectiveness of vendor risk management program'
  },
  {
    name: 'HR Policy Compliance Check',
    description: 'Review of HR policies and employee compliance',
    audit_type: 'internal',
    status: 'completed',
    risk_level: 'low',
    department: 'HR',
    planned_start_date: '2024-09-01',
    planned_end_date: '2024-09-30',
    actual_start_date: '2024-09-01',
    actual_end_date: '2024-09-28',
    scope: 'Review of employee handbook compliance and training records',
    objectives: 'Ensure HR policies are current and employees are properly trained',
    methodology: 'Document review and sample testing of training records',
    findings_summary: 'All policies current, 98% training completion rate',
    recommendations: 'Implement automated training reminders',
    conclusion: 'HR compliance program is effective'
  }
];

async function runMigration() {
  console.log('Starting Platform Core Phase 3 migration...');
  
  try {
    await db.init();
    
    // Create audits table
    console.log('Creating audits table...');
    const tableSchema = db.isPostgres() ? PG_AUDITS_TABLE : SQLITE_AUDITS_TABLE;
    const statements = tableSchema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.run(stmt);
      }
    }
    console.log('Audits table created successfully.');
    
    // Seed audit permissions
    console.log('Seeding audit permissions...');
    for (const perm of AUDIT_PERMISSIONS) {
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
    console.log('Audit permissions seeded.');
    
    // Seed audit role permissions
    console.log('Seeding audit role permissions...');
    for (const [role, permKeys] of Object.entries(AUDIT_ROLE_PERMISSIONS)) {
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
    console.log('Audit role permissions seeded.');
    
    // Seed audit ACL rules
    console.log('Seeding audit ACL rules...');
    for (const rule of AUDIT_ACL_RULES) {
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
    console.log('Audit ACL rules seeded.');
    
    // Seed audit form layouts
    console.log('Seeding audit form layouts...');
    for (const layout of AUDIT_FORM_LAYOUTS) {
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
    console.log('Audit form layouts seeded.');
    
    // Seed audit UI policies
    console.log('Seeding audit UI policies...');
    for (const policy of AUDIT_UI_POLICIES) {
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
    console.log('Audit UI policies seeded.');
    
    // Seed demo tenant modules
    console.log('Seeding demo tenant modules...');
    for (const mod of DEMO_TENANT_MODULES) {
      const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
      const existing = await db.get(
        `SELECT id FROM tenant_modules WHERE tenant_id = ${placeholder[0]} AND module_key = ${placeholder[1]}`,
        [mod.tenant_id, mod.module_key]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO tenant_modules (tenant_id, module_key, status) VALUES ($1, $2, $3)`,
            [mod.tenant_id, mod.module_key, mod.status]
          );
        } else {
          await db.run(
            `INSERT INTO tenant_modules (tenant_id, module_key, status) VALUES (?, ?, ?)`,
            [mod.tenant_id, mod.module_key, mod.status]
          );
        }
      }
    }
    console.log('Demo tenant modules seeded.');
    
    // Seed sample audits
    console.log('Seeding sample audits...');
    for (const audit of SAMPLE_AUDITS) {
      const placeholder = db.isPostgres() ? '$1' : '?';
      const existing = await db.get(
        `SELECT id FROM audits WHERE name = ${placeholder}`,
        [audit.name]
      );
      if (!existing) {
        const fields = Object.keys(audit);
        const values = Object.values(audit);
        
        if (db.isPostgres()) {
          const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
          await db.run(
            `INSERT INTO audits (${fields.join(', ')}) VALUES (${placeholders})`,
            values
          );
        } else {
          const placeholders = fields.map(() => '?').join(', ');
          await db.run(
            `INSERT INTO audits (${fields.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
      }
    }
    console.log('Sample audits seeded.');
    
    console.log('Platform Core Phase 3 migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
