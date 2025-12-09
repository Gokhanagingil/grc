/**
 * Platform Core Phase 6 Migration Script
 * 
 * Extends the evidence table and creates new tables for Evidence Storage & Secure Transfer:
 * - evidence: Extended with file storage fields (non-breaking)
 * - evidence_shares: Secure sharing links with expiry and download limits
 * - evidence_access_logs: Audit trail for all evidence access
 * 
 * Also seeds:
 * - Evidence storage permissions
 * - ACL rules for evidence upload/download/share
 * - Form layouts for evidence
 * - UI policies for evidence lifecycle
 */

const db = require('../db');

// =============================================================================
// SQLite Schema
// =============================================================================

const SQLITE_SCHEMA = `
  -- Extend evidence table with file storage fields (non-breaking)
  -- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we check manually
  
  -- Evidence Shares table for secure sharing links
  CREATE TABLE IF NOT EXISTS evidence_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    FOREIGN KEY (evidence_id) REFERENCES evidence (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_evidence_shares_evidence ON evidence_shares(evidence_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_shares_token ON evidence_shares(token);
  CREATE INDEX IF NOT EXISTS idx_evidence_shares_expires ON evidence_shares(expires_at);

  -- Evidence Access Logs table for audit trail
  CREATE TABLE IF NOT EXISTS evidence_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id INTEGER NOT NULL,
    access_type TEXT NOT NULL CHECK (access_type IN ('upload', 'download', 'share_download', 'delete', 'share_create')),
    user_id INTEGER,
    share_id INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evidence_id) REFERENCES evidence (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (share_id) REFERENCES evidence_shares (id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_evidence_access_logs_evidence ON evidence_access_logs(evidence_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_access_logs_user ON evidence_access_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_access_logs_type ON evidence_access_logs(access_type);
  CREATE INDEX IF NOT EXISTS idx_evidence_access_logs_created ON evidence_access_logs(created_at);
`;

// =============================================================================
// PostgreSQL Schema
// =============================================================================

const PG_SCHEMA = `
  -- Evidence Shares table for secure sharing links
  CREATE TABLE IF NOT EXISTS evidence_shares (
    id SERIAL PRIMARY KEY,
    evidence_id INTEGER NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_evidence_shares_evidence ON evidence_shares(evidence_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_shares_token ON evidence_shares(token);
  CREATE INDEX IF NOT EXISTS idx_evidence_shares_expires ON evidence_shares(expires_at);

  -- Evidence Access Logs table for audit trail
  CREATE TABLE IF NOT EXISTS evidence_access_logs (
    id SERIAL PRIMARY KEY,
    evidence_id INTEGER NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('upload', 'download', 'share_download', 'delete', 'share_create')),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    share_id INTEGER REFERENCES evidence_shares(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_evidence_access_logs_evidence ON evidence_access_logs(evidence_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_access_logs_user ON evidence_access_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_access_logs_type ON evidence_access_logs(access_type);
  CREATE INDEX IF NOT EXISTS idx_evidence_access_logs_created ON evidence_access_logs(created_at);
`;

// =============================================================================
// Evidence Table Extensions (ALTER TABLE statements)
// =============================================================================

const SQLITE_EVIDENCE_EXTENSIONS = [
  { column: 'file_name', sql: 'ALTER TABLE evidence ADD COLUMN file_name TEXT' },
  { column: 'mime_type', sql: 'ALTER TABLE evidence ADD COLUMN mime_type TEXT' },
  { column: 'file_size', sql: 'ALTER TABLE evidence ADD COLUMN file_size INTEGER' },
  { column: 'storage_backend', sql: "ALTER TABLE evidence ADD COLUMN storage_backend TEXT DEFAULT 'local' CHECK (storage_backend IN ('local', 's3', 'azure', 'minio'))" },
  { column: 'storage_path', sql: 'ALTER TABLE evidence ADD COLUMN storage_path TEXT' },
  { column: 'checksum', sql: 'ALTER TABLE evidence ADD COLUMN checksum TEXT' },
  { column: 'retention_policy', sql: "ALTER TABLE evidence ADD COLUMN retention_policy TEXT DEFAULT 'default'" },
  { column: 'deleted_at', sql: 'ALTER TABLE evidence ADD COLUMN deleted_at DATETIME' }
];

const PG_EVIDENCE_EXTENSIONS = [
  { column: 'file_name', sql: 'ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)' },
  { column: 'mime_type', sql: 'ALTER TABLE evidence ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100)' },
  { column: 'file_size', sql: 'ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_size INTEGER' },
  { column: 'storage_backend', sql: "ALTER TABLE evidence ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(20) DEFAULT 'local'" },
  { column: 'storage_path', sql: 'ALTER TABLE evidence ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500)' },
  { column: 'checksum', sql: 'ALTER TABLE evidence ADD COLUMN IF NOT EXISTS checksum VARCHAR(64)' },
  { column: 'retention_policy', sql: "ALTER TABLE evidence ADD COLUMN IF NOT EXISTS retention_policy VARCHAR(50) DEFAULT 'default'" },
  { column: 'deleted_at', sql: 'ALTER TABLE evidence ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP' }
];

