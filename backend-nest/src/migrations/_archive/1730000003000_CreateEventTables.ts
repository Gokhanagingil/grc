import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class CreateEventTables1730000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // event_raw table
    await queryRunner.createTable(
      new Table({
        name: 'event_raw',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'source',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'received_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'fingerprint',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'ingest_meta',
            type: 'jsonb',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'event_raw',
      new TableIndex({
        name: 'idx_event_raw_tenant_received',
        columnNames: ['tenant_id', 'received_at'],
      }),
    );

    await queryRunner.createIndex(
      'event_raw',
      new TableIndex({
        name: 'idx_event_raw_fingerprint',
        columnNames: ['fingerprint'],
      }),
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_event_raw_idempotency 
      ON event_raw(tenant_id, idempotency_key) 
      WHERE idempotency_key IS NOT NULL;
    `);

    // event_normalized table
    await queryRunner.createTable(
      new Table({
        name: 'event_normalized',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'event_time',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'severity',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'info'",
          },
          {
            name: 'category',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'resource',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'labels',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'raw_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'event_normalized',
      new TableIndex({
        name: 'idx_event_normalized_tenant_time',
        columnNames: ['tenant_id', 'event_time'],
      }),
    );

    await queryRunner.createIndex(
      'event_normalized',
      new TableIndex({
        name: 'idx_event_normalized_severity',
        columnNames: ['severity'],
      }),
    );

    await queryRunner.createIndex(
      'event_normalized',
      new TableIndex({
        name: 'idx_event_normalized_category',
        columnNames: ['category'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('event_normalized', true);
    await queryRunner.dropTable('event_raw', true);
  }
}
