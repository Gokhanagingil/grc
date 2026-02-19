process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { SysDbObject } from '../grc/entities/sys-db-object.entity';
import { SysDictionary } from '../grc/entities/sys-dictionary.entity';
import {
  SysRelationship,
  SysRelationshipType,
} from '../grc/entities/sys-relationship.entity';
import { PlatformBuilderFieldType } from '../grc/enums';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

interface CoreTableDef {
  name: string;
  label: string;
  description: string;
  displayField: string;
  numberPrefix: string | null;
}

interface CoreFieldDef {
  tableName: string;
  fieldName: string;
  label: string;
  type: PlatformBuilderFieldType;
  isRequired: boolean;
  isUnique: boolean;
  readOnly: boolean;
  referenceTable: string | null;
  choiceTable: string | null;
  maxLength: number | null;
  indexed: boolean;
  fieldOrder: number;
}

interface CoreRelDef {
  name: string;
  fromTable: string;
  toTable: string;
  type: SysRelationshipType;
  fkColumn: string | null;
}

const CORE_TABLES: CoreTableDef[] = [
  {
    name: 'itsm_incidents',
    label: 'Incidents',
    description: 'ITSM incident records',
    displayField: 'number',
    numberPrefix: 'INC',
  },
  {
    name: 'itsm_changes',
    label: 'Changes',
    description: 'ITSM change request records',
    displayField: 'number',
    numberPrefix: 'CHG',
  },
  {
    name: 'itsm_services',
    label: 'Services',
    description: 'ITSM service catalog',
    displayField: 'name',
    numberPrefix: 'SVC',
  },
];

