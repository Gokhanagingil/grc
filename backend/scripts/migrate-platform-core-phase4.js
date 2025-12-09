/**
 * Platform Core Phase 4 Migration Script
 * 
 * Creates the following tables for Audit cross-module integrations:
 * - findings: Audit findings with extended lifecycle
 * - capas: Corrective and Preventive Actions
 * - evidence: Evidence records (V1 non-storage version)
 * - finding_risks: M2M Finding ↔ Risk
 * - audit_criteria: M2M Audit ↔ Requirement (criteria)
 * - finding_requirements: M2M Finding ↔ Requirement (breach)
 * - finding_itsm_links: Finding ↔ ITSM artifacts
 * - audit_scope_objects: Audit ↔ CMDB/Service scope
 * 
 * Also seeds:
 * - Finding, CAPA, Evidence permissions
 * - ACL rules for new entities
 * - Form layouts for new entities
 * - UI policies for lifecycle rules
 */

const db = require('../db');

// =============================================================================
// SQLite Schema
// =============================================================================

const SQLITE_SCHEMA = `
  -- Findings table for Audit Findings
  CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'under_discussion', 'action_agreed', 'in_progress', 'pending_validation', 'closed', 'reopened')),
    root_cause TEXT,
    recommendation TEXT,
    management_response TEXT,
    owner_id INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (audit_id) REFERENCES audits (id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_findings_audit ON findings(audit_id);
  CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
  CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
  CREATE INDEX IF NOT EXISTS idx_findings_owner ON findings(owner_id);

  -- CAPAs table for Corrective and Preventive Actions
  CREATE TABLE IF NOT EXISTS capas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'corrective' CHECK (type IN ('corrective', 'preventive', 'containment')),
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'implemented', 'overdue')),
    validation_status TEXT DEFAULT 'not_validated' CHECK (validation_status IN ('not_validated', 'validated', 'rejected')),
    due_date DATE,
    validation_date DATE,
    validated_by INTEGER,
    extended_due_date DATE,
    extension_reason TEXT,
    owner_id INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (finding_id) REFERENCES findings (id) ON DELETE CASCADE,
    FOREIGN KEY (validated_by) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_capas_finding ON capas(finding_id);
  CREATE INDEX IF NOT EXISTS idx_capas_status ON capas(status);
  CREATE INDEX IF NOT EXISTS idx_capas_validation_status ON capas(validation_status);
  CREATE INDEX IF NOT EXISTS idx_capas_due_date ON capas(due_date);
  CREATE INDEX IF NOT EXISTS idx_capas_owner ON capas(owner_id);

  -- Evidence table (V1 non-storage version)
  CREATE TABLE IF NOT EXISTS evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_id INTEGER,
    audit_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'document' CHECK (type IN ('document', 'screenshot', 'log', 'configuration', 'ticket', 'interview', 'observation')),
    storage_type TEXT DEFAULT 'reference' CHECK (storage_type IN ('link', 'external', 'reference')),
    storage_ref TEXT,
    external_system TEXT,
    external_id TEXT,
    uploaded_by INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (finding_id) REFERENCES findings (id) ON DELETE SET NULL,
    FOREIGN KEY (audit_id) REFERENCES audits (id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_evidence_finding ON evidence(finding_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_audit ON evidence(audit_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(type);
  CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON evidence(uploaded_by);

  -- Finding ↔ Risk M2M table
  CREATE TABLE IF NOT EXISTS finding_risks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_id INTEGER NOT NULL,
    risk_id INTEGER NOT NULL,
    relation_type TEXT DEFAULT 'related' CHECK (relation_type IN ('source', 'related', 'supports')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (finding_id) REFERENCES findings (id) ON DELETE CASCADE,
    FOREIGN KEY (risk_id) REFERENCES risks (id) ON DELETE CASCADE,
    UNIQUE(finding_id, risk_id)
  );

  CREATE INDEX IF NOT EXISTS idx_finding_risks_finding ON finding_risks(finding_id);
  CREATE INDEX IF NOT EXISTS idx_finding_risks_risk ON finding_risks(risk_id);

  -- Audit ↔ Requirement (Criteria) M2M table
  CREATE TABLE IF NOT EXISTS audit_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    requirement_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (audit_id) REFERENCES audits (id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES compliance_requirements (id) ON DELETE CASCADE,
    UNIQUE(audit_id, requirement_id)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_criteria_audit ON audit_criteria(audit_id);
  CREATE INDEX IF NOT EXISTS idx_audit_criteria_requirement ON audit_criteria(requirement_id);

  -- Finding ↔ Requirement (Breach) M2M table
  CREATE TABLE IF NOT EXISTS finding_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_id INTEGER NOT NULL,
    requirement_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (finding_id) REFERENCES findings (id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES compliance_requirements (id) ON DELETE CASCADE,
    UNIQUE(finding_id, requirement_id)
  );

  CREATE INDEX IF NOT EXISTS idx_finding_requirements_finding ON finding_requirements(finding_id);
  CREATE INDEX IF NOT EXISTS idx_finding_requirements_requirement ON finding_requirements(requirement_id);

  -- Finding ↔ ITSM Links table
  CREATE TABLE IF NOT EXISTS finding_itsm_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_id INTEGER NOT NULL,
    itsm_type TEXT NOT NULL CHECK (itsm_type IN ('incident', 'problem', 'change', 'request')),
    itsm_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (finding_id) REFERENCES findings (id) ON DELETE CASCADE,
    UNIQUE(finding_id, itsm_type, itsm_id)
  );

  CREATE INDEX IF NOT EXISTS idx_finding_itsm_finding ON finding_itsm_links(finding_id);
  CREATE INDEX IF NOT EXISTS idx_finding_itsm_type ON finding_itsm_links(itsm_type);

  -- Audit ↔ CMDB/Service Scope Objects table
  CREATE TABLE IF NOT EXISTS audit_scope_objects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    object_type TEXT NOT NULL CHECK (object_type IN ('service', 'application', 'server', 'database', 'network', 'other')),
    object_id TEXT NOT NULL,
    object_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (audit_id) REFERENCES audits (id) ON DELETE CASCADE,
    UNIQUE(audit_id, object_type, object_id)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_scope_audit ON audit_scope_objects(audit_id);
  CREATE INDEX IF NOT EXISTS idx_audit_scope_type ON audit_scope_objects(object_type);
`;

