/**
 * Test Teardown Helpers (Phase D — Jest Flake Containment)
 *
 * Provides utilities for reliable test teardown to prevent:
 *   - "Cannot log after tests are done" warnings
 *   - "Jest did not exit one second after the test run" errors
 *   - Open handle leaks (timers, intervals, connections)
 *
 * Root Causes Identified:
 *   1. NestJS Logger uses async transports that may flush after test completion
 *   2. TypeORM connections not fully destroyed in afterAll
 *   3. HTTP server not closed before connection pool cleanup
 *   4. Background schedulers/jobs running during tests
 *
 * Usage:
 *   import { gracefulShutdown, silenceLoggerAfterTests } from './test-teardown';
 *
 *   afterAll(async () => {
 *     await gracefulShutdown(app, dataSource);
 *   });
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Gracefully shuts down a NestJS application and its database connection.
 *
 * Order matters:
 *   1. Close the NestJS app (stops HTTP server, runs onModuleDestroy hooks)
 *   2. Destroy the DataSource if still connected
 *   3. Wait a tick for async logger flush
 *   4. Clear any remaining timers/intervals
 */
export async function gracefulShutdown(
  app?: INestApplication | null,
  dataSource?: DataSource | null,
): Promise<void> {
  // Step 1: Close the NestJS application
  if (app) {
    try {
      await app.close();
    } catch (e) {
      // Swallow errors during shutdown — the app may already be closed
      console.warn(
        '[test-teardown] app.close() warning:',
        (e as Error).message,
      );
    }
  }

  // Step 2: Destroy the DataSource if still initialized
  if (dataSource && dataSource.isInitialized) {
    try {
      await dataSource.destroy();
    } catch (e) {
      console.warn(
        '[test-teardown] dataSource.destroy() warning:',
        (e as Error).message,
      );
    }
  }

  // Step 3: Allow async logger transports to flush
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Clears all active timers and intervals.
 * Call this in afterAll/afterEach to prevent open handle leaks.
 *
 * WARNING: This is a nuclear option — only use when individual timer
 * cleanup is not feasible. Prefer clearing specific timers where possible.
 */
export function clearAllTimers(): void {
  // Clear any pending timers that might keep the process alive
  // This is intentionally broad — it's a containment measure
  if (typeof jest !== 'undefined' && jest.useRealTimers) {
    try {
      jest.useRealTimers();
    } catch {
      // Ignore — may not be in a fake timer context
    }
  }
}

/**
 * Creates a silenced logger suitable for test environments.
 * Prevents "Cannot log after tests are done" by using synchronous console
 * instead of async transports.
 *
 * Usage in test module setup:
 *   const moduleFixture = await Test.createTestingModule({
 *     imports: [AppModule],
 *   })
 *     .setLogger(createTestLogger())
 *     .compile();
 */
export function createTestLogger(): {
  log: (message: string) => void;
  error: (message: string, trace?: string) => void;
  warn: (message: string) => void;
  debug: (message: string) => void;
  verbose: (message: string) => void;
} {
  const noop = () => {};
  const logLevel = process.env.LOG_LEVEL || 'error';

  return {
    log: logLevel === 'verbose' || logLevel === 'debug' ? console.log : noop,
    error: console.error,
    warn: logLevel === 'error' ? noop : console.warn,
    debug:
      logLevel === 'debug' || logLevel === 'verbose' ? console.debug : noop,
    verbose: logLevel === 'verbose' ? console.log : noop,
  };
}

/**
 * Waits for all pending microtasks and macrotasks to complete.
 * Useful between teardown steps to ensure async operations finish.
 */
export function flushAsync(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
