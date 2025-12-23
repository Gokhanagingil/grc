import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create MFA Tables
 * 
 * Creates tables for Multi-Factor Authentication (MFA) support:
 * - user_mfa_settings: Per-user MFA configuration
 * - user_mfa_recovery_codes: Recovery codes for MFA reset
 */
export class CreateMfaTables1735000100000 implements MigrationInterface {
  name = 'CreateMfaTables1735000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_mfa_settings table
    await queryRunner.createTable(
      new Table({
        name: 'user_mfa_settings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'mfa_enabled',
            type: 'boolean',
            default: false,
          },
          {
            name: 'mfa_secret',
            type: 'varchar',
            length: '512',
            isNullable: true,
            comment: 'Encrypted TOTP secret',
          },
          {
            name: 'mfa_verified_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'When MFA was first verified/enabled',
          },
          {
            name: 'mfa_enforced',
            type: 'boolean',
            default: false,
            comment: 'Whether MFA is enforced by admin for this user',
          },
          {
            name: 'mfa_enforced_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'mfa_enforced_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'last_used_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create unique index on user_id
    await queryRunner.createIndex(
      'user_mfa_settings',
      new TableIndex({
        name: 'IDX_user_mfa_settings_user_id',
        columnNames: ['user_id'],
        isUnique: true,
      }),
    );

    // Create user_mfa_recovery_codes table
    await queryRunner.createTable(
      new Table({
        name: 'user_mfa_recovery_codes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'code_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Hashed recovery code',
          },
          {
            name: 'used_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create index on user_id for recovery codes
    await queryRunner.createIndex(
      'user_mfa_recovery_codes',
      new TableIndex({
        name: 'IDX_user_mfa_recovery_codes_user_id',
        columnNames: ['user_id'],
      }),
    );

    // Create tenant_security_settings table for tenant-level security configuration
    await queryRunner.createTable(
      new Table({
        name: 'tenant_security_settings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'mfa_required_for_admins',
            type: 'boolean',
            default: false,
            comment: 'Whether MFA is required for admin users',
          },
          {
            name: 'mfa_required_for_all',
            type: 'boolean',
            default: false,
            comment: 'Whether MFA is required for all users',
          },
          {
            name: 'password_min_length',
            type: 'int',
            default: 8,
          },
          {
            name: 'password_require_uppercase',
            type: 'boolean',
            default: true,
          },
          {
            name: 'password_require_lowercase',
            type: 'boolean',
            default: true,
          },
          {
            name: 'password_require_number',
            type: 'boolean',
            default: true,
          },
          {
            name: 'password_require_special',
            type: 'boolean',
            default: false,
          },
          {
            name: 'session_timeout_minutes',
            type: 'int',
            default: 1440,
            comment: 'Session timeout in minutes (default 24 hours)',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create unique index on tenant_id
    await queryRunner.createIndex(
      'tenant_security_settings',
      new TableIndex({
        name: 'IDX_tenant_security_settings_tenant_id',
        columnNames: ['tenant_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'tenant_security_settings',
      'IDX_tenant_security_settings_tenant_id',
    );
    await queryRunner.dropTable('tenant_security_settings');

    await queryRunner.dropIndex(
      'user_mfa_recovery_codes',
      'IDX_user_mfa_recovery_codes_user_id',
    );
    await queryRunner.dropTable('user_mfa_recovery_codes');

    await queryRunner.dropIndex(
      'user_mfa_settings',
      'IDX_user_mfa_settings_user_id',
    );
    await queryRunner.dropTable('user_mfa_settings');
  }
}