// =============================================================================
// PostgreSQL Schema
// =============================================================================

const PG_SCHEMA = `
  -- Findings table for Audit Findings
  CREATE TABLE IF NOT EXISTS findings (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'under_discussion', 'action_agreed', 'in_progress', 'pending_validation', 'closed', 'reopened')),
    root_cause TEXT,
    recommendation TEXT,
    management_response TEXT,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_findings_audit ON findings(audit_id);
  CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
  CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
  CREATE INDEX IF NOT EXISTS idx_findings_owner ON findings(owner_id);

  -- CAPAs table for Corrective and Preventive Actions
  CREATE TABLE IF NOT EXISTS capas (
    id SERIAL PRIMARY KEY,
    finding_id INTEGER NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'corrective' CHECK (type IN ('corrective', 'preventive', 'containment')),
    status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'implemented', 'overdue')),
    validation_status VARCHAR(20) DEFAULT 'not_validated' CHECK (validation_status IN ('not_validated', 'validated', 'rejected')),
    due_date DATE,
    validation_date DATE,
    validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    extended_due_date DATE,
    extension_reason TEXT,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_capas_finding ON capas(finding_id);
  CREATE INDEX IF NOT EXISTS idx_capas_status ON capas(status);
  CREATE INDEX IF NOT EXISTS idx_capas_validation_status ON capas(validation_status);
  CREATE INDEX IF NOT EXISTS idx_capas_due_date ON capas(due_date);
  CREATE INDEX IF NOT EXISTS idx_capas_owner ON capas(owner_id);

  -- Evidence table (V1 non-storage version)
  CREATE TABLE IF NOT EXISTS evidence (
    id SERIAL PRIMARY KEY,
    finding_id INTEGER REFERENCES findings(id) ON DELETE SET NULL,
    audit_id INTEGER REFERENCES audits(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'document' CHECK (type IN ('document', 'screenshot', 'log', 'configuration', 'ticket', 'interview', 'observation')),
    storage_type VARCHAR(20) DEFAULT 'reference' CHECK (storage_type IN ('link', 'external', 'reference')),
    storage_ref TEXT,
    external_system VARCHAR(100),
    external_id VARCHAR(255),
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_evidence_finding ON evidence(finding_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_audit ON evidence(audit_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(type);
  CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON evidence(uploaded_by);

  -- Finding ↔ Risk M2M table
  CREATE TABLE IF NOT EXISTS finding_risks (
    id SERIAL PRIMARY KEY,
    finding_id INTEGER NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    risk_id INTEGER NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
    relation_type VARCHAR(20) DEFAULT 'related' CHECK (relation_type IN ('source', 'related', 'supports')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(finding_id, risk_id)
  );

  CREATE INDEX IF NOT EXISTS idx_finding_risks_finding ON finding_risks(finding_id);
  CREATE INDEX IF NOT EXISTS idx_finding_risks_risk ON finding_risks(risk_id);

  -- Audit ↔ Requirement (Criteria) M2M table
  CREATE TABLE IF NOT EXISTS audit_criteria (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    requirement_id INTEGER NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(audit_id, requirement_id)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_criteria_audit ON audit_criteria(audit_id);
  CREATE INDEX IF NOT EXISTS idx_audit_criteria_requirement ON audit_criteria(requirement_id);

  -- Finding ↔ Requirement (Breach) M2M table
  CREATE TABLE IF NOT EXISTS finding_requirements (
    id SERIAL PRIMARY KEY,
    finding_id INTEGER NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    requirement_id INTEGER NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(finding_id, requirement_id)
  );

  CREATE INDEX IF NOT EXISTS idx_finding_requirements_finding ON finding_requirements(finding_id);
  CREATE INDEX IF NOT EXISTS idx_finding_requirements_requirement ON finding_requirements(requirement_id);

  -- Finding ↔ ITSM Links table
  CREATE TABLE IF NOT EXISTS finding_itsm_links (
    id SERIAL PRIMARY KEY,
    finding_id INTEGER NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    itsm_type VARCHAR(20) NOT NULL CHECK (itsm_type IN ('incident', 'problem', 'change', 'request')),
    itsm_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(finding_id, itsm_type, itsm_id)
  );

  CREATE INDEX IF NOT EXISTS idx_finding_itsm_finding ON finding_itsm_links(finding_id);
  CREATE INDEX IF NOT EXISTS idx_finding_itsm_type ON finding_itsm_links(itsm_type);

  -- Audit ↔ CMDB/Service Scope Objects table
  CREATE TABLE IF NOT EXISTS audit_scope_objects (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    object_type VARCHAR(20) NOT NULL CHECK (object_type IN ('service', 'application', 'server', 'database', 'network', 'other')),
    object_id VARCHAR(255) NOT NULL,
    object_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(audit_id, object_type, object_id)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_scope_audit ON audit_scope_objects(audit_id);
  CREATE INDEX IF NOT EXISTS idx_audit_scope_type ON audit_scope_objects(object_type);
`;

