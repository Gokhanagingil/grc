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
 *
 * Runtime Detection:
 *   - In production/staging (dist), runs compiled .js scripts with Node
 *   - In development (src), runs .ts scripts with ts-node
 *   - Auto-detects based on __dirname containing '/dist/' or '\dist\'
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { config } from 'dotenv';

config();

/**
 * Detect if we're running from the compiled dist directory
 *
 * Uses __dirname to determine if we're running from the compiled dist directory.
 * This is robust across Linux/macOS/Windows path separators.
 *
 * When running from dist/scripts/platform-validate.js:
 *   __dirname will be: /app/dist/scripts (Docker) or <project>/backend-nest/dist/scripts (local)
 *
 * When running from src/scripts/platform-validate.ts (dev):
 *   __dirname will be: <project>/backend-nest/src/scripts
 */
export function isDistRuntime(): boolean {
  try {
    // Normalize path separators for cross-platform compatibility
    const normalizedDirname = __dirname.replace(/\\/g, '/');
    const normalizedFilename = (__filename || '').replace(/\\/g, '/');

    // Check if __dirname contains '/dist/' or ends with '/dist'
    if (
      normalizedDirname.includes('/dist/') ||
      normalizedDirname.endsWith('/dist')
    ) {
      return true;
    }

    // Check if __filename ends with .js and contains '/dist/'
    if (
      normalizedFilename.endsWith('.js') &&
      normalizedFilename.includes('/dist/')
    ) {
      return true;
    }

    // Check if __filename ends with .ts (definitely in src mode)
    if (normalizedFilename.endsWith('.ts')) {
      return false;
    }

    // Check if __dirname contains '/src/' or ends with '/src'
    if (
      normalizedDirname.includes('/src/') ||
      normalizedDirname.endsWith('/src')
    ) {
      return false;
    }

    // Default to src mode for safety (dev-friendly)
    return false;
  } catch {
    // If all checks fail, default to src mode for safety
    return false;
  }
}

/**
 * Resolve script path based on runtime environment
 *
 * @param scriptBaseName - Base name of the script without extension (e.g., 'validate-env')
 * @returns Absolute path to the script file (.js in dist, .ts in src)
 */
export function resolveScript(scriptBaseName: string): string {
  const extension = isDistRuntime() ? '.js' : '.ts';
  return path.join(__dirname, `${scriptBaseName}${extension}`);
}

/**
 * Get the repository root directory
 *
 * In dist mode: __dirname is dist/scripts, so go up 2 levels
 * In src mode: __dirname is src/scripts, so go up 2 levels
 */
function getRepoRoot(): string {
  return path.join(__dirname, '..', '..');
}

/**
 * Spawn a Node.js process to run a compiled JS script
 *
 * @param scriptAbsPath - Absolute path to the .js script
 * @param args - Arguments to pass to the script
 * @returns ChildProcess
 */
function spawnNode(scriptAbsPath: string, args: string[] = []): ChildProcess {
  return spawn(process.execPath, [scriptAbsPath, ...args], {
    cwd: getRepoRoot(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * Spawn a ts-node process to run a TypeScript script (dev only)
 *
 * @param scriptAbsPath - Absolute path to the .ts script
 * @param args - Arguments to pass to the script
 * @returns ChildProcess
 */
function spawnTsNode(scriptAbsPath: string, args: string[] = []): ChildProcess {
  return spawn(
    'npx',
    ['ts-node', '-r', 'tsconfig-paths/register', scriptAbsPath, ...args],
    {
      cwd: getRepoRoot(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

/**
 * Spawn the appropriate runtime for a script based on environment
 *
 * @param scriptAbsPath - Absolute path to the script
 * @param args - Arguments to pass to the script
 * @returns ChildProcess
 */
function spawnScript(scriptAbsPath: string, args: string[] = []): ChildProcess {
  if (isDistRuntime()) {
    return spawnNode(scriptAbsPath, args);
  } else {
    return spawnTsNode(scriptAbsPath, args);
  }
}

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

    // Use spawnScript which auto-detects dist vs src runtime
    const child = spawnScript(scriptPath, args);

    child.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
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
  const envResult = await runScript(resolveScript('validate-env'), scriptArgs);
  scripts.push({
    name: 'Environment Validation',
    status: envResult.exitCode === 0 ? 'passed' : 'failed',
    exitCode: envResult.exitCode,
    output: envResult.output,
    durationMs: envResult.durationMs,
  });

  // 2. Database Validation
  console.log('Running database validation...');
  const dbResult = await runScript(resolveScript('validate-db'), scriptArgs);
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
    resolveScript('validate-migrations'),
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
      resolveScript('smoke-auth-onboarding'),
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
