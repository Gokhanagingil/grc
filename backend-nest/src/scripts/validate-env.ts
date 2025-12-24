/**
 * Environment Validation Script
 *
 * Validates that all required environment variables are set and optional
 * variables are documented. Supports JSON output for CI integration.
 *
 * Usage:
 *   npm run validate:env           - Human-readable output
 *   npm run validate:env -- --json - JSON output for CI
 *
 * Exit codes:
 *   0 - All required variables are set
 *   1 - One or more required variables are missing
 */

import { config } from 'dotenv';

config();

interface EnvVarSpec {
  name: string;
  required: boolean;
  description: string;
  defaultValue?: string;
  sensitive?: boolean;
}

interface ValidationResult {
  success: boolean;
  timestamp: string;
  environment: string;
  results: {
    required: {
      total: number;
      configured: number;
      missing: string[];
    };
    optional: {
      total: number;
      configured: number;
      unconfigured: string[];
    };
  };
  errors: string[];
  warnings: string[];
}

const ENV_VARS: EnvVarSpec[] = [
  // Database - Required
  {
    name: 'DB_HOST',
    required: true,
    description: 'PostgreSQL host',
    defaultValue: 'localhost',
  },
  {
    name: 'DB_PORT',
    required: true,
    description: 'PostgreSQL port',
    defaultValue: '5432',
  },
  {
    name: 'DB_USER',
    required: true,
    description: 'PostgreSQL username',
    defaultValue: 'postgres',
  },
  {
    name: 'DB_PASSWORD',
    required: true,
    description: 'PostgreSQL password',
    sensitive: true,
  },
  {
    name: 'DB_NAME',
    required: true,
    description: 'PostgreSQL database name',
    defaultValue: 'grc_platform',
  },

  // Authentication - Required
  {
    name: 'JWT_SECRET',
    required: true,
    description: 'Secret key for JWT signing (min 32 chars)',
    sensitive: true,
  },

  // Authentication - Optional
  {
    name: 'JWT_EXPIRES_IN',
    required: false,
    description: 'JWT token expiration time',
    defaultValue: '24h',
  },
  {
    name: 'REFRESH_TOKEN_SECRET',
    required: false,
    description: 'Secret for refresh tokens (defaults to JWT_SECRET)',
    sensitive: true,
  },
  {
    name: 'REFRESH_TOKEN_EXPIRES_IN',
    required: false,
    description: 'Refresh token expiration time',
    defaultValue: '7d',
  },

  // Application - Optional
  {
    name: 'NODE_ENV',
    required: false,
    description: 'Environment mode',
    defaultValue: 'development',
  },
  {
    name: 'PORT',
    required: false,
    description: 'Application port',
    defaultValue: '3002',
  },

  // Demo/Seed - Optional
  {
    name: 'DEMO_ADMIN_EMAIL',
    required: false,
    description: 'Demo admin email for seeding',
    defaultValue: 'admin@grc-platform.local',
  },
  {
    name: 'DEMO_ADMIN_PASSWORD',
    required: false,
    description: 'Demo admin password for seeding',
    sensitive: true,
  },

  // Database Fallbacks (for Docker compatibility)
  {
    name: 'POSTGRES_HOST',
    required: false,
    description: 'Fallback for DB_HOST (Docker)',
  },
  {
    name: 'POSTGRES_PORT',
    required: false,
    description: 'Fallback for DB_PORT (Docker)',
  },
  {
    name: 'POSTGRES_USER',
    required: false,
    description: 'Fallback for DB_USER (Docker)',
  },
  {
    name: 'POSTGRES_PASSWORD',
    required: false,
    description: 'Fallback for DB_PASSWORD (Docker)',
    sensitive: true,
  },
  {
    name: 'POSTGRES_DB',
    required: false,
    description: 'Fallback for DB_NAME (Docker)',
  },

  // Sync mode (staging/dev only)
  {
    name: 'DB_SYNC',
    required: false,
    description: 'TypeORM synchronize mode (NEVER true in production)',
    defaultValue: 'false',
  },

  // LDAP - Optional (disabled by default)
  {
    name: 'LDAP_ENABLED',
    required: false,
    description: 'Enable LDAP authentication',
    defaultValue: 'false',
  },
  {
    name: 'LDAP_URL',
    required: false,
    description: 'LDAP server URL',
  },
  {
    name: 'LDAP_BIND_DN',
    required: false,
    description: 'LDAP bind DN',
  },
  {
    name: 'LDAP_BIND_PASSWORD',
    required: false,
    description: 'LDAP bind password',
    sensitive: true,
  },
];