// =============================================================================
// Permissions
// =============================================================================

const PHASE4_PERMISSIONS = [
  // Finding permissions
  { key: 'findings.read', name: 'Read Findings', description: 'View audit findings', module: 'audit' },
  { key: 'findings.write', name: 'Write Findings', description: 'Create and update audit findings', module: 'audit' },
  { key: 'findings.delete', name: 'Delete Findings', description: 'Delete audit findings', module: 'audit' },
  { key: 'findings.close', name: 'Close Findings', description: 'Close audit findings (requires CAPA validation)', module: 'audit' },
  
  // CAPA permissions
  { key: 'capas.read', name: 'Read CAPAs', description: 'View corrective/preventive actions', module: 'audit' },
  { key: 'capas.write', name: 'Write CAPAs', description: 'Create and update CAPAs', module: 'audit' },
  { key: 'capas.delete', name: 'Delete CAPAs', description: 'Delete CAPAs', module: 'audit' },
  { key: 'capas.validate', name: 'Validate CAPAs', description: 'Validate or reject CAPA implementation', module: 'audit' },
  
  // Evidence permissions
  { key: 'evidence.read', name: 'Read Evidence', description: 'View audit evidence', module: 'audit' },
  { key: 'evidence.write', name: 'Write Evidence', description: 'Create and update evidence records', module: 'audit' },
  { key: 'evidence.delete', name: 'Delete Evidence', description: 'Delete evidence records', module: 'audit' }
];

