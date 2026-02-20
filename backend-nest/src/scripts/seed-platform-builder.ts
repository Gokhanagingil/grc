/**
 * Platform Builder Demo Data Seed Script
 *
 * Seeds a demo dynamic table (u_vendor) with fields and sample records.
 * This demonstrates the Platform Builder v0 feature.
 *
 * Usage: npm run seed:platform-builder
 *
 * This script is idempotent - it checks for existing data before creating.
 */

// Disable job scheduling for seed scripts to ensure deterministic exit
process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { SysDbObject } from '../grc/entities/sys-db-object.entity';
import { SysDictionary } from '../grc/entities/sys-dictionary.entity';
import { DynamicRecord } from '../grc/entities/dynamic-record.entity';
import { PlatformBuilderFieldType } from '../grc/enums';

// Demo tenant ID (consistent with seed-grc.ts)
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

async function seedPlatformBuilderData() {
  console.log('Starting Platform Builder demo data seed...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // 1. Verify demo tenant exists
    console.log('1. Verifying demo tenant exists...');
    const tenantRepo = dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: DEMO_TENANT_ID } });

    if (!tenant) {
      console.error('   ERROR: Demo tenant not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log('   Demo tenant found: ' + tenant.name);

    // 2. Create u_vendor table definition
    console.log('2. Creating u_vendor table definition...');
    const tableRepo = dataSource.getRepository(SysDbObject);
    let vendorTable = await tableRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, name: 'u_vendor', isDeleted: false },
    });

    if (!vendorTable) {
      vendorTable = tableRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: 'u_vendor',
        label: 'Vendors',
        description: 'Track third-party vendors and their risk assessments',
        isActive: true,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await tableRepo.save(vendorTable);
      console.log('   Created table: u_vendor (Vendors)');
    } else {
      console.log('   Table u_vendor already exists');
    }

    // 3. Create field definitions for u_vendor
    console.log('3. Creating field definitions for u_vendor...');
    const fieldRepo = dataSource.getRepository(SysDictionary);

    const fieldsData = [
      {
        fieldName: 'name',
        label: 'Vendor Name',
        type: PlatformBuilderFieldType.STRING,
        isRequired: true,
        isUnique: true,
        fieldOrder: 0,
      },
      {
        fieldName: 'status',
        label: 'Status',
        type: PlatformBuilderFieldType.CHOICE,
        isRequired: true,
        choiceOptions: [
          { label: 'Active', value: 'active' },
          { label: 'Pending Review', value: 'pending_review' },
          { label: 'Approved', value: 'approved' },
          { label: 'Rejected', value: 'rejected' },
          { label: 'Inactive', value: 'inactive' },
        ],
        defaultValue: 'pending_review',
        fieldOrder: 1,
      },
      {
        fieldName: 'owner',
        label: 'Owner',
        type: PlatformBuilderFieldType.REFERENCE,
        isRequired: false,
        referenceTable: 'users',
        fieldOrder: 2,
      },
      {
        fieldName: 'description',
        label: 'Description',
        type: PlatformBuilderFieldType.TEXT,
        isRequired: false,
        fieldOrder: 3,
      },
      {
        fieldName: 'risk_level',
        label: 'Risk Level',
        type: PlatformBuilderFieldType.CHOICE,
        isRequired: false,
        choiceOptions: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
          { label: 'Critical', value: 'critical' },
        ],
        fieldOrder: 4,
      },
      {
        fieldName: 'contract_value',
        label: 'Contract Value',
        type: PlatformBuilderFieldType.DECIMAL,
        isRequired: false,
        fieldOrder: 5,
      },
      {
        fieldName: 'contract_start',
        label: 'Contract Start Date',
        type: PlatformBuilderFieldType.DATE,
        isRequired: false,
        fieldOrder: 6,
      },
      {
        fieldName: 'contract_end',
        label: 'Contract End Date',
        type: PlatformBuilderFieldType.DATE,
        isRequired: false,
        fieldOrder: 7,
      },
      {
        fieldName: 'is_critical',
        label: 'Critical Vendor',
        type: PlatformBuilderFieldType.BOOLEAN,
        isRequired: false,
        defaultValue: 'false',
        fieldOrder: 8,
      },
    ];

    for (const fieldData of fieldsData) {
      const existingField = await fieldRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          tableName: 'u_vendor',
          fieldName: fieldData.fieldName,
          isDeleted: false,
        },
      });

      if (!existingField) {
        const field = fieldRepo.create({
          tenantId: DEMO_TENANT_ID,
          tableName: 'u_vendor',
          ...fieldData,
          isActive: true,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await fieldRepo.save(field);
        console.log(
          `   Created field: ${fieldData.fieldName} (${fieldData.type})`,
        );
      } else {
        console.log(`   Field ${fieldData.fieldName} already exists`);
      }
    }

    // 4. Create sample vendor records
    console.log('4. Creating sample vendor records...');
    const recordRepo = dataSource.getRepository(DynamicRecord);

    const vendorsData = [
      {
        name: 'Acme Cloud Services',
        status: 'approved',
        description:
          'Primary cloud infrastructure provider for production workloads',
        risk_level: 'medium',
        contract_value: 150000,
        contract_start: '2024-01-01',
        contract_end: '2025-12-31',
        is_critical: true,
      },
      {
        name: 'SecureAuth Inc',
        status: 'active',
        description: 'Identity and access management solution provider',
        risk_level: 'low',
        contract_value: 45000,
        contract_start: '2024-03-15',
        contract_end: '2025-03-14',
        is_critical: true,
      },
      {
        name: 'DataBackup Pro',
        status: 'pending_review',
        description: 'Backup and disaster recovery services',
        risk_level: 'medium',
        contract_value: 25000,
        contract_start: '2024-06-01',
        contract_end: '2025-05-31',
        is_critical: false,
      },
      {
        name: 'GlobalNet Communications',
        status: 'approved',
        description: 'Network connectivity and telecommunications provider',
        risk_level: 'high',
        contract_value: 200000,
        contract_start: '2023-07-01',
        contract_end: '2026-06-30',
        is_critical: true,
      },
      {
        name: 'TechSupport Solutions',
        status: 'inactive',
        description: 'Former IT support vendor - contract terminated',
        risk_level: 'low',
        contract_value: 15000,
        contract_start: '2023-01-01',
        contract_end: '2024-06-30',
        is_critical: false,
      },
    ];

    for (const vendorData of vendorsData) {
      // Check if vendor with same name already exists
      const existingRecords = await recordRepo
        .createQueryBuilder('record')
        .where('record.tenantId = :tenantId', { tenantId: DEMO_TENANT_ID })
        .andWhere('record.tableName = :tableName', { tableName: 'u_vendor' })
        .andWhere('record.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere("record.data->>'name' = :name", { name: vendorData.name })
        .getOne();

      if (!existingRecords) {
        const record = recordRepo.create({
          tenantId: DEMO_TENANT_ID,
          tableName: 'u_vendor',
          recordId: randomUUID(),
          data: vendorData,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await recordRepo.save(record);
        console.log(`   Created vendor: ${vendorData.name}`);
      } else {
        console.log(`   Vendor ${vendorData.name} already exists`);
      }
    }

    console.log('\n✓ Platform Builder demo data seeded successfully!');
    console.log('\nSummary:');
    console.log('  - Table: u_vendor (Vendors)');
    console.log(
      '  - Fields: 9 (name, status, owner, description, risk_level, contract_value, contract_start, contract_end, is_critical)',
    );
    console.log('  - Sample Records: 5 vendors');
    console.log(
      '\nYou can now access the Platform Builder in the Admin panel.',
    );
  } catch (error) {
    console.error('Error seeding Platform Builder data:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Run the seed with explicit process.exit() for deterministic termination
seedPlatformBuilderData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
