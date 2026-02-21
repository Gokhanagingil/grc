import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMitigationActionsTable1741200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS itsm_change_mitigation_actions (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id uuid NOT NULL REFERENCES nest_tenants(id),
        change_id uuid NOT NULL,
        catalog_risk_id uuid,
        binding_id uuid,
        action_type varchar(50) NOT NULL DEFAULT 'CHANGE_TASK',
        status varchar(50) NOT NULL DEFAULT 'OPEN',
        title varchar(500) NOT NULL,
        description text,
        owner_id uuid,
        due_date timestamptz,
        comment text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid,
        updated_by uuid,
        is_deleted boolean NOT NULL DEFAULT false
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mitigation_actions_tenant_change
        ON itsm_change_mitigation_actions (tenant_id, change_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mitigation_actions_tenant_risk
        ON itsm_change_mitigation_actions (tenant_id, catalog_risk_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mitigation_actions_created_at
        ON itsm_change_mitigation_actions (created_at);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mitigation_actions_is_deleted
        ON itsm_change_mitigation_actions (is_deleted);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS itsm_change_mitigation_actions;
    `);
  }
}