const PHASE4_ROLE_PERMISSIONS = {
  admin: [
    'findings.read', 'findings.write', 'findings.delete', 'findings.close',
    'capas.read', 'capas.write', 'capas.delete', 'capas.validate',
    'evidence.read', 'evidence.write', 'evidence.delete'
  ],
  manager: [
    'findings.read', 'findings.write', 'findings.close',
    'capas.read', 'capas.write', 'capas.validate',
    'evidence.read', 'evidence.write'
  ],
  user: [
    'findings.read',
    'capas.read', 'capas.write',
    'evidence.read', 'evidence.write'
  ]
};

// =============================================================================
// ACL Rules
// =============================================================================

const PHASE4_ACL_RULES = [
  // Finding ACL rules
  {
    name: 'Owner can edit own findings',
    table_name: 'findings',
    effect: 'allow',
    conditions: JSON.stringify({ owner_id: '{{user.id}}' }),
    fields: null,
    actions: 'read,write',
    priority: 10
  },
  {
    name: 'Auditors can create findings',
    table_name: 'findings',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager'] }),
    fields: null,
    actions: 'read,write,delete',
    priority: 8
  },
  {
    name: 'Hide root cause from standard users',
    table_name: 'findings',
    effect: 'deny',
    conditions: JSON.stringify({ role: 'user' }),
    fields: JSON.stringify(['root_cause', 'management_response']),
    actions: 'read',
    priority: 5
  },
  
  // CAPA ACL rules
  {
    name: 'Owner can edit own CAPAs',
    table_name: 'capas',
    effect: 'allow',
    conditions: JSON.stringify({ owner_id: '{{user.id}}' }),
    fields: null,
    actions: 'read,write',
    priority: 10
  },
  {
    name: 'Auditees can update CAPA status',
    table_name: 'capas',
    effect: 'allow',
    conditions: JSON.stringify({ role: 'user' }),
    fields: JSON.stringify(['status', 'description']),
    actions: 'write',
    priority: 8
  },
  {
    name: 'Only validators can change validation status',
    table_name: 'capas',
    effect: 'deny',
    conditions: JSON.stringify({ role: 'user' }),
    fields: JSON.stringify(['validation_status', 'validation_date', 'validated_by']),
    actions: 'write',
    priority: 15
  },
  
  // Evidence ACL rules
  {
    name: 'Uploader can edit own evidence',
    table_name: 'evidence',
    effect: 'allow',
    conditions: JSON.stringify({ uploaded_by: '{{user.id}}' }),
    fields: null,
    actions: 'read,write',
    priority: 10
  },
  {
    name: 'All users can upload evidence',
    table_name: 'evidence',
    effect: 'allow',
    conditions: JSON.stringify({ role: ['admin', 'manager', 'user'] }),
    fields: null,
    actions: 'read,write',
    priority: 5
  }
];

// =============================================================================
// Form Layouts
// =============================================================================

