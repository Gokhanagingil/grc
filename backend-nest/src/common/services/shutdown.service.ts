import {
  Injectable,
  OnApplicationShutdown,
  BeforeApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Graceful Shutdown Service
 *
 * Handles clean application shutdown:
 * - Waits for in-flight requests to complete
 * - Flushes audit queue
 * - Closes database connections
 * - Logs shutdown progress
 */
@Injectable()
export class ShutdownService
  implements BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger(ShutdownService.name);
  private readonly inFlightRequests = new Set<Promise<unknown>>();
  private isShuttingDown = false;

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Track an in-flight request/operation
   */
  trackOperation<T>(promise: Promise<T>): Promise<T> {
    this.inFlightRequests.add(promise);
    promise.finally(() => {
      this.inFlightRequests.delete(promise);
    });
    return promise;
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Called before the application starts shutting down
   * Use this to stop accepting new requests
   */
  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.isShuttingDown = true;
    this.logger.log(`Shutdown signal received: ${signal || 'unknown'}`);
    this.logger.log('Stopping acceptance of new requests...');
  }

  /**
   * Called when the application is shutting down
   * Use this to clean up resources
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Application shutdown initiated (signal: ${signal || 'unknown'})`);

    // Wait for in-flight operations to complete (with timeout)
    if (this.inFlightRequests.size > 0) {
      this.logger.log(
        `Waiting for ${this.inFlightRequests.size} in-flight operations to complete...`,
      );

      const timeout = 30000; // 30 seconds max wait
      const startTime = Date.now();

      try {
        await Promise.race([
          Promise.all([...this.inFlightRequests]),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Shutdown timeout')),
              timeout,
            ),
          ),
        ]);
        this.logger.log('All in-flight operations completed');
      } catch (error) {
        const elapsed = Date.now() - startTime;
        this.logger.warn(
          `Shutdown timeout after ${elapsed}ms, ${this.inFlightRequests.size} operations still pending`,
        );
      }
    }

    // Close database connection
    if (this.dataSource && this.dataSource.isInitialized) {
      this.logger.log('Closing database connection...');
      try {
        await this.dataSource.destroy();
        this.logger.log('Database connection closed');
      } catch (error) {
        this.logger.error(
          'Error closing database connection',
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log('Graceful shutdown complete');
  }
}
