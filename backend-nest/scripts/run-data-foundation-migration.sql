-- Data Foundation Tables Migration
-- Run this SQL script directly if migration command fails

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS ltree;

-- 1. risk_category
CREATE TABLE IF NOT EXISTS app.risk_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_category_tenant ON app.risk_category (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_category_code_tenant ON app.risk_category (code, tenant_id);

-- 2. risk_catalog
CREATE TABLE IF NOT EXISTS app.risk_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID,
  default_likelihood INT DEFAULT 3,
  default_impact INT DEFAULT 3,
  control_refs JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  schema_version INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_catalog_tenant ON app.risk_catalog (tenant_id);
CREATE INDEX IF NOT EXISTS idx_risk_catalog_category ON app.risk_catalog (category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_catalog_code_tenant ON app.risk_catalog (code, tenant_id);
CREATE INDEX IF NOT EXISTS idx_risk_catalog_tags_gin ON app.risk_catalog USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_risk_catalog_control_refs_gin ON app.risk_catalog USING GIN (control_refs);

ALTER TABLE app.risk_catalog ADD CONSTRAINT fk_risk_catalog_category 
  FOREIGN KEY (category_id) REFERENCES app.risk_category(id) ON DELETE SET NULL;

-- 3. standard
CREATE TABLE IF NOT EXISTS app.standard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  version VARCHAR(20),
  publisher VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_standard_tenant ON app.standard (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_standard_code_tenant ON app.standard (code, tenant_id);

-- 4. standard_clause
CREATE TABLE IF NOT EXISTS app.standard_clause (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  standard_id UUID NOT NULL,
  clause_code VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  text TEXT,
  parent_id UUID,
  path VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_standard_clause_tenant ON app.standard_clause (tenant_id);
CREATE INDEX IF NOT EXISTS idx_standard_clause_standard ON app.standard_clause (standard_id);
CREATE INDEX IF NOT EXISTS idx_standard_clause_parent ON app.standard_clause (parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_standard_clause_code_tenant ON app.standard_clause (clause_code, tenant_id);
CREATE INDEX IF NOT EXISTS idx_standard_clause_path ON app.standard_clause (path);

ALTER TABLE app.standard_clause ADD CONSTRAINT fk_standard_clause_standard 
  FOREIGN KEY (standard_id) REFERENCES app.standard(id) ON DELETE CASCADE;
ALTER TABLE app.standard_clause ADD CONSTRAINT fk_standard_clause_parent 
  FOREIGN KEY (parent_id) REFERENCES app.standard_clause(id) ON DELETE CASCADE;

-- 5. standard_mapping
CREATE TABLE IF NOT EXISTS app.standard_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  from_clause_id UUID NOT NULL,
  to_clause_id UUID NOT NULL,
  relation VARCHAR(20) DEFAULT 'similar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_standard_mapping_tenant ON app.standard_mapping (tenant_id);
CREATE INDEX IF NOT EXISTS idx_standard_mapping_from ON app.standard_mapping (from_clause_id);
CREATE INDEX IF NOT EXISTS idx_standard_mapping_to ON app.standard_mapping (to_clause_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_standard_mapping_unique ON app.standard_mapping (from_clause_id, to_clause_id, tenant_id);

ALTER TABLE app.standard_mapping ADD CONSTRAINT fk_standard_mapping_from 
  FOREIGN KEY (from_clause_id) REFERENCES app.standard_clause(id) ON DELETE CASCADE;
ALTER TABLE app.standard_mapping ADD CONSTRAINT fk_standard_mapping_to 
  FOREIGN KEY (to_clause_id) REFERENCES app.standard_clause(id) ON DELETE CASCADE;

-- 6. control_library
CREATE TABLE IF NOT EXISTS app.control_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  family VARCHAR(100),
  references JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_library_tenant ON app.control_library (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_control_library_code_tenant ON app.control_library (code, tenant_id);
CREATE INDEX IF NOT EXISTS idx_control_library_family ON app.control_library (family);
CREATE INDEX IF NOT EXISTS idx_control_library_references_gin ON app.control_library USING GIN (references);

-- 7. control_to_clause
CREATE TABLE IF NOT EXISTS app.control_to_clause (
  control_id UUID NOT NULL,
  clause_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (control_id, clause_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_control_to_clause_tenant ON app.control_to_clause (tenant_id);
CREATE INDEX IF NOT EXISTS idx_control_to_clause_control ON app.control_to_clause (control_id);
CREATE INDEX IF NOT EXISTS idx_control_to_clause_clause ON app.control_to_clause (clause_id);

ALTER TABLE app.control_to_clause ADD CONSTRAINT fk_control_to_clause_control 
  FOREIGN KEY (control_id) REFERENCES app.control_library(id) ON DELETE CASCADE;
ALTER TABLE app.control_to_clause ADD CONSTRAINT fk_control_to_clause_clause 
  FOREIGN KEY (clause_id) REFERENCES app.standard_clause(id) ON DELETE CASCADE;

-- 8. risk_to_control
CREATE TABLE IF NOT EXISTS app.risk_to_control (
  risk_id UUID NOT NULL,
  control_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (risk_id, control_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_risk_to_control_tenant ON app.risk_to_control (tenant_id);
CREATE INDEX IF NOT EXISTS idx_risk_to_control_risk ON app.risk_to_control (risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_to_control_control ON app.risk_to_control (control_id);

ALTER TABLE app.risk_to_control ADD CONSTRAINT fk_risk_to_control_risk 
  FOREIGN KEY (risk_id) REFERENCES app.risk_catalog(id) ON DELETE CASCADE;
ALTER TABLE app.risk_to_control ADD CONSTRAINT fk_risk_to_control_control 
  FOREIGN KEY (control_id) REFERENCES app.control_library(id) ON DELETE CASCADE;