const PHASE4_FORM_LAYOUTS = [
  // Finding form layouts
  {
    table_name: 'findings',
    role: 'user',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Finding Details',
          fields: ['title', 'description', 'severity', 'status']
        },
        {
          title: 'Recommendation',
          fields: ['recommendation']
        }
      ],
      hiddenFields: ['root_cause', 'management_response', 'owner_id', 'created_by'],
      readonlyFields: ['status', 'severity', 'created_at', 'updated_at']
    })
  },
  {
    table_name: 'findings',
    role: 'manager',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Finding Details',
          fields: ['title', 'description', 'severity', 'status']
        },
        {
          title: 'Analysis',
          fields: ['root_cause', 'recommendation']
        },
        {
          title: 'Response',
          fields: ['management_response', 'owner_id']
        }
      ],
      hiddenFields: [],
      readonlyFields: ['created_at', 'updated_at', 'created_by']
    })
  },
  {
    table_name: 'findings',
    role: 'admin',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Finding Details',
          fields: ['title', 'description', 'severity', 'status', 'audit_id']
        },
        {
          title: 'Analysis',
          fields: ['root_cause', 'recommendation']
        },
        {
          title: 'Response',
          fields: ['management_response', 'owner_id']
        },
        {
          title: 'Metadata',
          fields: ['created_by', 'created_at', 'updated_at']
        }
      ],
      hiddenFields: [],
      readonlyFields: ['created_at', 'updated_at']
    })
  },
  
  // CAPA form layouts
  {
    table_name: 'capas',
    role: 'user',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'CAPA Details',
          fields: ['title', 'description', 'type', 'status']
        },
        {
          title: 'Timeline',
          fields: ['due_date']
        }
      ],
      hiddenFields: ['validation_status', 'validation_date', 'validated_by', 'extended_due_date', 'extension_reason'],
      readonlyFields: ['type', 'created_at', 'updated_at']
    })
  },
  {
    table_name: 'capas',
    role: 'manager',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'CAPA Details',
          fields: ['title', 'description', 'type', 'status']
        },
        {
          title: 'Timeline',
          fields: ['due_date', 'extended_due_date', 'extension_reason']
        },
        {
          title: 'Validation',
          fields: ['validation_status', 'validation_date', 'validated_by']
        },
        {
          title: 'Assignment',
          fields: ['owner_id']
        }
      ],
      hiddenFields: [],
      readonlyFields: ['created_at', 'updated_at', 'created_by']
    })
  },
  
  // Evidence form layouts
  {
    table_name: 'evidence',
    role: 'user',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Evidence Details',
          fields: ['title', 'description', 'type']
        },
        {
          title: 'Reference',
          fields: ['storage_type', 'storage_ref', 'external_system', 'external_id']
        }
      ],
      hiddenFields: [],
      readonlyFields: ['uploaded_by', 'uploaded_at', 'created_at', 'updated_at']
    })
  },
  {
    table_name: 'evidence',
    role: 'manager',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Evidence Details',
          fields: ['title', 'description', 'type']
        },
        {
          title: 'Reference',
          fields: ['storage_type', 'storage_ref', 'external_system', 'external_id']
        },
        {
          title: 'Metadata',
          fields: ['uploaded_by', 'uploaded_at']
        }
      ],
      hiddenFields: [],
      readonlyFields: ['uploaded_at', 'created_at', 'updated_at']
    })
  }
];

// =============================================================================
// UI Policies
// =============================================================================

