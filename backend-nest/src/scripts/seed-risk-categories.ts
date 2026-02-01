/**
 * Seed script for default risk categories
 *
 * This script creates default risk categories for a tenant.
 * It is idempotent - running it multiple times will not create duplicates.
 *
 * Usage:
 *   Development: npx ts-node src/scripts/seed-risk-categories.ts
 *   Production: node dist/scripts/seed-risk-categories.js
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

interface DataSourceModule {
  AppDataSource?: DataSource;
  default?: DataSource;
}

interface CategoryRow {
  id: string;
}

const DEFAULT_RISK_CATEGORIES = [
  {
    name: 'Strategic',
    description:
      'Risks related to strategic decisions, market positioning, and long-term business objectives',
  },
  {
    name: 'Operational',
    description:
      'Risks arising from internal processes, people, systems, or external events affecting operations',
  },
  {
    name: 'Financial',
    description:
      'Risks related to financial losses, liquidity, credit, and market fluctuations',
  },
  {
    name: 'Compliance',
    description:
      'Risks of legal or regulatory sanctions, financial loss, or reputational damage from non-compliance',
  },
  {
    name: 'Technology',
    description:
      'Risks related to IT systems, infrastructure, software, and technology dependencies',
  },
  {
    name: 'Cyber Security',
    description:
      'Risks from cyber threats, data breaches, malware, and unauthorized access to systems',
  },
  {
    name: 'Third Party',
    description:
      'Risks arising from vendors, suppliers, partners, and other third-party relationships',
  },
  {
    name: 'Reputational',
    description:
      "Risks that could damage the organization's reputation, brand, or public image",
  },
  {
    name: 'Environmental',
    description:
      'Risks related to environmental factors, climate change, and sustainability',
  },
  {
    name: 'Human Resources',
    description:
      'Risks related to workforce, talent management, employee relations, and workplace safety',
  },
];

async function seedRiskCategories() {
  const isProduction = process.env.NODE_ENV === 'production';
  const dataSourcePath = isProduction
    ? './dist/data-source.js'
    : './src/data-source.ts';

  console.log(`Loading data source from: ${dataSourcePath}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);

  let dataSourceModule: DataSourceModule;
  try {
    dataSourceModule = (await import(dataSourcePath)) as DataSourceModule;
  } catch (error) {
    console.error(`Failed to load data source from ${dataSourcePath}:`, error);
    process.exit(1);
  }

  const AppDataSource: DataSource | undefined =
    dataSourceModule.AppDataSource || dataSourceModule.default;

  if (!AppDataSource) {
    console.error('AppDataSource not found in data source module');
    process.exit(1);
  }

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    console.log('Database connection established');

    const tenantId =
      process.env.SEED_TENANT_ID || '00000000-0000-0000-0000-000000000001';
    console.log(`Seeding risk categories for tenant: ${tenantId}`);

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      for (const category of DEFAULT_RISK_CATEGORIES) {
        const existingCategory = (await queryRunner.query(
          `SELECT id FROM grc_risk_categories WHERE tenant_id = $1 AND name = $2`,
          [tenantId, category.name],
        )) as CategoryRow[];

        if (existingCategory.length === 0) {
          await queryRunner.query(
            `INSERT INTO grc_risk_categories (id, tenant_id, name, description, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())`,
            [tenantId, category.name, category.description],
          );
          console.log(`Created risk category: ${category.name}`);
        } else {
          console.log(`Risk category already exists: ${category.name}`);
        }
      }

      await queryRunner.commitTransaction();
      console.log('Risk categories seeded successfully');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  } catch (error) {
    console.error('Error seeding risk categories:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void seedRiskCategories();
