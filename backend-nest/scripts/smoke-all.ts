#!/usr/bin/env ts-node
/**
 * Global Smoke Test Pipeline
 * 
 * Runs all smoke tests in sequence.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/smoke-all.ts
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const smokeTests = [
  { name: 'Login', script: 'smoke:login' },
  { name: 'Policies', script: 'smoke:policies' },
  { name: 'Standards', script: 'smoke:standards' },
  { name: 'Audit Flow', script: 'smoke:audit-flow' },
  { name: 'BCM Processes', script: 'smoke:bcm-processes' },
  { name: 'Calendar', script: 'smoke:calendar' },
  { name: 'Admin', script: 'smoke:admin' },
  { name: 'Governance', script: 'smoke:governance' },
];

async function smokeAll() {
  console.log('=== Global Smoke Test Pipeline ===\n');
  console.log('This will run all smoke tests in sequence:\n');
  smokeTests.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} (${s.script})`);
  });
  console.log('\n');

  let errors = 0;
  const results: Array<{ name: string; passed: boolean }> = [];

  for (const { name, script } of smokeTests) {
    try {
      console.log(`[SMOKE] Running ${name}...`);
      execSync(`npm run ${script}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log(`✅ ${name} passed\n`);
      results.push({ name, passed: true });
    } catch (error: any) {
      console.error(`❌ ${name} failed:`, error?.message || error);
      errors++;
      results.push({ name, passed: false });
      // Continue with other tests even if one fails
    }
  }

  // Summary
  console.log('\n=== Smoke Test Summary ===\n');
  results.forEach((r) => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
  });
  console.log(`\nTotal: ${results.length}, Passed: ${results.filter((r) => r.passed).length}, Failed: ${errors}`);

  if (errors > 0) {
    console.error(`\n⚠️  Smoke test pipeline completed with ${errors} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ All smoke tests passed!');
    process.exitCode = 0;
  }
}

smokeAll().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

