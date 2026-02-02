#!/usr/bin/env node
/**
 * Migration CLI Wrapper
 *
 * Smart wrapper for TypeORM migration commands that auto-detects
 * whether to use dist/ (production/staging) or src/ (development) paths.
 *
 * Usage:
 *   node scripts/migration-cli.js show    - Show migration status
 *   node scripts/migration-cli.js run     - Run pending migrations
 *   node scripts/migration-cli.js revert  - Revert last migration
 *
 * Environment detection:
 *   - If dist/data-source.js exists: uses dist paths (npx typeorm ... -d dist/data-source.js)
 *   - If src/data-source.ts exists: uses src paths (ts-node with tsconfig-paths)
 *   - If neither exists: exits with clear error message
 *
 * Security:
 *   - Only allows: show, run, revert commands
 *   - Rejects unknown arguments
 *   - Propagates exit codes for CI compatibility
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Allowed commands (allowlist for security)
const ALLOWED_COMMANDS = ['show', 'run', 'revert'];

// Resolve paths relative to backend-nest root
const backendRoot = path.resolve(__dirname, '..');
const distDataSource = path.join(backendRoot, 'dist', 'data-source.js');
const srcDataSource = path.join(backendRoot, 'src', 'data-source.ts');

/**
 * Detect environment and return appropriate configuration
 */
function detectEnvironment() {
  const distExists = fs.existsSync(distDataSource);
  const srcExists = fs.existsSync(srcDataSource);

  if (distExists) {
    return {
      mode: 'dist',
      dataSource: 'dist/data-source.js',
      description: 'production/staging (dist)',
    };
  }

  if (srcExists) {
    return {
      mode: 'src',
      dataSource: 'src/data-source.ts',
      description: 'development (src)',
    };
  }

  return null;
}

/**
 * Build the command to execute based on environment and migration command
 */
function buildCommand(env, migrationCommand) {
  if (env.mode === 'dist') {
    // Production/staging: use npx typeorm directly with dist data source
    return {
      command: 'npx',
      args: ['typeorm', `migration:${migrationCommand}`, '-d', env.dataSource],
    };
  }

  // Development: use ts-node with tsconfig-paths for TypeScript support
  return {
    command: 'npx',
    args: [
      'ts-node',
      '-r',
      'tsconfig-paths/register',
      'node_modules/typeorm/cli.js',
      `migration:${migrationCommand}`,
      '-d',
      env.dataSource,
    ],
  };
}

/**
 * Execute the migration command
 */
function executeCommand(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit', // Pass through stdout/stderr
      shell: process.platform === 'win32', // Use shell on Windows
    });

    child.on('error', (err) => {
      console.error(`\nError executing command: ${err.message}`);
      resolve(1);
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Validate arguments
  if (args.length === 0) {
    console.error('Error: No command specified.');
    console.error('');
    console.error('Usage: node scripts/migration-cli.js <command>');
    console.error('');
    console.error('Available commands:');
    console.error('  show   - Show migration status (which migrations have been run)');
    console.error('  run    - Run all pending migrations');
    console.error('  revert - Revert the last executed migration');
    process.exit(1);
  }

  const migrationCommand = args[0].toLowerCase();

  // Validate command is in allowlist
  if (!ALLOWED_COMMANDS.includes(migrationCommand)) {
    console.error(`Error: Unknown command "${args[0]}".`);
    console.error('');
    console.error('Allowed commands: ' + ALLOWED_COMMANDS.join(', '));
    process.exit(1);
  }

  // Reject extra arguments for security
  if (args.length > 1) {
    console.error('Error: Extra arguments are not allowed.');
    console.error('');
    console.error(`Usage: node scripts/migration-cli.js ${migrationCommand}`);
    process.exit(1);
  }

  // Detect environment
  const env = detectEnvironment();

  if (!env) {
    console.error('Error: No data source found.');
    console.error('');
    console.error('Expected one of:');
    console.error(`  - ${distDataSource} (production/staging)`);
    console.error(`  - ${srcDataSource} (development)`);
    console.error('');
    console.error('Make sure you are running this from the backend-nest directory');
    console.error('and that either dist/ or src/ exists with the data-source file.');
    process.exit(1);
  }

  // Build and execute command
  const { command, args: cmdArgs } = buildCommand(env, migrationCommand);

  console.log(`[migration-cli] Environment: ${env.description}`);
  console.log(`[migration-cli] Data source: ${env.dataSource}`);
  console.log(`[migration-cli] Executing: ${command} ${cmdArgs.join(' ')}`);
  console.log('');

  const exitCode = await executeCommand(command, cmdArgs, backendRoot);
  process.exit(exitCode);
}

// Run main function
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