const PHASE4_UI_POLICIES = [
  // Finding UI policies
  {
    name: 'Make fields readonly when finding is closed',
    table_name: 'findings',
    condition: JSON.stringify({ field: 'status', operator: 'equals', value: 'closed' }),
    actions: JSON.stringify([
      { type: 'readonly', fields: ['title', 'description', 'severity', 'root_cause', 'recommendation', 'management_response', 'owner_id'] }
    ]),
    priority: 10
  },
  {
    name: 'Require root cause for high severity findings',
    table_name: 'findings',
    condition: JSON.stringify({ field: 'severity', operator: 'in', value: ['high', 'critical'] }),
    actions: JSON.stringify([
      { type: 'mandatory', fields: ['root_cause', 'recommendation'] }
    ]),
    priority: 8
  },
  {
    name: 'Make finding title mandatory',
    table_name: 'findings',
    condition: JSON.stringify({ always: true }),
    actions: JSON.stringify([{ type: 'mandatory', fields: ['title'] }]),
    priority: 1
  },
  
  // CAPA UI policies
  {
    name: 'Make fields readonly when CAPA is validated',
    table_name: 'capas',
    condition: JSON.stringify({ field: 'validation_status', operator: 'equals', value: 'validated' }),
    actions: JSON.stringify([
      { type: 'readonly', fields: ['title', 'description', 'type', 'status', 'due_date', 'owner_id'] }
    ]),
    priority: 10
  },
  {
    name: 'Require extension reason when extending due date',
    table_name: 'capas',
    condition: JSON.stringify({ field: 'extended_due_date', operator: 'is_not_null' }),
    actions: JSON.stringify([
      { type: 'mandatory', fields: ['extension_reason'] }
    ]),
    priority: 8
  },
  {
    name: 'Make CAPA title and due date mandatory',
    table_name: 'capas',
    condition: JSON.stringify({ always: true }),
    actions: JSON.stringify([{ type: 'mandatory', fields: ['title', 'due_date'] }]),
    priority: 1
  },
  
  // Evidence UI policies
  {
    name: 'Make evidence title mandatory',
    table_name: 'evidence',
    condition: JSON.stringify({ always: true }),
    actions: JSON.stringify([{ type: 'mandatory', fields: ['title'] }]),
    priority: 1
  },
  {
    name: 'Require storage ref for link type',
    table_name: 'evidence',
    condition: JSON.stringify({ field: 'storage_type', operator: 'equals', value: 'link' }),
    actions: JSON.stringify([
      { type: 'mandatory', fields: ['storage_ref'] }
    ]),
    priority: 8
  },
  {
    name: 'Require external system for external type',
    table_name: 'evidence',
    condition: JSON.stringify({ field: 'storage_type', operator: 'equals', value: 'external' }),
    actions: JSON.stringify([
      { type: 'mandatory', fields: ['external_system', 'external_id'] }
    ]),
    priority: 8
  }
];

// =============================================================================
// Sample Data
// =============================================================================

const SAMPLE_FINDINGS = [
  {
    title: 'Inadequate Access Control Documentation',
    description: 'Access control policies are not adequately documented, leading to inconsistent application across departments.',
    severity: 'high',
    status: 'action_agreed',
    root_cause: 'Lack of centralized policy management and outdated documentation practices.',
    recommendation: 'Implement a centralized access control policy repository with version control and regular review cycles.'
  },
  {
    title: 'Missing Encryption for Data at Rest',
    description: 'Sensitive customer data stored in the legacy database is not encrypted at rest.',
    severity: 'critical',
    status: 'in_progress',
    root_cause: 'Legacy system limitations and lack of encryption requirements in original design.',
    recommendation: 'Implement transparent data encryption (TDE) for the database and migrate sensitive data to encrypted storage.'
  },
  {
    title: 'Incomplete Audit Trail',
    description: 'User activity logs do not capture all required events for compliance purposes.',
    severity: 'medium',
    status: 'draft',
    root_cause: 'Logging configuration was not updated when new features were added.',
    recommendation: 'Review and update logging configuration to capture all security-relevant events.'
  }
];

const SAMPLE_CAPAS = [
  {
    title: 'Document Access Control Policies',
    description: 'Create comprehensive access control policy documentation covering all systems and departments.',
    type: 'corrective',
    status: 'in_progress',
    validation_status: 'not_validated',
    due_date: '2025-01-31'
  },
  {
    title: 'Implement Database Encryption',
    description: 'Deploy transparent data encryption for the legacy database system.',
    type: 'corrective',
    status: 'not_started',
    validation_status: 'not_validated',
    due_date: '2025-02-28'
  },
  {
    title: 'Establish Policy Review Process',
    description: 'Implement quarterly policy review process to prevent documentation drift.',
    type: 'preventive',
    status: 'not_started',
    validation_status: 'not_validated',
    due_date: '2025-03-15'
  }
];

// =============================================================================
// Migration Function
// =============================================================================