function getEnvValue(name: string): string | undefined {
  return process.env[name];
}

function hasValue(name: string): boolean {
  const value = getEnvValue(name);
  return value !== undefined && value !== '';
}

function validateEnvironment(): ValidationResult {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';

  const requiredVars = ENV_VARS.filter((v) => v.required);
  const optionalVars = ENV_VARS.filter((v) => !v.required);

  const missingRequired: string[] = [];
  const unconfiguredOptional: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const spec of requiredVars) {
    if (!hasValue(spec.name)) {
      // Check for fallback (e.g., POSTGRES_* for DB_*)
      const fallbackName = spec.name.replace('DB_', 'POSTGRES_');
      if (fallbackName !== spec.name && hasValue(fallbackName)) {
        continue; // Fallback is set
      }

      if (spec.defaultValue !== undefined) {
        warnings.push(
          `${spec.name} not set, using default: ${spec.defaultValue}`,
        );
      } else {
        missingRequired.push(spec.name);
        errors.push(`Missing required environment variable: ${spec.name}`);
      }
    }
  }

  // Check optional variables
  for (const spec of optionalVars) {
    if (!hasValue(spec.name)) {
      unconfiguredOptional.push(spec.name);
    }
  }

  // Additional validation rules
  const jwtSecret = getEnvValue('JWT_SECRET');
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters for security');
  }

  const dbSync = getEnvValue('DB_SYNC');
  if (dbSync === 'true' && environment === 'production') {
    errors.push('DB_SYNC=true is dangerous in production! Set to false.');
  }

  const success = missingRequired.length === 0 && errors.length === 0;

  return {
    success,
    timestamp,
    environment,
    results: {
      required: {
        total: requiredVars.length,
        configured: requiredVars.length - missingRequired.length,
        missing: missingRequired,
      },
      optional: {
        total: optionalVars.length,
        configured: optionalVars.length - unconfiguredOptional.length,
        unconfigured: unconfiguredOptional,
      },
    },
    errors,
    warnings,
  };
}

function printHumanReadable(result: ValidationResult): void {
  console.log('========================================');
  console.log('Environment Validation');
  console.log('========================================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Environment: ${result.environment}`);
  console.log('');

  // Required variables
  console.log('--- Required Variables ---');
  console.log(
    `Configured: ${result.results.required.configured}/${result.results.required.total}`,
  );
  if (result.results.required.missing.length > 0) {
    console.log('Missing:');
    for (const name of result.results.required.missing) {
      const spec = ENV_VARS.find((v) => v.name === name);
      console.log(`  - ${name}: ${spec?.description || 'No description'}`);
    }
  }
  console.log('');

  // Optional variables
  console.log('--- Optional Variables ---');
  console.log(
    `Configured: ${result.results.optional.configured}/${result.results.optional.total}`,
  );
  console.log('');

  // Warnings
  if (result.warnings.length > 0) {
    console.log('--- Warnings ---');
    for (const warning of result.warnings) {
      console.log(`[WARN] ${warning}`);
    }
    console.log('');
  }

  // Errors
  if (result.errors.length > 0) {
    console.log('--- Errors ---');
    for (const error of result.errors) {
      console.log(`[ERROR] ${error}`);
    }
    console.log('');
  }

  // Summary
  console.log('========================================');
  if (result.success) {
    console.log('[SUCCESS] Environment validation passed');
  } else {
    console.log('[FAILED] Environment validation failed');
  }
  console.log('========================================');
}

function printJson(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2));
}

function main(): void {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  const result = validateEnvironment();

  if (jsonOutput) {
    printJson(result);
  } else {
    printHumanReadable(result);
  }

  process.exit(result.success ? 0 : 1);
}

try {
  main();
} catch (error) {
  console.error('Unexpected error:', error);
  process.exit(1);
}
