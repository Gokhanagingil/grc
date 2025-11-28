import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateDataFoundationTables1730000004000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable ltree extension if needed (for hierarchical paths)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS ltree;`);

    // 1. risk_category
    await queryRunner.createTable(
      new Table({
        name: 'risk_category',
        schema: 'app',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'code', type: 'varchar', length: '50', isNullable: false },
          { name: 'name', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'app.risk_category',
      new TableIndex({
        name: 'idx_risk_category_tenant',
        columnNames: ['tenant_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.risk_category',
      new TableIndex({
        name: 'idx_risk_category_code_tenant',
        columnNames: ['code', 'tenant_id'],
        isUnique: true,
      }),
    );

    // 2. risk_catalog
    await queryRunner.createTable(
      new Table({
        name: 'risk_catalog',
        schema: 'app',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'code', type: 'varchar', length: '100', isNullable: false },
          { name: 'name', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'category_id', type: 'uuid', isNullable: true },
          {
            name: 'default_likelihood',
            type: 'int',
            default: 3,
            comment: 'Default likelihood 1-5',
          },
          {
            name: 'default_impact',
            type: 'int',
            default: 3,
            comment: 'Default impact 1-5',
          },
          {
            name: 'control_refs',
            type: 'jsonb',
            isNullable: true,
            default: "'[]'::jsonb",
          },
          {
            name: 'tags',
            type: 'jsonb',
            isNullable: true,
            default: "'[]'::jsonb",
          },
          { name: 'schema_version', type: 'int', default: 1 },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'app.risk_catalog',
      new TableIndex({
        name: 'idx_risk_catalog_tenant',
        columnNames: ['tenant_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.risk_catalog',
      new TableIndex({
        name: 'idx_risk_catalog_category',
        columnNames: ['category_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.risk_catalog',
      new TableIndex({
        name: 'idx_risk_catalog_code_tenant',
        columnNames: ['code', 'tenant_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'app.risk_catalog',
      new TableIndex({
        name: 'idx_risk_catalog_tags',
        columnNames: ['tags'],
        isUnique: false,
      }),
    );
    await queryRunner.createIndex(
      'app.risk_catalog',
      new TableIndex({
        name: 'idx_risk_catalog_control_refs',
        columnNames: ['control_refs'],
        isUnique: false,
      }),
    );
    await queryRunner.query(
      `CREATE INDEX idx_risk_catalog_tags_gin ON app.risk_catalog USING GIN (tags);`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_risk_catalog_control_refs_gin ON app.risk_catalog USING GIN (control_refs);`,
    );
    await queryRunner.createForeignKey(
      'app.risk_catalog',
      new TableForeignKey({
        columnNames: ['category_id'],
        referencedTableName: 'risk_category',
        referencedSchema: 'app',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // 3. standard
    await queryRunner.createTable(
      new Table({
        name: 'standard',
        schema: 'app',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'code', type: 'varchar', length: '50', isNullable: false },
          { name: 'name', type: 'text', isNullable: false },
          { name: 'version', type: 'varchar', length: '20', isNullable: true },
          {
            name: 'publisher',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'app.standard',
      new TableIndex({
        name: 'idx_standard_tenant',
        columnNames: ['tenant_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.standard',
      new TableIndex({
        name: 'idx_standard_code_tenant',
        columnNames: ['code', 'tenant_id'],
        isUnique: true,
      }),
    );

    // 4. standard_clause
    await queryRunner.createTable(
      new Table({
        name: 'standard_clause',
        schema: 'app',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'standard_id', type: 'uuid', isNullable: false },
          {
            name: 'clause_code',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'text', type: 'text', isNullable: true },
          { name: 'parent_id', type: 'uuid', isNullable: true },
          {
            name: 'path',
            type: 'varchar',
            length: '500',
            isNullable: true,
            comment: 'Path like ISO27001:5.1.1',
          },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'app.standard_clause',
      new TableIndex({
        name: 'idx_standard_clause_tenant',
        columnNames: ['tenant_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.standard_clause',
      new TableIndex({
        name: 'idx_standard_clause_standard',
        columnNames: ['standard_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.standard_clause',
      new TableIndex({
        name: 'idx_standard_clause_parent',
        columnNames: ['parent_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.standard_clause',
      new TableIndex({
        name: 'idx_standard_clause_code_tenant',
        columnNames: ['clause_code', 'tenant_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'app.standard_clause',
      new TableIndex({
        name: 'idx_standard_clause_path',
        columnNames: ['path'],
      }),
    );
    await queryRunner.createForeignKey(
      'app.standard_clause',
      new TableForeignKey({
        columnNames: ['standard_id'],
        referencedTableName: 'standard',
        referencedSchema: 'app',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'app.standard_clause',
      new TableForeignKey({
        columnNames: ['parent_id'],
        referencedTableName: 'standard_clause',
        referencedSchema: 'app',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 5. standard_mapping
    await queryRunner.createTable(
      new Table({
        name: 'standard_mapping',
        schema: 'app',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'from_clause_id', type: 'uuid', isNullable: false },
          { name: 'to_clause_id', type: 'uuid', isNullable: false },
          {
            name: 'relation',
            type: 'varchar',
            length: '20',
            default: "'similar'",
            comment: 'Enum: similar, overlap, supports',
          },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'app.standard_mapping',
      new TableIndex({
        name: 'idx_standard_mapping_tenant',
        columnNames: ['tenant_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.standard_mapping',
      new TableIndex({
        name: 'idx_standard_mapping_from',
        columnNames: ['from_clause_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.standard_mapping',
      new TableIndex({
        name: 'idx_standard_mapping_to',
        columnNames: ['to_clause_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.standard_mapping',
      new TableIndex({
        name: 'idx_standard_mapping_unique',
        columnNames: ['from_clause_id', 'to_clause_id', 'tenant_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createForeignKey(
      'app.standard_mapping',
      new TableForeignKey({
        columnNames: ['from_clause_id'],
        referencedTableName: 'standard_clause',
        referencedSchema: 'app',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'app.standard_mapping',
      new TableForeignKey({
        columnNames: ['to_clause_id'],
        referencedTableName: 'standard_clause',
        referencedSchema: 'app',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 6. control_library
    await queryRunner.createTable(
      new Table({
        name: 'control_library',
        schema: 'app',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'code', type: 'varchar', length: '100', isNullable: false },
          { name: 'name', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'family', type: 'varchar', length: '100', isNullable: true },
          {
            name: 'references',
            type: 'jsonb',
            isNullable: true,
            default: "'[]'::jsonb",
          },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'app.control_library',
      new TableIndex({
        name: 'idx_control_library_tenant',
        columnNames: ['tenant_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.control_library',
      new TableIndex({
        name: 'idx_control_library_code_tenant',
        columnNames: ['code', 'tenant_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'app.control_library',
      new TableIndex({
        name: 'idx_control_library_family',
        columnNames: ['family'],
      }),
    );
    await queryRunner.createIndex(
      'app.control_library',
      new TableIndex({
        name: 'idx_control_library_references',
        columnNames: ['references'],
        isUnique: false,
      }),
    );
    await queryRunner.query(
      `CREATE INDEX idx_control_library_references_gin ON app.control_library USING GIN (references);`,
    );

    // 7. control_to_clause (junction table)
    await queryRunner.createTable(
      new Table({
        name: 'control_to_clause',
        schema: 'app',
        columns: [
          { name: 'control_id', type: 'uuid', isPrimary: true },
          { name: 'clause_id', type: 'uuid', isPrimary: true },
          { name: 'tenant_id', type: 'uuid', isPrimary: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'app.control_to_clause',
      new TableIndex({
        name: 'idx_control_to_clause_tenant',
        columnNames: ['tenant_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.control_to_clause',
      new TableIndex({
        name: 'idx_control_to_clause_control',
        columnNames: ['control_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.control_to_clause',
      new TableIndex({
        name: 'idx_control_to_clause_clause',
        columnNames: ['clause_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.control_to_clause',
      new TableIndex({
        name: 'idx_control_to_clause_unique',
        columnNames: ['control_id', 'clause_id', 'tenant_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createForeignKey(
      'app.control_to_clause',
      new TableForeignKey({
        columnNames: ['control_id'],
        referencedTableName: 'control_library',
        referencedSchema: 'app',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'app.control_to_clause',
      new TableForeignKey({
        columnNames: ['clause_id'],
        referencedTableName: 'standard_clause',
        referencedSchema: 'app',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 8. risk_to_control (junction table)
    await queryRunner.createTable(
      new Table({
        name: 'risk_to_control',
        schema: 'app',
        columns: [
          { name: 'risk_id', type: 'uuid', isPrimary: true },
          { name: 'control_id', type: 'uuid', isPrimary: true },
          { name: 'tenant_id', type: 'uuid', isPrimary: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'app.risk_to_control',
      new TableIndex({
        name: 'idx_risk_to_control_tenant',
        columnNames: ['tenant_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.risk_to_control',
      new TableIndex({
        name: 'idx_risk_to_control_risk',
        columnNames: ['risk_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.risk_to_control',
      new TableIndex({
        name: 'idx_risk_to_control_control',
        columnNames: ['control_id'],
      }),
    );
    await queryRunner.createIndex(
      'app.risk_to_control',
      new TableIndex({
        name: 'idx_risk_to_control_unique',
        columnNames: ['risk_id', 'control_id', 'tenant_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createForeignKey(
      'app.risk_to_control',
      new TableForeignKey({
        columnNames: ['risk_id'],
        referencedTableName: 'risk_catalog',
        referencedSchema: 'app',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'app.risk_to_control',
      new TableForeignKey({
        columnNames: ['control_id'],
        referencedTableName: 'control_library',
        referencedSchema: 'app',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('app.risk_to_control', true);
    await queryRunner.dropTable('app.control_to_clause', true);
    await queryRunner.dropTable('app.control_library', true);
    await queryRunner.dropTable('app.standard_mapping', true);
    await queryRunner.dropTable('app.standard_clause', true);
    await queryRunner.dropTable('app.standard', true);
    await queryRunner.dropTable('app.risk_catalog', true);
    await queryRunner.dropTable('app.risk_category', true);
  }
}
