import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure required extensions
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm";');
    // policies
    const hasPolicies = await queryRunner.hasTable('policies');
    if (!hasPolicies) {
      await queryRunner.createTable(new Table({
        name: 'policies',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'name', type: 'varchar', length: '160', isNullable: false },
          { name: 'code', type: 'varchar', length: '64', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', isNullable: false, default: `'DRAFT'` },
          { name: 'owner', type: 'varchar', length: '80', isNullable: true },
          { name: 'version', type: 'varchar', length: '32', isNullable: true },
          { name: 'effectiveDate', type: 'date', isNullable: true },
          { name: 'reviewDate', type: 'date', isNullable: true },
          { name: 'tags', type: 'text', isNullable: true },
          { name: 'createdAt', type: 'timestamp with time zone', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp with time zone', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp with time zone', isNullable: true },
        ]
      }));
      await queryRunner.createIndex('policies', new TableIndex({ name: 'IDX_policies_code', columnNames: ['code'], isUnique: true }));
    } else {
      // Ensure columns exist
      const cols = await queryRunner.getTable('policies');
      const ensure = async (c: TableColumn) => { if (!cols?.columns?.find(x => x.name === c.name)) await queryRunner.addColumn('policies', c); };
      await ensure(new TableColumn({ name: 'deletedAt', type: 'timestamp with time zone', isNullable: true }));
      const codeIdx = cols?.indices?.find(i => i.columnNames.join(',') === 'code');
      if (!codeIdx) await queryRunner.createIndex('policies', new TableIndex({ name: 'IDX_policies_code', columnNames: ['code'], isUnique: true }));
    }

    // gov_policies
    const hasGov = await queryRunner.hasTable('gov_policies');
    if (!hasGov) {
      await queryRunner.createTable(new Table({
        name: 'gov_policies',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'title', type: 'varchar', length: '160' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'category', type: 'varchar', length: '80', isNullable: true },
          { name: 'version', type: 'varchar', length: '32', default: `'1.0'` },
          { name: 'status', type: 'varchar', length: '32', default: `'draft'` },
          { name: 'effective_date', type: 'date', isNullable: true },
          { name: 'review_date', type: 'date', isNullable: true },
          { name: 'owner_first_name', type: 'varchar', length: '80', isNullable: true },
          { name: 'owner_last_name', type: 'varchar', length: '80', isNullable: true },
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp with time zone', isNullable: true },
        ]
      }));
      await queryRunner.createIndex('gov_policies', new TableIndex({ name: 'IDX_gov_title', columnNames: ['title'] }));
      await queryRunner.createIndex('gov_policies', new TableIndex({ name: 'IDX_gov_category', columnNames: ['category'] }));
    }

    // risks
    const hasRisks = await queryRunner.hasTable('risks');
    if (!hasRisks) {
      await queryRunner.createTable(new Table({
        name: 'risks',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'title', type: 'varchar', length: '160' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'category', type: 'varchar', length: '80', isNullable: true },
          { name: 'severity', type: 'varchar', length: '32', default: `'Medium'` },
          { name: 'likelihood', type: 'varchar', length: '32', default: `'Medium'` },
          { name: 'impact', type: 'varchar', length: '32', default: `'Medium'` },
          { name: 'risk_score', type: 'int', default: 0 },
          { name: 'status', type: 'varchar', length: '32', default: `'open'` },
          { name: 'mitigation_plan', type: 'text', isNullable: true },
          { name: 'due_date', type: 'date', isNullable: true },
          { name: 'owner_first_name', type: 'varchar', length: '80', isNullable: true },
          { name: 'owner_last_name', type: 'varchar', length: '80', isNullable: true },
          { name: 'assigned_first_name', type: 'varchar', length: '80', isNullable: true },
          { name: 'assigned_last_name', type: 'varchar', length: '80', isNullable: true },
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp with time zone', isNullable: true },
        ]
      }));
      await queryRunner.createIndex('risks', new TableIndex({ name: 'IDX_risk_title', columnNames: ['title'] }));
      await queryRunner.createIndex('risks', new TableIndex({ name: 'IDX_risk_category', columnNames: ['category'] }));
      await queryRunner.createIndex('risks', new TableIndex({ name: 'IDX_risk_severity', columnNames: ['severity'] }));
      await queryRunner.createIndex('risks', new TableIndex({ name: 'IDX_risk_status', columnNames: ['status'] }));
    }

    // requirements
    const hasReq = await queryRunner.hasTable('requirements');
    if (!hasReq) {
      await queryRunner.createTable(new Table({
        name: 'requirements',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'title', type: 'varchar', length: '160' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'regulation', type: 'varchar', length: '120', isNullable: true },
          { name: 'category', type: 'varchar', length: '80', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: `'pending'` },
          { name: 'due_date', type: 'date', isNullable: true },
          { name: 'evidence', type: 'text', isNullable: true },
          { name: 'owner_first_name', type: 'varchar', length: '80', isNullable: true },
          { name: 'owner_last_name', type: 'varchar', length: '80', isNullable: true },
          { name: 'assigned_first_name', type: 'varchar', length: '80', isNullable: true },
          { name: 'assigned_last_name', type: 'varchar', length: '80', isNullable: true },
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp with time zone', isNullable: true },
        ]
      }));
      await queryRunner.createIndex('requirements', new TableIndex({ name: 'IDX_req_title', columnNames: ['title'] }));
      await queryRunner.createIndex('requirements', new TableIndex({ name: 'IDX_req_regulation', columnNames: ['regulation'] }));
      await queryRunner.createIndex('requirements', new TableIndex({ name: 'IDX_req_status', columnNames: ['status'] }));
    }

    // Optional trigram indexes for ILIKE performance
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "GIN_gov_title_trgm" ON "gov_policies" USING GIN ("title" gin_trgm_ops);');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "GIN_risk_title_trgm" ON "risks" USING GIN ("title" gin_trgm_ops);');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "GIN_req_title_trgm" ON "requirements" USING GIN ("title" gin_trgm_ops);');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('requirements', true);
    await queryRunner.dropTable('risks', true);
    await queryRunner.dropTable('gov_policies', true);
    // policies kept; typically don't drop core table in down, but do for symmetry
    await queryRunner.dropTable('policies', true);
  }
}


