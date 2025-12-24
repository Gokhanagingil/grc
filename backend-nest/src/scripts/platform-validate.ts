/**
 * Platform Validation Script
 *
 * Single command to validate the entire platform:
 * - Environment variables
 * - Database connectivity
 * - Migration status
 * - Health endpoints
 * - Auth & onboarding smoke tests
 *
 * Usage:
 *   npm run platform:validate           - Human-readable output
 *   npm run platform:validate -- --json - JSON output for CI
 *   npm run platform:validate -- --skip-smoke - Skip smoke tests (faster)
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { config } from 'dotenv';

config();

interface ScriptResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  exitCode: number;
  output: string;
  durationMs: number;
}

interface ValidationResult {
  success: boolean;
  timestamp: string;
  environment: string;
  scripts: ScriptResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    totalDurationMs: number;
  };
}

function runScript(
  scriptPath: string,
  args: string[] = [],
): Promise<{ exitCode: number; output: string; durationMs: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let output = '';

    const child = spawn(
      'npx',
      ['ts-node', '-r', 'tsconfig-paths/register', scriptPath, ...args],
      {
        cwd: path.join(__dirname, '..', '..'),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        output,
        durationMs: Date.now() - startTime,
      });
    });

    child.on('error', (error) => {
      resolve({
        exitCode: 1,
        output: `Error: ${error.message}`,
        durationMs: Date.now() - startTime,
      });
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        exitCode: 1,
        output: output + '\nTimeout: Script took too long',
        durationMs: Date.now() - startTime,
      });
    }, 60000);
  });
}

async function runValidation(
  skipSmoke: boolean,
  jsonOutput: boolean,
): Promise<ValidationResult> {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  const scripts: ScriptResult[] = [];
  const startTime = Date.now();

  const scriptArgs = jsonOutput ? ['--json'] : [];

  // 1. Environment Validation
  console.log('Running environment validation...');
  const envResult = await runScript(
    path.join(__dirname, 'validate-env.ts'),
    scriptArgs,
  );
  scripts.push({
    name: 'Environment Validation',
    status: envResult.exitCode === 0 ? 'passed' : 'failed',
    exitCode: envResult.exitCode,
    output: envResult.output,
    durationMs: envResult.durationMs,
  });

  // 2. Database Validation
  console.log('Running database validation...');
  const dbResult = await runScript(
    path.join(__dirname, 'validate-db.ts'),
    scriptArgs,
  );
  scripts.push({
    name: 'Database Validation',
    status: dbResult.exitCode === 0 ? 'passed' : 'failed',
    exitCode: dbResult.exitCode,
    output: dbResult.output,
    durationMs: dbResult.durationMs,
  });

  // 3. Migration Validation
  console.log('Running migration validation...');
  const migrationResult = await runScript(
    path.join(__dirname, 'validate-migrations.ts'),
    scriptArgs,
  );
  scripts.push({
    name: 'Migration Validation',
    status: migrationResult.exitCode === 0 ? 'passed' : 'failed',
    exitCode: migrationResult.exitCode,
    output: migrationResult.output,
    durationMs: migrationResult.durationMs,
  });

  // 4. Auth & Onboarding Smoke Tests (optional)
  if (!skipSmoke) {
    console.log('Running auth & onboarding smoke tests...');
    const smokeResult = await runScript(
      path.join(__dirname, 'smoke-auth-onboarding.ts'),
      scriptArgs,
    );
    scripts.push({
      name: 'Auth & Onboarding Smoke Tests',
      status: smokeResult.exitCode === 0 ? 'passed' : 'failed',
      exitCode: smokeResult.exitCode,
      output: smokeResult.output,
      durationMs: smokeResult.durationMs,
    });
  } else {
    scripts.push({
      name: 'Auth & Onboarding Smoke Tests',
      status: 'skipped',
      exitCode: 0,
      output: 'Skipped (--skip-smoke flag)',
      durationMs: 0,
    });
  }

  const passed = scripts.filter((s) => s.status === 'passed').length;
  const failed = scripts.filter((s) => s.status === 'failed').length;
  const skipped = scripts.filter((s) => s.status === 'skipped').length;

  return {
    success: failed === 0,
    timestamp,
    environment,
    scripts,
    summary: {
      total: scripts.length,
      passed,
      failed,
      skipped,
      totalDurationMs: Date.now() - startTime,
    },
  };
}

function printHumanReadable(result: ValidationResult): void {
  console.log('\n');
  console.log('========================================');
  console.log('Platform Validation Report');
  console.log('========================================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Environment: ${result.environment}`);
  console.log('');

  console.log('--- Validation Results ---');
  for (const script of result.scripts) {
    const icon =
      script.status === 'passed'
        ? '[OK]'
        : script.status === 'failed'
          ? '[FAIL]'
          : '[SKIP]';
    console.log(`${icon} ${script.name} (${script.durationMs}ms)`);
  }
  console.log('');

  console.log('--- Summary ---');
  console.log(`Total: ${result.summary.total}`);
  console.log(`Passed: ${result.summary.passed}`);
  console.log(`Failed: ${result.summary.failed}`);
  console.log(`Skipped: ${result.summary.skipped}`);
  console.log(`Total Duration: ${result.summary.totalDurationMs}ms`);
  console.log('');

  // Show failed script outputs
  const failedScripts = result.scripts.filter((s) => s.status === 'failed');
  if (failedScripts.length > 0) {
    console.log('--- Failed Script Details ---');
    for (const script of failedScripts) {
      console.log(`\n[${script.name}]`);
      console.log(script.output);
    }
    console.log('');
  }

  console.log('========================================');
  if (result.success) {
    console.log('[SUCCESS] Platform validation passed');
  } else {
    console.log('[FAILED] Platform validation failed');
  }
  console.log('========================================');
}

function printJson(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const skipSmoke = args.includes('--skip-smoke');

  console.log('========================================');
  console.log('GRC Platform Validation');
  console.log('========================================');
  console.log(`Starting validation at ${new Date().toISOString()}`);
  console.log('');

  const result = await runValidation(skipSmoke, jsonOutput);

  if (jsonOutput) {
    printJson(result);
  } else {
    printHumanReadable(result);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
