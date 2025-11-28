#!/usr/bin/env ts-node
/**
 * PHASE 3: Smoke Test Validation
 * 
 * Programmatically runs:
 * - npm run smoke:policies
 * - npm run smoke:governance
 * - npm run smoke:all
 * 
 * If ANY fail, reports issues.
 * Produces: PHASE3-SMOKE-REPORT.md
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/phase3-smoke-validation.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface SmokeTestResult {
  test: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

async function runCommand(command: string, cwd: string, timeout: number = 120000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const process = exec(command, { cwd, timeout }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function validateSmokeTests() {
  console.log('=== PHASE 3: Smoke Test Validation ===\n');

  const results: SmokeTestResult[] = [];
  const backendDir = path.join(process.cwd(), 'backend-nest');
  const timestamp = new Date().toISOString();

  const smokeTests = [
    { name: 'Policies', command: 'npm run smoke:policies' },
    { name: 'Governance', command: 'npm run smoke:governance' },
    { name: 'All Smoke Tests', command: 'npm run smoke:all' },
  ];

  for (const test of smokeTests) {
    console.log(`📋 Running: ${test.name}...`);
    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await runCommand(test.command, backendDir);
      const output = stdout + stderr;
      const success = !output.includes('FAIL') && !output.includes('Error') && !output.includes('❌');
      
      results.push({
        test: test.name,
        success,
        output,
        duration: Date.now() - startTime,
      });
      
      console.log(`  ${success ? '✅' : '❌'} ${test.name} ${success ? 'PASSED' : 'FAILED'}`);
    } catch (error: any) {
      results.push({
        test: test.name,
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
        duration: Date.now() - startTime,
      });
      console.log(`  ❌ ${test.name} FAILED`);
    }
  }

  // Generate report
  const allPassed = results.every((r) => r.success);
  const report = `# PHASE 3: Smoke Test Validation Report

**Generated:** ${timestamp}

## Summary

- **Status:** ${allPassed ? '✅ PASS' : '❌ FAIL'}
- **Tests Passed:** ${results.filter((r) => r.success).length}/${results.length}

## Test Results

${results.map((result) => {
  const icon = result.success ? '✅' : '❌';
  return `### ${icon} ${result.test}

**Status:** ${result.success ? 'PASS' : 'FAIL'}
**Duration:** ${(result.duration / 1000).toFixed(2)}s

${result.error ? `**Error:**\n\`\`\`\n${result.error}\n\`\`\`` : ''}

**Output:**
\`\`\`
${result.output.substring(0, 3000)}${result.output.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`
`;
}).join('\n\n')}

## Conclusion

${allPassed 
  ? '✅ **All smoke tests PASSED** - System is functioning correctly.\n\n**Next Steps:**\n1. Proceed to Phase 4: System Integrity Verification'
  : '❌ **Some smoke tests FAILED** - Issues detected.\n\n**Action Required:**\n1. Review failed test outputs above\n2. Fix backend root cause (safe changes only)\n3. DO NOT touch migrations\n4. DO NOT touch schema explorer\n5. Re-run Phase 3 validation'
}

---
*This report was generated automatically by Phase 3 Smoke Test Validation script.*
`;

  const reportPath = path.join(process.cwd(), 'PHASE3-SMOKE-REPORT.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n✅ Report written to: ${reportPath}`);

  if (!allPassed) {
    process.exitCode = 1;
  }
}

validateSmokeTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

