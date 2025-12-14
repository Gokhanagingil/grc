/**
 * Standards Library Seed Script
 *
 * Seeds ISO/IEC 27001:2022 standard with sample clauses for testing.
 * Includes a hierarchical clause structure to test ClauseTree functionality.
 *
 * Usage: npm run seed:standards
 *
 * This script is idempotent - it checks for existing data before creating.
 */

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { Standard } from '../grc/entities/standard.entity';
import { StandardClause } from '../grc/entities/standard-clause.entity';

// Demo tenant ID (consistent with seed-grc.ts)
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function seedStandards() {
  console.log('Starting Standards Library seed...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // 1. Ensure demo tenant exists
    console.log('1. Checking demo tenant...');
    const tenantRepo = dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: DEMO_TENANT_ID } });

    if (!tenant) {
      console.error(
        '   ERROR: Demo tenant not found. Please run seed:grc first.',
      );
      process.exit(1);
    }
    console.log('   Demo tenant found');

    // 2. Seed ISO 27001:2022 Standard
    console.log('2. Seeding ISO/IEC 27001:2022 standard...');
    const standardRepo = dataSource.getRepository(Standard);
    let standard = await standardRepo.findOne({
      where: {
        tenantId: DEMO_TENANT_ID,
        code: 'ISO27001',
        version: '2022',
      },
    });

    if (!standard) {
      standard = standardRepo.create({
        tenantId: DEMO_TENANT_ID,
        code: 'ISO27001',
        name: 'ISO/IEC 27001:2022',
        version: '2022',
        domain: 'security',
        description:
          'Information security management systems — Requirements. International standard for managing information security.',
        publisher: 'ISO/IEC',
        publishedDate: new Date('2022-10-25'),
        metadata: {
          framework: 'ISO27001',
          category: 'Information Security',
        },
      });
      await standardRepo.save(standard);
      console.log('   Created standard: ISO/IEC 27001:2022');
    } else {
      console.log('   Standard already exists: ISO/IEC 27001:2022');
    }

    // 3. Seed Clauses with hierarchy
    console.log('3. Seeding clauses...');
    const clauseRepo = dataSource.getRepository(StandardClause);

    // Define clauses with parent-child relationships
    // Structure: A.5 -> A.5.1 -> A.5.1.1, A.5.1.2, etc.
    const clausesData = [
      // Top-level: A.5 Information security policies
      {
        code: 'A.5',
        title: 'Information security policies',
        description:
          'Policies for information security shall be defined, approved by management, published and communicated to employees and relevant external parties.',
        parentCode: null,
        hierarchyLevel: 0,
        sortOrder: 1,
      },
      // Second-level: A.5.1
      {
        code: 'A.5.1',
        title: 'Management direction for information security',
        description:
          'Management shall demonstrate their commitment to the establishment, implementation, operation, monitoring, review, maintenance and continual improvement of the information security management system.',
        parentCode: 'A.5',
        hierarchyLevel: 1,
        sortOrder: 1,
      },
      // Third-level: A.5.1.1
      {
        code: 'A.5.1.1',
        title: 'Policies for information security',
        description:
          'A set of policies for information security shall be defined, approved by management, published and communicated to employees and relevant external parties.',
        parentCode: 'A.5.1',
        hierarchyLevel: 2,
        sortOrder: 1,
      },
      {
        code: 'A.5.1.2',
        title: 'Review of policies for information security',
        description:
          'The policies for information security shall be reviewed at planned intervals or if significant changes occur.',
        parentCode: 'A.5.1',
        hierarchyLevel: 2,
        sortOrder: 2,
      },
      // Top-level: A.6 Organization of information security
      {
        code: 'A.6',
        title: 'Organization of information security',
        description:
          'A management framework shall be established to initiate and control the implementation and operation of information security within the organization.',
        parentCode: null,
        hierarchyLevel: 0,
        sortOrder: 2,
      },
      {
        code: 'A.6.1',
        title: 'Internal organization',
        description:
          'The organization shall establish and maintain an internal structure to ensure that information security activities are performed in a coordinated manner.',
        parentCode: 'A.6',
        hierarchyLevel: 1,
        sortOrder: 1,
      },
      {
        code: 'A.6.1.1',
        title: 'Information security roles and responsibilities',
        description:
          'All information security roles and responsibilities shall be defined and allocated.',
        parentCode: 'A.6.1',
        hierarchyLevel: 2,
        sortOrder: 1,
      },
      {
        code: 'A.6.1.2',
        title: 'Segregation of duties',
        description:
          'Conflicting duties and areas of responsibility shall be segregated to reduce opportunities for unauthorized or unintentional modification or misuse of the organization assets.',
        parentCode: 'A.6.1',
        hierarchyLevel: 2,
        sortOrder: 2,
      },
      {
        code: 'A.6.1.3',
        title: 'Contact with authorities',
        description:
          'Appropriate contacts with relevant authorities shall be maintained.',
        parentCode: 'A.6.1',
        hierarchyLevel: 2,
        sortOrder: 3,
      },
      // Top-level: A.9 Access control
      {
        code: 'A.9',
        title: 'Access control',
        description:
          'Access to information and other associated assets shall be restricted based on business and security requirements.',
        parentCode: null,
        hierarchyLevel: 0,
        sortOrder: 3,
      },
      {
        code: 'A.9.2',
        title: 'User access management',
        description:
          'Formal user access management processes shall be in place to control allocation of access rights.',
        parentCode: 'A.9',
        hierarchyLevel: 1,
        sortOrder: 1,
      },
      {
        code: 'A.9.2.3',
        title: 'Management of privileged access rights',
        description:
          'The allocation and use of privileged access rights shall be restricted and controlled.',
        parentCode: 'A.9.2',
        hierarchyLevel: 2,
        sortOrder: 1,
      },
      {
        code: 'A.9.2.4',
        title: 'Management of secret authentication information of users',
        description:
          'The allocation of secret authentication information shall be controlled through a formal management process.',
        parentCode: 'A.9.2',
        hierarchyLevel: 2,
        sortOrder: 2,
      },
      // Top-level: A.12 Operations security
      {
        code: 'A.12',
        title: 'Operations security',
        description:
          'Operational procedures and responsibilities shall be established and maintained to ensure secure operation of information processing facilities.',
        parentCode: null,
        hierarchyLevel: 0,
        sortOrder: 4,
      },
      {
        code: 'A.12.3',
        title: 'Backup',
        description:
          'Backup copies of information, software and system images shall be taken and tested regularly in accordance with an agreed backup policy.',
        parentCode: 'A.12',
        hierarchyLevel: 1,
        sortOrder: 1,
      },
      {
        code: 'A.12.3.1',
        title: 'Information backup',
        description:
          'Backup copies of information, software and system images shall be taken and tested regularly in accordance with an agreed backup policy.',
        parentCode: 'A.12.3',
        hierarchyLevel: 2,
        sortOrder: 1,
      },
    ];

    const createdClauses: StandardClause[] = [];
    const clauseMap = new Map<string, StandardClause>();

    // First pass: Create all clauses without parent relationships
    for (const clauseData of clausesData) {
      const existing = await clauseRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          standardId: standard.id,
          code: clauseData.code,
        },
      });

      if (existing) {
        clauseMap.set(clauseData.code, existing);
        createdClauses.push(existing);
        console.log(`   Clause already exists: ${clauseData.code}`);
      } else {
        const clause = clauseRepo.create({
          tenantId: DEMO_TENANT_ID,
          standardId: standard.id,
          code: clauseData.code,
          title: clauseData.title,
          description: clauseData.description,
          hierarchyLevel: clauseData.hierarchyLevel,
          sortOrder: clauseData.sortOrder,
          metadata: {
            standard: 'ISO27001',
            version: '2022',
          },
        });
        await clauseRepo.save(clause);
        clauseMap.set(clauseData.code, clause);
        createdClauses.push(clause);
        console.log(`   Created clause: ${clauseData.code} - ${clauseData.title}`);
      }
    }

    // Second pass: Update parent relationships
    console.log('4. Setting up clause hierarchy...');
    for (const clauseData of clausesData) {
      if (clauseData.parentCode) {
        const clause = clauseMap.get(clauseData.code);
        const parent = clauseMap.get(clauseData.parentCode);

        if (clause && parent && clause.parentId !== parent.id) {
          clause.parentId = parent.id;
          await clauseRepo.save(clause);
          console.log(
            `   Linked: ${clauseData.code} -> ${clauseData.parentCode}`,
          );
        }
      }
    }

    console.log('\n========================================');
    console.log('Standards Library Seed Complete!');
    console.log('========================================');
    console.log(`Tenant ID: ${DEMO_TENANT_ID}`);
    console.log(`Standard: ISO/IEC 27001:2022`);
    console.log(`Clauses: ${createdClauses.length}`);
    console.log('');
    console.log('Clause hierarchy:');
    const topLevel = createdClauses.filter((c) => c.hierarchyLevel === 0);
    for (const top of topLevel) {
      console.log(`  - ${top.code}: ${top.title}`);
      const children = createdClauses.filter(
        (c) => c.parentId === top.id && c.hierarchyLevel === 1,
      );
      for (const child of children) {
        console.log(`    - ${child.code}: ${child.title}`);
        const grandchildren = createdClauses.filter(
          (c) => c.parentId === child.id && c.hierarchyLevel === 2,
        );
        for (const grandchild of grandchildren) {
          console.log(`      - ${grandchild.code}: ${grandchild.title}`);
        }
      }
    }
    console.log('========================================\n');
  } catch (error) {
    console.error('Error seeding standards:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the seed
seedStandards()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