// =============================================================================
// Permissions
// =============================================================================

const PHASE6_PERMISSIONS = [
  // Evidence storage permissions
  { key: 'evidence.upload', name: 'Upload Evidence Files', description: 'Upload files to evidence records', module: 'audit' },
  { key: 'evidence.download', name: 'Download Evidence Files', description: 'Download evidence files', module: 'audit' },
  { key: 'evidence.share', name: 'Share Evidence', description: 'Create secure sharing links for evidence', module: 'audit' }
];

const PHASE6_ROLE_PERMISSIONS = {
  admin: [
    'evidence.upload', 'evidence.download', 'evidence.share'
  ],
  manager: [
    'evidence.upload', 'evidence.download', 'evidence.share'
  ],
  user: [
    'evidence.upload', 'evidence.download'
  ]
};

// =============================================================================
// ACL Rules
// =============================================================================

const PHASE6_ACL_RULES = [
  // Evidence upload/download ACL rules
  {
    name: 'Auditors can upload and download evidence',
    table_name: 'evidence',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager'] }),
    fields: null,
    actions: 'read,write,delete',
    priority: 10
  },
  {
    name: 'Evidence uploader can manage own evidence',
    table_name: 'evidence',
    effect: 'allow',
    conditions: JSON.stringify({ uploaded_by: '{{user.id}}' }),
    fields: null,
    actions: 'read,write,delete',
    priority: 8
  },
  {
    name: 'All users can view evidence',
    table_name: 'evidence',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager', 'user'] }),
    fields: null,
    actions: 'read',
    priority: 5
  },
  {
    name: 'Deleted evidence is hidden',
    table_name: 'evidence',
    effect: 'deny',
    conditions: JSON.stringify({ field: 'deleted_at', operator: 'is_not_null' }),
    fields: null,
    actions: 'read',
    priority: 20
  },
  // Evidence shares ACL rules
  {
    name: 'Auditors can create evidence shares',
    table_name: 'evidence_shares',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager'] }),
    fields: null,
    actions: 'read,write',
    priority: 10
  },
  {
    name: 'Share creator can view own shares',
    table_name: 'evidence_shares',
    effect: 'allow',
    conditions: JSON.stringify({ created_by: '{{user.id}}' }),
    fields: null,
    actions: 'read',
    priority: 8
  }
];

// =============================================================================
// Form Layouts
// =============================================================================

const PHASE6_FORM_LAYOUTS = [
  // Evidence form layouts with file fields
  {
    table_name: 'evidence',
    role: 'user',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Evidence Information',
          fields: ['title', 'description', 'type']
        },
        {
          title: 'File Information',
          fields: ['file_name', 'file_size', 'mime_type']
        }
      ],
      hiddenFields: ['storage_backend', 'storage_path', 'checksum', 'deleted_at'],
      readonlyFields: ['file_name', 'file_size', 'mime_type', 'uploaded_at', 'uploaded_by']
    })
  },
  {
    table_name: 'evidence',
    role: 'manager',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Evidence Information',
          fields: ['title', 'description', 'type', 'storage_type']
        },
        {
          title: 'File Information',
          fields: ['file_name', 'file_size', 'mime_type', 'checksum']
        },
        {
          title: 'Storage Details',
          fields: ['storage_backend', 'storage_path', 'retention_policy']
        },
        {
          title: 'Metadata',
          fields: ['uploaded_by', 'uploaded_at', 'created_at', 'updated_at']
        }
      ],
      hiddenFields: ['deleted_at'],
      readonlyFields: ['file_name', 'file_size', 'mime_type', 'checksum', 'storage_backend', 'storage_path', 'uploaded_at', 'created_at', 'updated_at']
    })
  },
  {
    table_name: 'evidence',
    role: 'admin',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Evidence Information',
          fields: ['title', 'description', 'type', 'storage_type']
        },
        {
          title: 'File Information',
          fields: ['file_name', 'file_size', 'mime_type', 'checksum']
        },
        {
          title: 'Storage Details',
          fields: ['storage_backend', 'storage_path', 'retention_policy']
        },
        {
          title: 'Metadata',
          fields: ['uploaded_by', 'uploaded_at', 'created_at', 'updated_at', 'deleted_at']
        }
      ],
      hiddenFields: [],
      readonlyFields: ['file_name', 'file_size', 'mime_type', 'checksum', 'storage_backend', 'storage_path', 'uploaded_at', 'created_at', 'updated_at']
    })
  }
];

// =============================================================================
// UI Policies
// =============================================================================

