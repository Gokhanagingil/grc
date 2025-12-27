#!/usr/bin/env ts-node
/**
 * Memory and Swap Check Script
 *
 * Checks available memory and swap before resource-intensive operations
 * like Docker builds. Warns if resources are below recommended thresholds.
 *
 * Usage:
 *   npx ts-node src/scripts/check-memory.ts
 *   # or after build:
 *   node dist/scripts/check-memory.js
 *
 * Recommended minimums for frontend build:
 *   - Available RAM: 1GB
 *   - Swap: 2GB configured and active
 */

import * as fs from 'fs';
import * as os from 'os';

interface MemoryInfo {
  totalMB: number;
  freeMB: number;
  availableMB: number;
}

interface SwapInfo {
  totalMB: number;
  usedMB: number;
  freeMB: number;
  active: boolean;
}

const MIN_AVAILABLE_RAM_MB = 1024;
const MIN_SWAP_MB = 2048;

function getMemoryInfo(): MemoryInfo {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();

  let availableBytes = freeBytes;
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const availableMatch = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
    if (availableMatch) {
      availableBytes = parseInt(availableMatch[1], 10) * 1024;
    }
  } catch {
    availableBytes = freeBytes;
  }

  return {
    totalMB: Math.round(totalBytes / 1024 / 1024),
    freeMB: Math.round(freeBytes / 1024 / 1024),
    availableMB: Math.round(availableBytes / 1024 / 1024),
  };
}

function getSwapInfo(): SwapInfo {
  try {
    // Read swap information from /proc/swaps
    const swapsContent = fs.readFileSync('/proc/swaps', 'utf8');
    const lines = swapsContent.trim().split('\n');

    // Skip header line (first line)
    if (lines.length <= 1) {
      return { totalMB: 0, usedMB: 0, freeMB: 0, active: false };
    }

    let totalBytes = 0;
    let usedBytes = 0;

    // Parse swap entries (format: Filename Type Size Used Priority)
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length >= 4) {
        // Size is in KB, convert to bytes
        const sizeKB = parseInt(parts[2], 10) || 0;
        const usedKB = parseInt(parts[3], 10) || 0;
        totalBytes += sizeKB * 1024;
        usedBytes += usedKB * 1024;
      }
    }

    return {
      totalMB: Math.round(totalBytes / 1024 / 1024),
      usedMB: Math.round(usedBytes / 1024 / 1024),
      freeMB: Math.round((totalBytes - usedBytes) / 1024 / 1024),
      active: totalBytes > 0,
    };
  } catch {
    // If /proc/swaps doesn't exist or is unreadable, return unknown state
    return { totalMB: 0, usedMB: 0, freeMB: 0, active: false };
  }
}

function checkSwapPersistence(): boolean {
  try {
    const fstab = fs.readFileSync('/etc/fstab', 'utf8');
    return fstab.includes('swapfile') || fstab.includes('swap');
  } catch {
    return false;
  }
}

function formatMB(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)}GB`;
  }
  return `${mb}MB`;
}

function main(): void {
  console.log('=== Memory and Swap Check ===\n');

  const memory = getMemoryInfo();
  const swap = getSwapInfo();
  const swapPersistent = checkSwapPersistence();

  console.log('Memory:');
  console.log(`  Total:     ${formatMB(memory.totalMB)}`);
  console.log(`  Free:      ${formatMB(memory.freeMB)}`);
  console.log(`  Available: ${formatMB(memory.availableMB)}`);
  console.log();

  console.log('Swap:');
  if (swap.active) {
    console.log(`  Total:      ${formatMB(swap.totalMB)}`);
    console.log(`  Used:       ${formatMB(swap.usedMB)}`);
    console.log(`  Free:       ${formatMB(swap.freeMB)}`);
    console.log(
      `  Persistent: ${swapPersistent ? 'Yes (in fstab)' : 'No (will not survive reboot)'}`,
    );
  } else {
    console.log('  Status: NOT ACTIVE');
  }
  console.log();

  const warnings: string[] = [];
  const errors: string[] = [];

  if (memory.availableMB < MIN_AVAILABLE_RAM_MB) {
    warnings.push(
      `Available RAM (${formatMB(memory.availableMB)}) is below recommended minimum (${formatMB(MIN_AVAILABLE_RAM_MB)})`,
    );
  }

  if (!swap.active) {
    errors.push(
      'Swap is not active. Frontend builds may fail with OOM errors.',
    );
  } else if (swap.totalMB < MIN_SWAP_MB) {
    warnings.push(
      `Swap size (${formatMB(swap.totalMB)}) is below recommended minimum (${formatMB(MIN_SWAP_MB)})`,
    );
  }

  if (!swapPersistent && swap.active) {
    warnings.push(
      'Swap is not configured in /etc/fstab and will not persist after reboot.',
    );
  }

  if (errors.length > 0) {
    console.log('ERRORS:');
    errors.forEach((e) => console.log(`  [ERROR] ${e}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.log('WARNINGS:');
    warnings.forEach((w) => console.log(`  [WARN] ${w}`));
    console.log();
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log(
      '[OK] Memory and swap configuration meets recommended thresholds.',
    );
    console.log('     Safe to proceed with resource-intensive builds.');
  } else if (errors.length > 0) {
    console.log(
      '[FAIL] Critical issues detected. Resolve before proceeding with builds.',
    );
    process.exit(1);
  } else {
    console.log(
      '[WARN] Some warnings detected. Builds may succeed but consider addressing warnings.',
    );
  }
}

main();