const CORE_FIELDS: CoreFieldDef[] = [
  // --- itsm_incidents ---
  {
    tableName: 'itsm_incidents',
    fieldName: 'number',
    label: 'Number',
    type: PlatformBuilderFieldType.STRING,
    isRequired: true,
    isUnique: true,
    readOnly: true,
    referenceTable: null,
    choiceTable: null,
    maxLength: 20,
    indexed: true,
    fieldOrder: 0,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'short_description',
    label: 'Short Description',
    type: PlatformBuilderFieldType.STRING,
    isRequired: true,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: null,
    maxLength: 255,
    indexed: false,
    fieldOrder: 1,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'description',
    label: 'Description',
    type: PlatformBuilderFieldType.TEXT,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: null,
    maxLength: null,
    indexed: false,
    fieldOrder: 2,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'state',
    label: 'State',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: true,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_incidents',
    maxLength: null,
    indexed: true,
    fieldOrder: 3,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'impact',
    label: 'Impact',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: true,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_incidents',
    maxLength: null,
    indexed: true,
    fieldOrder: 4,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'urgency',
    label: 'Urgency',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: true,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_incidents',
    maxLength: null,
    indexed: true,
    fieldOrder: 5,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'priority',
    label: 'Priority',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_incidents',
    maxLength: null,
    indexed: true,
    fieldOrder: 6,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'category',
    label: 'Category',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_incidents',
    maxLength: null,
    indexed: false,
    fieldOrder: 7,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'assigned_to',
    label: 'Assigned To',
    type: PlatformBuilderFieldType.REFERENCE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: 'nest_users',
    choiceTable: null,
    maxLength: null,
    indexed: true,
    fieldOrder: 8,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'service_id',
    label: 'Service',
    type: PlatformBuilderFieldType.REFERENCE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: 'itsm_services',
    choiceTable: null,
    maxLength: null,
    indexed: true,
    fieldOrder: 9,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'resolved_at',
    label: 'Resolved At',
    type: PlatformBuilderFieldType.DATETIME,
    isRequired: false,
    isUnique: false,
    readOnly: true,
    referenceTable: null,
    choiceTable: null,
    maxLength: null,
    indexed: false,
    fieldOrder: 10,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'closed_at',
    label: 'Closed At',
    type: PlatformBuilderFieldType.DATETIME,
    isRequired: false,
    isUnique: false,
    readOnly: true,
    referenceTable: null,
    choiceTable: null,
    maxLength: null,
    indexed: false,
    fieldOrder: 11,
  },

  // --- itsm_changes ---
  {
    tableName: 'itsm_changes',
    fieldName: 'number',
    label: 'Number',
    type: PlatformBuilderFieldType.STRING,
    isRequired: true,
    isUnique: true,
    readOnly: true,
    referenceTable: null,
    choiceTable: null,
    maxLength: 20,
    indexed: true,
    fieldOrder: 0,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'short_description',
    label: 'Short Description',
    type: PlatformBuilderFieldType.STRING,
    isRequired: true,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: null,
    maxLength: 255,
    indexed: false,
    fieldOrder: 1,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'description',
    label: 'Description',
    type: PlatformBuilderFieldType.TEXT,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: null,
    maxLength: null,
    indexed: false,
    fieldOrder: 2,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'state',
    label: 'State',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: true,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_changes',
    maxLength: null,
    indexed: true,
    fieldOrder: 3,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'type',
    label: 'Type',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: true,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_changes',
    maxLength: null,
    indexed: true,
    fieldOrder: 4,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'risk',
    label: 'Risk',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_changes',
    maxLength: null,
    indexed: false,
    fieldOrder: 5,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'approval_status',
    label: 'Approval Status',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_changes',
    maxLength: null,
    indexed: true,
    fieldOrder: 6,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'assigned_to',
    label: 'Assigned To',
    type: PlatformBuilderFieldType.REFERENCE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: 'nest_users',
    choiceTable: null,
    maxLength: null,
    indexed: true,
    fieldOrder: 7,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'service_id',
    label: 'Service',
    type: PlatformBuilderFieldType.REFERENCE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: 'itsm_services',
    choiceTable: null,
    maxLength: null,
    indexed: true,
    fieldOrder: 8,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'planned_start_at',
    label: 'Planned Start',
    type: PlatformBuilderFieldType.DATETIME,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: null,
    maxLength: null,
    indexed: false,
    fieldOrder: 9,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'planned_end_at',
    label: 'Planned End',
    type: PlatformBuilderFieldType.DATETIME,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: null,
    maxLength: null,
    indexed: false,
    fieldOrder: 10,
  },

  // --- itsm_services ---
  {
    tableName: 'itsm_services',
    fieldName: 'name',
    label: 'Name',
    type: PlatformBuilderFieldType.STRING,
    isRequired: true,
    isUnique: true,
    readOnly: false,
    referenceTable: null,
    choiceTable: null,
    maxLength: 200,
    indexed: true,
    fieldOrder: 0,
  },
  {
    tableName: 'itsm_services',
    fieldName: 'description',
    label: 'Description',
    type: PlatformBuilderFieldType.TEXT,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: null,
    maxLength: null,
    indexed: false,
    fieldOrder: 1,
  },
  {
    tableName: 'itsm_services',
    fieldName: 'status',
    label: 'Status',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: true,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_services',
    maxLength: null,
    indexed: true,
    fieldOrder: 2,
  },
  {
    tableName: 'itsm_services',
    fieldName: 'category',
    label: 'Category',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_services',
    maxLength: null,
    indexed: false,
    fieldOrder: 3,
  },
  {
    tableName: 'itsm_services',
    fieldName: 'owner_id',
    label: 'Owner',
    type: PlatformBuilderFieldType.REFERENCE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: 'nest_users',
    choiceTable: null,
    maxLength: null,
    indexed: true,
    fieldOrder: 4,
  },
  {
    tableName: 'itsm_services',
    fieldName: 'criticality',
    label: 'Criticality',
    type: PlatformBuilderFieldType.CHOICE,
    isRequired: false,
    isUnique: false,
    readOnly: false,
    referenceTable: null,
    choiceTable: 'itsm_services',
    maxLength: null,
    indexed: false,
    fieldOrder: 5,
  },
];

const CORE_RELATIONSHIPS: CoreRelDef[] = [
  {
    name: 'incident_assigned_to_user',
    fromTable: 'itsm_incidents',
    toTable: 'nest_users',
    type: SysRelationshipType.ONE_TO_MANY,
    fkColumn: 'assigned_to',
  },
  {
    name: 'incident_service',
    fromTable: 'itsm_incidents',
    toTable: 'itsm_services',
    type: SysRelationshipType.ONE_TO_MANY,
    fkColumn: 'service_id',
  },
  {
    name: 'change_assigned_to_user',
    fromTable: 'itsm_changes',
    toTable: 'nest_users',
    type: SysRelationshipType.ONE_TO_MANY,
    fkColumn: 'assigned_to',
  },
  {
    name: 'change_service',
    fromTable: 'itsm_changes',
    toTable: 'itsm_services',
    type: SysRelationshipType.ONE_TO_MANY,
    fkColumn: 'service_id',
  },
  {
    name: 'service_owner',
    fromTable: 'itsm_services',
    toTable: 'nest_users',
    type: SysRelationshipType.ONE_TO_MANY,
    fkColumn: 'owner_id',
  },
];

