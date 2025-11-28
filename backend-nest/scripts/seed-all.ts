#!/usr/bin/env ts-node
/**
 * Seed All Script
 * 
 * Runs all seed scripts in the correct order for a complete bootstrap.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/seed-all.ts
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

// Seed order must follow dependency chain:
// 1. Dictionaries (independent)
// 2. Permissions (independent, needed for roles)
// 3. Standards (independent)
// 4. Clauses (depends on standards - handled in seed:standards)
// 5. Controls (independent, but may reference clauses)
// 6. Policies (independent)
// 7. Entities (independent)
// 8. Risk Catalog (depends on dictionaries/categories)
// 9. Risk Instances (depends on risk catalog, entities)
// 10. Audit Demo (depends on policies, controls, entities)
// 11. BCM Demo (depends on entities)
// 12. Calendar (depends on audit and BCM - creates events from existing data)
// 13. Dev Users (independent, but should be last for admin access)
const scripts = [
  { name: 'Dictionaries', script: 'seed:dictionaries' },
  { name: 'Permissions', script: 'seed:permissions' },
  { name: 'Standards', script: 'seed:standards' },
  { name: 'Controls', script: 'seed:controls' },
  { name: 'Policies', script: 'seed:policies' },
  { name: 'Entity Registry', script: 'seed:entity-registry' },
  { name: 'Risk Catalog', script: 'seed:risk-catalog' },
  { name: 'Risk Instances', script: 'seed:risk-instances' },
  { name: 'Audit Demo', script: 'seed:audit-demo' },
  { name: 'BCM Demo', script: 'seed:bcm-demo' },
  { name: 'Calendar', script: 'seed:calendar' },
  { name: 'Dev Users', script: 'seed:dev-users' },
];

async function seedAll() {
  console.log('=== Seed All Script ===\n');
  console.log('This will run all seed scripts in order:\n');
  scripts.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} (${s.script})`);
  });
  console.log('\n');

  let errors = 0;

  for (const { name, script } of scripts) {
    try {
      console.log(`[SEED] Running ${name}...`);
      execSync(`npm run ${script}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log(`✅ ${name} completed successfully\n`);
    } catch (error: any) {
      console.error(`❌ ${name} failed:`, error?.message || error);
      errors++;
      // Continue with other seeds even if one fails
    }
  }

  if (errors > 0) {
    console.error(`\n⚠️  Seed all completed with ${errors} error(s)`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ All seed scripts completed successfully!');
    process.exitCode = 0;
  }
}

seedAll().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

