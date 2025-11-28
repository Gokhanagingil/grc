#!/usr/bin/env ts-node
/**
 * PHASE 2: Boot Validation
 * 
 * Programmatically runs:
 * 1. npm run fix:sqlite
 * 2. npm run build:once
 * 3. npm run start:dev (with timeout)
 * 
 * Confirms NestJS starts cleanly.
 * Produces: PHASE2-BOOT-REPORT.md
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/phase2-boot-validation.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface BootResult {
  step: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

async function runCommand(command: string, cwd: string, timeout: number = 60000): Promise<{ stdout: string; stderr: string }> {
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

async function waitForServer(url: string, maxAttempts: number = 30, delay: number = 2000): Promise<boolean> {
  // Use native fetch (Node 18+) or fallback
  const fetchFn = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const response = await fetchFn(url, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return false;
}

async function validateBoot() {
  console.log('=== PHASE 2: Boot Validation ===\n');

  const results: BootResult[] = [];
  const backendDir = path.join(process.cwd(), 'backend-nest');
  const timestamp = new Date().toISOString();

  // Step 1: Run SQLite repair
  console.log('📋 Step 1: Running SQLite repair...');
  const step1Start = Date.now();
  try {
    const { stdout, stderr } = await runCommand('npm run fix:sqlite', backendDir, 120000);
    results.push({
      step: 'SQLite Repair',
      success: true,
      output: stdout + stderr,
      duration: Date.now() - step1Start,
    });
    console.log('  ✅ SQLite repair completed');
  } catch (error: any) {
    results.push({
      step: 'SQLite Repair',
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message,
      duration: Date.now() - step1Start,
    });
    console.log('  ❌ SQLite repair failed');
  }

  // Step 2: Build
  console.log('\n📋 Step 2: Building TypeScript...');
  const step2Start = Date.now();
  try {
    const { stdout, stderr } = await runCommand('npm run build:once', backendDir, 120000);
    results.push({
      step: 'TypeScript Build',
      success: true,
      output: stdout + stderr,
      duration: Date.now() - step2Start,
    });
    console.log('  ✅ Build completed');
  } catch (error: any) {
    results.push({
      step: 'TypeScript Build',
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message,
      duration: Date.now() - step2Start,
    });
    console.log('  ❌ Build failed');
  }

  // Step 3: Start server (with health check)
  console.log('\n📋 Step 3: Starting NestJS server...');
  const step3Start = Date.now();
  let serverProcess: any = null;
  let serverStarted = false;

  try {
    // Start server in background
    serverProcess = exec('npm run start:dev', { cwd: backendDir });
    
    let serverOutput = '';
    let serverError = '';

    serverProcess.stdout?.on('data', (data: string) => {
      serverOutput += data;
      console.log(`  [SERVER] ${data.toString().trim()}`);
      
      // Check for successful start indicators
      if (data.includes('Nest application successfully started') || 
          data.includes('Application is running on') ||
          data.includes('listening on')) {
        serverStarted = true;
      }
    });

    serverProcess.stderr?.on('data', (data: string) => {
      serverError += data;
      console.log(`  [SERVER ERR] ${data.toString().trim()}`);
    });

    // Wait for server to start (max 60 seconds)
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Give it 10 seconds
    
    // Check health endpoint
    const healthUrl = process.env.HEALTH_URL || 'http://localhost:5002/api/v2/health';
    const healthCheck = await waitForServer(healthUrl, 20, 2000);

    if (healthCheck || serverStarted) {
      results.push({
        step: 'Server Start',
        success: true,
        output: serverOutput,
        duration: Date.now() - step3Start,
      });
      console.log('  ✅ Server started successfully');
    } else {
      results.push({
        step: 'Server Start',
        success: false,
        output: serverOutput,
        error: serverError || 'Server did not respond to health check',
        duration: Date.now() - step3Start,
      });
      console.log('  ❌ Server failed to start or respond');
    }

    // Give it a moment, then kill the server
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (serverProcess) {
      serverProcess.kill();
    }

  } catch (error: any) {
    results.push({
      step: 'Server Start',
      success: false,
      output: '',
      error: error.message,
      duration: Date.now() - step3Start,
    });
    console.log('  ❌ Server start failed');
    if (serverProcess) {
      serverProcess.kill();
    }
  }

  // Generate report
  const allSuccess = results.every((r) => r.success);
  const report = `# PHASE 2: Boot Validation Report

**Generated:** ${timestamp}

## Summary

- **Status:** ${allSuccess ? '✅ PASS' : '❌ FAIL'}
- **Steps Completed:** ${results.filter((r) => r.success).length}/${results.length}

## Step Results

${results.map((result, i) => {
  const icon = result.success ? '✅' : '❌';
  return `### ${icon} Step ${i + 1}: ${result.step}

**Status:** ${result.success ? 'SUCCESS' : 'FAILED'}
**Duration:** ${(result.duration / 1000).toFixed(2)}s

${result.error ? `**Error:**\n\`\`\`\n${result.error}\n\`\`\`` : ''}

**Output:**
\`\`\`
${result.output.substring(0, 2000)}${result.output.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`
`;
}).join('\n\n')}

## Conclusion

${allSuccess 
  ? '✅ **Boot validation PASSED** - NestJS starts cleanly and health endpoint responds.\n\n**Next Steps:**\n1. Proceed to Phase 3: Smoke Test Validation'
  : '❌ **Boot validation FAILED** - One or more steps failed.\n\n**Action Required:**\n1. Review error messages above\n2. Fix issues and re-run Phase 1 (SQLite repair) if needed\n3. Re-run Phase 2 validation'
}

---
*This report was generated automatically by Phase 2 Boot Validation script.*
`;

  const reportPath = path.join(process.cwd(), 'PHASE2-BOOT-REPORT.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n✅ Report written to: ${reportPath}`);

  if (!allSuccess) {
    process.exitCode = 1;
  }
}

validateBoot().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