const PHASE6_UI_POLICIES = [
  // Evidence UI policies
  {
    name: 'Hide file fields when no file uploaded',
    table_name: 'evidence',
    condition: JSON.stringify({ field: 'storage_path', operator: 'is_null' }),
    actions: JSON.stringify([
      { type: 'hidden', fields: ['file_name', 'file_size', 'mime_type', 'checksum', 'storage_backend', 'storage_path'] }
    ]),
    priority: 5
  },
  {
    name: 'Show download button when file exists',
    table_name: 'evidence',
    condition: JSON.stringify({ field: 'storage_path', operator: 'is_not_null' }),
    actions: JSON.stringify([
      { type: 'visible', fields: ['file_name', 'file_size', 'mime_type'] },
      { type: 'action', action: 'download', enabled: true }
    ]),
    priority: 10
  },
  {
    name: 'Disable actions for deleted evidence',
    table_name: 'evidence',
    condition: JSON.stringify({ field: 'deleted_at', operator: 'is_not_null' }),
    actions: JSON.stringify([
      { type: 'readonly', fields: ['title', 'description', 'type'] },
      { type: 'action', action: 'download', enabled: false },
      { type: 'action', action: 'share', enabled: false }
    ]),
    priority: 20
  }
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

// =============================================================================
// Migration Function
// =============================================================================

async function runMigration() {
  console.log('Starting Platform Core Phase 6 migration...');
  
  try {
    await db.init();
    
    // Extend evidence table with new columns
    console.log('Extending evidence table with file storage fields...');
    const extensions = db.isPostgres() ? PG_EVIDENCE_EXTENSIONS : SQLITE_EVIDENCE_EXTENSIONS;
    for (const ext of extensions) {
      const exists = await columnExists('evidence', ext.column);
      if (!exists) {
        try {
          await db.run(ext.sql);
          console.log(`  Added column: ${ext.column}`);
        } catch (err) {
          // Column might already exist in SQLite (no IF NOT EXISTS support)
          if (!err.message.includes('duplicate column')) {
            throw err;
          }
        }
      } else {
        console.log(`  Column already exists: ${ext.column}`);
      }
    }
    console.log('Evidence table extended successfully.');
    
    // Create new tables
    console.log('Creating Phase 6 tables...');
    const schema = db.isPostgres() ? PG_SCHEMA : SQLITE_SCHEMA;
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.run(stmt);
      }
    }
    console.log('Phase 6 tables created successfully.');
    
    // Create index on deleted_at for soft delete queries
    console.log('Creating additional indexes...');
    try {
      if (db.isPostgres()) {
        await db.run('CREATE INDEX IF NOT EXISTS idx_evidence_deleted_at ON evidence(deleted_at)');
      } else {
        await db.run('CREATE INDEX IF NOT EXISTS idx_evidence_deleted_at ON evidence(deleted_at)');
      }
    } catch (err) {
      // Index might already exist
      console.log('  Index idx_evidence_deleted_at already exists or could not be created');
    }
    
    // Seed permissions
    console.log('Seeding Phase 6 permissions...');
    for (const perm of PHASE6_PERMISSIONS) {
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
    console.log('Phase 6 permissions seeded.');
    
    // Seed role permissions
    console.log('Seeding Phase 6 role permissions...');
    for (const [role, permKeys] of Object.entries(PHASE6_ROLE_PERMISSIONS)) {
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
    console.log('Phase 6 role permissions seeded.');
    
    // Seed ACL rules
    console.log('Seeding Phase 6 ACL rules...');
    for (const rule of PHASE6_ACL_RULES) {
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
    console.log('Phase 6 ACL rules seeded.');
    
    // Seed form layouts (update existing or insert new)
    console.log('Seeding Phase 6 form layouts...');
    for (const layout of PHASE6_FORM_LAYOUTS) {
      const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
      const existing = await db.get(
        `SELECT id FROM form_layouts WHERE table_name = ${placeholder[0]} AND role = ${placeholder[1]}`,
        [layout.table_name, layout.role]
      );
      if (existing) {
        // Update existing layout
        if (db.isPostgres()) {
          await db.run(
            `UPDATE form_layouts SET layout_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [layout.layout_json, existing.id]
          );
        } else {
          await db.run(
            `UPDATE form_layouts SET layout_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [layout.layout_json, existing.id]
          );
        }
        console.log(`  Updated form layout: ${layout.table_name}/${layout.role}`);
      } else {
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
        console.log(`  Added form layout: ${layout.table_name}/${layout.role}`);
      }
    }
    console.log('Phase 6 form layouts seeded.');
    
    // Seed UI policies
    console.log('Seeding Phase 6 UI policies...');
    for (const policy of PHASE6_UI_POLICIES) {
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
        console.log(`  Added UI policy: ${policy.name}`);
      }
    }
    console.log('Phase 6 UI policies seeded.');
    
    console.log('\n===========================================');
    console.log('Platform Core Phase 6 migration completed!');
    console.log('===========================================');
    console.log('Extended tables:');
    console.log('  - evidence (added file storage fields)');
    console.log('Created tables:');
    console.log('  - evidence_shares');
    console.log('  - evidence_access_logs');
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
