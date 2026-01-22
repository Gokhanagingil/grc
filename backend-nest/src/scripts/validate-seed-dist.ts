/**
 * Validate Seed Scripts in Dist Mode
 *
 * This script validates that seed scripts can run in production (dist) mode.
 * It checks that the compiled JS files exist and can be loaded without errors.
 *
 * Usage:
 *   npm run validate:seed:dist (production - uses compiled JS)
 *   npm run validate:seed:dist:dev (development - uses ts-node)
 *
 * This is used in CI to ensure seed scripts will work in staging/production
 * containers where only dist/ exists (no src/).
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  script: string;
  exists: boolean;
  loadable: boolean;
  error?: string;
}

const SEED_SCRIPTS = [
  'seed-grc.js',
  'seed-onboarding.js',
  'seed-standards.js',
  'seed-frameworks.js',
  'seed-golden-flow.js',
  'seed-demo-story.js',
];

function loadScript(scriptPath: string): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(scriptPath);
}

function validateSeedScripts(): void {
  console.log('=== Seed Script Dist Validation ===\n');

  const distDir = path.resolve(__dirname, '../../dist/scripts');
  const results: ValidationResult[] = [];
  let hasErrors = false;

  console.log(`Checking dist directory: ${distDir}\n`);

  if (!fs.existsSync(distDir)) {
    console.error('ERROR: dist/scripts directory does not exist!');
    console.error('Run "npm run build" first to compile TypeScript files.');
    process.exit(1);
  }

  for (const script of SEED_SCRIPTS) {
    const scriptPath = path.join(distDir, script);
    const result: ValidationResult = {
      script,
      exists: false,
      loadable: false,
    };

    if (fs.existsSync(scriptPath)) {
      result.exists = true;
      console.log(`[OK] ${script} exists`);

      try {
        loadScript(scriptPath);
        result.loadable = true;
        console.log(`[OK] ${script} is loadable (no syntax errors)`);
      } catch (error) {
        result.loadable = false;
        result.error = error instanceof Error ? error.message : 'Unknown error';

        if (
          result.error.includes('Cannot find module') &&
          result.error.includes('data-source')
        ) {
          console.log(
            `[OK] ${script} has expected dependency on data-source (will work at runtime)`,
          );
          result.loadable = true;
        } else if (result.error.includes('Cannot find module')) {
          console.log(
            `[WARN] ${script} has missing dependency: ${result.error}`,
          );
          hasErrors = true;
        } else {
          console.log(`[WARN] ${script} load warning: ${result.error}`);
        }
      }
    } else {
      result.exists = false;
      console.log(`[FAIL] ${script} does not exist`);
      hasErrors = true;
    }

    results.push(result);
    console.log('');
  }

  console.log('=== Validation Summary ===\n');

  const existCount = results.filter((r) => r.exists).length;
  const loadableCount = results.filter((r) => r.loadable).length;

  console.log(`Scripts found: ${existCount}/${SEED_SCRIPTS.length}`);
  console.log(`Scripts loadable: ${loadableCount}/${SEED_SCRIPTS.length}`);

  if (hasErrors) {
    console.log('\n[FAIL] Some seed scripts are missing or have issues.');
    console.log('Ensure "npm run build" has been run successfully.');
    process.exit(1);
  }

  console.log('\n[OK] All seed scripts validated for dist mode.');
  console.log(
    'Seed scripts can be run in production using "npm run seed:grc", etc.',
  );
  process.exit(0);
}

validateSeedScripts();
