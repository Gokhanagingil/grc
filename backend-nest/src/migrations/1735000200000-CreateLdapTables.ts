import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create LDAP Tables
 * 
 * Creates tables for LDAP/Active Directory integration:
 * - tenant_ldap_config: Per-tenant LDAP configuration
 * - ldap_group_role_mapping: Maps LDAP groups to platform roles
 */
export class CreateLdapTables1735000200000 implements MigrationInterface {
  name = 'CreateLdapTables1735000200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tenant_ldap_config table
    await queryRunner.createTable(
      new Table({
        name: 'tenant_ldap_config',
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
            name: 'enabled',
            type: 'boolean',
            default: false,
          },
          {
            name: 'host',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'LDAP server hostname or IP',
          },
          {
            name: 'port',
            type: 'int',
            default: 389,
            comment: 'LDAP server port (389 for LDAP, 636 for LDAPS)',
          },
          {
            name: 'use_ssl',
            type: 'boolean',
            default: false,
            comment: 'Whether to use LDAPS (SSL/TLS)',
          },
          {
            name: 'bind_dn',
            type: 'varchar',
            length: '512',
            isNullable: true,
            comment: 'Distinguished Name for binding to LDAP',
          },
          {
            name: 'bind_password',
            type: 'varchar',
            length: '512',
            isNullable: true,
            comment: 'Encrypted password for bind DN',
          },
          {
            name: 'base_dn',
            type: 'varchar',
            length: '512',
            isNullable: true,
            comment: 'Base DN for user searches',
          },
          {
            name: 'user_search_filter',
            type: 'varchar',
            length: '512',
            default: "'(uid={{username}})'",
            comment: 'LDAP filter for user search. {{username}} is replaced with login username',
          },
          {
            name: 'username_attribute',
            type: 'varchar',
            length: '64',
            default: "'uid'",
            comment: 'LDAP attribute containing username',
          },
          {
            name: 'email_attribute',
            type: 'varchar',
            length: '64',
            default: "'mail'",
            comment: 'LDAP attribute containing email',
          },
          {
            name: 'first_name_attribute',
            type: 'varchar',
            length: '64',
            default: "'givenName'",
            comment: 'LDAP attribute containing first name',
          },
          {
            name: 'last_name_attribute',
            type: 'varchar',
            length: '64',
            default: "'sn'",
            comment: 'LDAP attribute containing last name',
          },
          {
            name: 'group_search_base',
            type: 'varchar',
            length: '512',
            isNullable: true,
            comment: 'Base DN for group searches',
          },
          {
            name: 'group_search_filter',
            type: 'varchar',
            length: '512',
            default: "'(member={{userDn}})'",
            comment: 'LDAP filter for group membership',
          },
          {
            name: 'default_role',
            type: 'varchar',
            length: '32',
            default: "'user'",
            comment: 'Default role for LDAP users without group mapping',
          },
          {
            name: 'allow_local_fallback',
            type: 'boolean',
            default: true,
            comment: 'Allow local auth when LDAP fails',
          },
          {
            name: 'connection_timeout_ms',
            type: 'int',
            default: 5000,
          },
          {
            name: 'last_connection_test',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_connection_status',
            type: 'varchar',
            length: '32',
            isNullable: true,
            comment: 'success, failed, timeout',
          },
          {
            name: 'last_connection_error',
            type: 'text',
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

    // Create unique index on tenant_id
    await queryRunner.createIndex(
      'tenant_ldap_config',
      new TableIndex({
        name: 'IDX_tenant_ldap_config_tenant_id',
        columnNames: ['tenant_id'],
        isUnique: true,
      }),
    );

    // Create ldap_group_role_mapping table
    await queryRunner.createTable(
      new Table({
        name: 'ldap_group_role_mapping',
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
            name: 'ldap_group_dn',
            type: 'varchar',
            length: '512',
            isNullable: false,
            comment: 'Full DN of the LDAP group',
          },
          {
            name: 'ldap_group_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Display name of the LDAP group',
          },
          {
            name: 'platform_role',
            type: 'varchar',
            length: '32',
            isNullable: false,
            comment: 'Platform role: admin, manager, user',
          },
          {
            name: 'priority',
            type: 'int',
            default: 0,
            comment: 'Higher priority mappings take precedence',
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

    // Create index on tenant_id for group mappings
    await queryRunner.createIndex(
      'ldap_group_role_mapping',
      new TableIndex({
        name: 'IDX_ldap_group_role_mapping_tenant_id',
        columnNames: ['tenant_id'],
      }),
    );

    // Create unique index on tenant_id + ldap_group_dn
    await queryRunner.createIndex(
      'ldap_group_role_mapping',
      new TableIndex({
        name: 'IDX_ldap_group_role_mapping_tenant_group',
        columnNames: ['tenant_id', 'ldap_group_dn'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'ldap_group_role_mapping',
      'IDX_ldap_group_role_mapping_tenant_group',
    );
    await queryRunner.dropIndex(
      'ldap_group_role_mapping',
      'IDX_ldap_group_role_mapping_tenant_id',
    );
    await queryRunner.dropTable('ldap_group_role_mapping');

    await queryRunner.dropIndex(
      'tenant_ldap_config',
      'IDX_tenant_ldap_config_tenant_id',
    );
    await queryRunner.dropTable('tenant_ldap_config');
  }
}