async function seedDictionaryCore() {
  console.log('Starting Platform Builder v1 dictionary core seed...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    const tableRepo = dataSource.getRepository(SysDbObject);
    const fieldRepo = dataSource.getRepository(SysDictionary);
    const relRepo = dataSource.getRepository(SysRelationship);

    let tablesCreated = 0;
    let tablesSkipped = 0;
    let fieldsCreated = 0;
    let fieldsSkipped = 0;
    let relsCreated = 0;
    let relsSkipped = 0;

    console.log('1. Seeding core table definitions...');
    for (const def of CORE_TABLES) {
      const existing = await tableRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: def.name, isDeleted: false },
      });

      if (!existing) {
        const entity = tableRepo.create({
          tenantId: DEMO_TENANT_ID,
          name: def.name,
          label: def.label,
          description: def.description,
          isActive: true,
          isCore: true,
          displayField: def.displayField,
          numberPrefix: def.numberPrefix,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await tableRepo.save(entity);
        tablesCreated++;
        console.log(`   + ${def.name} (${def.label})`);
      } else {
        if (!existing.isCore) {
          existing.isCore = true;
          existing.displayField = def.displayField;
          existing.numberPrefix = def.numberPrefix;
          await tableRepo.save(existing);
          console.log(`   ~ ${def.name} (updated to core)`);
        } else {
          tablesSkipped++;
          console.log(`   = ${def.name} (already exists)`);
        }
      }
    }

    console.log('\n2. Seeding core field definitions...');
    for (const def of CORE_FIELDS) {
      const existing = await fieldRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          tableName: def.tableName,
          fieldName: def.fieldName,
          isDeleted: false,
        },
      });

      if (!existing) {
        const entity = fieldRepo.create({
          tenantId: DEMO_TENANT_ID,
          tableName: def.tableName,
          fieldName: def.fieldName,
          label: def.label,
          type: def.type,
          isRequired: def.isRequired,
          isUnique: def.isUnique,
          readOnly: def.readOnly,
          referenceTable: def.referenceTable,
          choiceTable: def.choiceTable,
          maxLength: def.maxLength,
          indexed: def.indexed,
          fieldOrder: def.fieldOrder,
          isActive: true,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await fieldRepo.save(entity);
        fieldsCreated++;
        console.log(`   + ${def.tableName}.${def.fieldName}`);
      } else {
        fieldsSkipped++;
      }
    }
    if (fieldsSkipped > 0) {
      console.log(`   = ${fieldsSkipped} fields already exist`);
    }

    console.log('\n3. Seeding core relationship definitions...');
    for (const def of CORE_RELATIONSHIPS) {
      const existing = await relRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: def.name, isDeleted: false },
      });

      if (!existing) {
        const entity = relRepo.create({
          tenantId: DEMO_TENANT_ID,
          name: def.name,
          fromTable: def.fromTable,
          toTable: def.toTable,
          type: def.type,
          fkColumn: def.fkColumn,
          isActive: true,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await relRepo.save(entity);
        relsCreated++;
        console.log(`   + ${def.name}`);
      } else {
        relsSkipped++;
        console.log(`   = ${def.name} (already exists)`);
      }
    }

    console.log('\nSummary:');
    console.log(
      `  Tables:        ${tablesCreated} created, ${tablesSkipped} skipped`,
    );
    console.log(
      `  Fields:        ${fieldsCreated} created, ${fieldsSkipped} skipped`,
    );
    console.log(
      `  Relationships: ${relsCreated} created, ${relsSkipped} skipped`,
    );
    console.log('\nDone.');
  } catch (error) {
    console.error('Error seeding dictionary core:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

seedDictionaryCore()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