async function runMigration() {
  console.log('Starting Platform Core Phase 4 migration...');
  
  try {
    await db.init();
    
    // Create tables
    console.log('Creating Phase 4 tables...');
    const schema = db.isPostgres() ? PG_SCHEMA : SQLITE_SCHEMA;
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.run(stmt);
      }
    }
    console.log('Phase 4 tables created successfully.');
    
    // Seed permissions
    console.log('Seeding Phase 4 permissions...');
    for (const perm of PHASE4_PERMISSIONS) {
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
    console.log('Phase 4 permissions seeded.');
    
    // Seed role permissions
    console.log('Seeding Phase 4 role permissions...');
    for (const [role, permKeys] of Object.entries(PHASE4_ROLE_PERMISSIONS)) {
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
    console.log('Phase 4 role permissions seeded.');
    
    // Seed ACL rules
    console.log('Seeding Phase 4 ACL rules...');
    for (const rule of PHASE4_ACL_RULES) {
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
    console.log('Phase 4 ACL rules seeded.');
    
    // Seed form layouts
    console.log('Seeding Phase 4 form layouts...');
    for (const layout of PHASE4_FORM_LAYOUTS) {
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
    console.log('Phase 4 form layouts seeded.');
    
    // Seed UI policies
    console.log('Seeding Phase 4 UI policies...');
    for (const policy of PHASE4_UI_POLICIES) {
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
    console.log('Phase 4 UI policies seeded.');
    
    // Seed sample data (only if audits exist)
    console.log('Checking for existing audits to seed sample findings...');
    const audit = await db.get('SELECT id FROM audits LIMIT 1');
    if (audit) {
      console.log('Seeding sample findings and CAPAs...');
      
      // Get first user for owner_id
      const user = await db.get('SELECT id FROM users LIMIT 1');
      const ownerId = user ? user.id : null;
      
      for (let i = 0; i < SAMPLE_FINDINGS.length; i++) {
        const finding = SAMPLE_FINDINGS[i];
        const placeholder = db.isPostgres() ? '$1' : '?';
        const existing = await db.get(
          `SELECT id FROM findings WHERE title = ${placeholder}`,
          [finding.title]
        );
        if (!existing) {
          let findingId;
          if (db.isPostgres()) {
            const result = await db.run(
              `INSERT INTO findings (audit_id, title, description, severity, status, root_cause, recommendation, owner_id, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
              [audit.id, finding.title, finding.description, finding.severity, finding.status, finding.root_cause, finding.recommendation, ownerId, ownerId]
            );
            findingId = result.lastID;
          } else {
            const result = await db.run(
              `INSERT INTO findings (audit_id, title, description, severity, status, root_cause, recommendation, owner_id, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [audit.id, finding.title, finding.description, finding.severity, finding.status, finding.root_cause, finding.recommendation, ownerId, ownerId]
            );
            findingId = result.lastID;
          }
          
          // Add CAPA for this finding if available
          if (i < SAMPLE_CAPAS.length && findingId) {
            const capa = SAMPLE_CAPAS[i];
            if (db.isPostgres()) {
              await db.run(
                `INSERT INTO capas (finding_id, title, description, type, status, validation_status, due_date, owner_id, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [findingId, capa.title, capa.description, capa.type, capa.status, capa.validation_status, capa.due_date, ownerId, ownerId]
              );
            } else {
              await db.run(
                `INSERT INTO capas (finding_id, title, description, type, status, validation_status, due_date, owner_id, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [findingId, capa.title, capa.description, capa.type, capa.status, capa.validation_status, capa.due_date, ownerId, ownerId]
              );
            }
          }
        }
      }
      console.log('Sample findings and CAPAs seeded.');
    } else {
      console.log('No audits found, skipping sample data seeding.');
    }
    
    console.log('\n===========================================');
    console.log('Platform Core Phase 4 migration completed!');
    console.log('===========================================');
    console.log('Created tables:');
    console.log('  - findings');
    console.log('  - capas');
    console.log('  - evidence');
    console.log('  - finding_risks');
    console.log('  - audit_criteria');
    console.log('  - finding_requirements');
    console.log('  - finding_itsm_links');
    console.log('  - audit_scope_objects');
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
