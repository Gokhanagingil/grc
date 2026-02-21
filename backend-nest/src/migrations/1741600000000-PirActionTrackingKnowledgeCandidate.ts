import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3: PIR + Action Tracking + Knowledge Candidate
 *
 * Creates:
 * - itsm_pirs table (post-incident reviews)
 * - itsm_pir_actions table (PIR action items)
 * - itsm_knowledge_candidates table (knowledge article candidates)
 * - Associated enums
 */
export class PirActionTrackingKnowledgeCandidate1741600000000 implements MigrationInterface {
  name = 'PirActionTrackingKnowledgeCandidate1741600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // === Create Enums ===
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE pir_status_enum AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'CLOSED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE pir_action_status_enum AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE pir_action_priority_enum AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE knowledge_candidate_status_enum AS ENUM ('DRAFT', 'REVIEWED', 'PUBLISHED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE knowledge_candidate_source_enum AS ENUM ('PIR', 'KNOWN_ERROR', 'PROBLEM');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // === Create itsm_pirs table ===
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS itsm_pirs (
        id uuid DEFAULT uuid_generate_v4() NOT NULL,
        tenant_id uuid NOT NULL,
        major_incident_id uuid NOT NULL,
        title varchar(255) NOT NULL,
        status pir_status_enum NOT NULL DEFAULT 'DRAFT',
        summary text,
        what_happened text,
        timeline_highlights text,
        root_causes text,
        what_worked_well text,
        what_did_not_work text,
        customer_impact text,
        detection_effectiveness text,
        response_effectiveness text,
        preventive_actions text,
        corrective_actions text,
        approved_by uuid,
        approved_at timestamptz,
        submitted_at timestamptz,
        closed_at timestamptz,
        metadata jsonb,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        is_deleted boolean NOT NULL DEFAULT false,
        CONSTRAINT pk_itsm_pirs PRIMARY KEY (id),
        CONSTRAINT fk_itsm_pirs_tenant FOREIGN KEY (tenant_id) REFERENCES nest_tenants(id)
      );
    `);

    // Indexes for itsm_pirs
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_itsm_pirs_tenant_mi ON itsm_pirs (tenant_id, major_incident_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_itsm_pirs_tenant_status ON itsm_pirs (tenant_id, status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_itsm_pirs_tenant_created ON itsm_pirs (tenant_id, created_at);`);

    // === Create itsm_pir_actions table ===
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS itsm_pir_actions (
        id uuid DEFAULT uuid_generate_v4() NOT NULL,
        tenant_id uuid NOT NULL,
        pir_id uuid NOT NULL,
        title varchar(255) NOT NULL,
        description text,
        owner_id uuid,
        due_date date,
        status pir_action_status_enum NOT NULL DEFAULT 'OPEN',
        priority pir_action_priority_enum NOT NULL DEFAULT 'MEDIUM',
        problem_id uuid,
        change_id uuid,
        risk_observation_id uuid,
        completed_at timestamptz,
        metadata jsonb,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        is_deleted boolean NOT NULL DEFAULT false,
        CONSTRAINT pk_itsm_pir_actions PRIMARY KEY (id),
        CONSTRAINT fk_itsm_pir_actions_tenant FOREIGN KEY (tenant_id) REFERENCES nest_tenants(id),
        CONSTRAINT fk_itsm_pir_actions_pir FOREIGN KEY (pir_id) REFERENCES itsm_pirs(id)
      );
    `);

    // Indexes for itsm_pir_actions
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_itsm_pir_actions_tenant_pir ON itsm_pir_actions (tenant_id, pir_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_itsm_pir_actions_tenant_status ON itsm_pir_actions (tenant_id, status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_itsm_pir_actions_tenant_owner ON itsm_pir_actions (tenant_id, owner_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_itsm_pir_actions_tenant_due ON itsm_pir_actions (tenant_id, due_date);`);

    // === Create itsm_knowledge_candidates table ===
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS itsm_knowledge_candidates (
        id uuid DEFAULT uuid_generate_v4() NOT NULL,
        tenant_id uuid NOT NULL,
        title varchar(255) NOT NULL,
        source_type knowledge_candidate_source_enum NOT NULL,
        source_id uuid NOT NULL,
        status knowledge_candidate_status_enum NOT NULL DEFAULT 'DRAFT',
        content jsonb,
        synopsis text,
        resolution text,
        root_cause_summary text,
        workaround text,
        symptoms text,
        reviewed_by uuid,
        reviewed_at timestamptz,
        published_at timestamptz,
        metadata jsonb,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        is_deleted boolean NOT NULL DEFAULT false,
        CONSTRAINT pk_itsm_knowledge_candidates PRIMARY KEY (id),
        CONSTRAINT fk_itsm_knowledge_candidates_tenant FOREIGN KEY (tenant_id) REFERENCES nest_tenants(id)
      );
    `);

    // Indexes for itsm_knowledge_candidates
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_itsm_kc_tenant_source ON itsm_knowledge_candidates (tenant_id, source_type, source_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_itsm_kc_tenant_status ON itsm_knowledge_candidates (tenant_id, status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_itsm_kc_tenant_created ON itsm_knowledge_candidates (tenant_id, created_at);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS itsm_knowledge_candidates CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS itsm_pir_actions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS itsm_pirs CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS knowledge_candidate_source_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS knowledge_candidate_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS pir_action_priority_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS pir_action_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS pir_status_enum;`);
  }
}
