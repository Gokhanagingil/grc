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

type SwapPersistenceStatus = 'yes' | 'no' | 'unknown';

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

    // Parse swap entries
    // Format can be either:
    // 1. Normal: "Filename Type Size Used Priority" (5 fields)
    // 2. Merged: "Filename TypeSize Used Priority" (4 fields, TypeSize like "file2097148")
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }

      const tokens = line.split(/\s+/);
      if (tokens.length < 3) {
        continue;
      }

      let sizeKB = 0;
      let usedKB = 0;

      try {
        // Check if tokens[1] is merged TypeSize format (e.g., "file2097148")
        const typeSizeMatch = tokens[1].match(/^([A-Za-z_]+)(\d+)$/);
        if (typeSizeMatch) {
          // Merged format: TypeSize is combined
          // tokens[0] = Filename
          // tokens[1] = TypeSize (e.g., "file2097148")
          // tokens[2] = Used
          // tokens[3] = Priority (optional)
          sizeKB = parseInt(typeSizeMatch[2], 10) || 0;
          usedKB = parseInt(tokens[2], 10) || 0;
        } else {
          // Normal format: Type and Size are separate
          // tokens[0] = Filename
          // tokens[1] = Type
          // tokens[2] = Size
          // tokens[3] = Used
          // tokens[4] = Priority (optional)
          if (tokens.length >= 4) {
            sizeKB = parseInt(tokens[2], 10) || 0;
            usedKB = parseInt(tokens[3], 10) || 0;
          }
        }

        // Values are in KiB (from /proc/swaps), convert to bytes
        totalBytes += sizeKB * 1024;
        usedBytes += usedKB * 1024;
      } catch {
        // Skip this line if parsing fails, continue with next entry
        continue;
      }
    }

    return {
      totalMB: Math.round(totalBytes / 1024 / 1024),
      usedMB: Math.round(usedBytes / 1024 / 1024),
      freeMB: Math.round((totalBytes - usedBytes) / 1024 / 1024),
      active: totalBytes > 0,
    };
  } catch {
    // If /proc/swaps doesn't exist or is unreadable, return empty state
    return { totalMB: 0, usedMB: 0, freeMB: 0, active: false };
  }
}

function checkSwapPersistence(): SwapPersistenceStatus {
  // Support override via environment variable (for future host fstab mounting)
  const fstabPath = process.env.CHECK_MEMORY_FSTAB_PATH || '/etc/fstab';

  let fd: number | null = null;
  try {
    // Open file descriptor (will throw if file doesn't exist)
    // Using file descriptor eliminates TOCTOU (Time-of-check-time-of-use) race condition
    fd = fs.openSync(fstabPath, 'r');

    // Get file stats from file descriptor (safe, no path race condition)
    const stats = fs.fstatSync(fd);

    // Heuristic: If fstab is very small (< 300 bytes), it's likely a container stub
    // that doesn't reflect the host's actual fstab
    const isLikelyContainerStub = stats.size < 300;

    // Read file content using the file descriptor
    // Allocate buffer based on actual file size from fstat
    const buffer = Buffer.alloc(stats.size);
    const bytesRead = fs.readSync(fd, buffer, 0, stats.size, 0);
    const fstab = buffer.toString('utf8', 0, bytesRead);

    // Additional heuristic: Check if fstab contains only container stub content
    // (cdrom/usbdisk entries, or very minimal content unrelated to swap)
    const hasOnlyStubContent =
      (fstab.includes('cdrom') || fstab.includes('usbdisk')) &&
      !fstab.includes('/swapfile') &&
      !/^\s*[^#].*\sswap\s/.test(fstab);

    // Check if fstab contains swap-related entries
    const hasSwapEntry =
      fstab.includes('/swapfile') || /^\s*[^#].*\sswap\s/.test(fstab);

    // If it looks like a container stub and no swap entry, return 'unknown'
    if ((isLikelyContainerStub || hasOnlyStubContent) && !hasSwapEntry) {
      return 'unknown';
    }

    // Real host fstab: return 'yes' if swap entry exists, 'no' otherwise
    if (hasSwapEntry) {
      return 'yes';
    }

    // Normal-sized fstab without swap entry = not persistent
    return 'no';
  } catch {
    // If fstab doesn't exist or is unreadable, cannot determine
    return 'unknown';
  } finally {
    // Always close the file descriptor if it was opened
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close errors
      }
    }
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
    const persistenceLabel =
      swapPersistent === 'yes'
        ? 'Yes (in fstab)'
        : swapPersistent === 'unknown'
          ? 'Unknown (container fstab)'
          : 'No (will not survive reboot)';
    console.log(`  Persistent: ${persistenceLabel}`);
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

  // Only warn if persistence is definitively 'no' (not 'unknown')
  // Container environments may show 'unknown' and should not trigger warnings
  if (swapPersistent === 'no' && swap.active) {
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
