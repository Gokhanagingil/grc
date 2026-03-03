import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NotificationEngineService } from './notification-engine.service';
import { StructuredLoggerService } from '../../common/logger';

/**
 * SnoozeReminderScannerService
 *
 * Periodically scans for:
 * 1. Snoozed notifications whose snoozeUntil has passed → reactivate them
 * 2. Pending personal reminders whose remindAt has passed → activate them
 *
 * Runs every 60 seconds. Disabled in test environment via NODE_ENV check.
 */
@Injectable()
export class SnoozeReminderScannerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger: StructuredLoggerService;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  /** Scan interval: 60 seconds */
  private static readonly SCAN_INTERVAL_MS = 60 * 1000;

  constructor(
    private readonly engineService: NotificationEngineService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('SnoozeReminderScannerService');
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('Snooze/reminder scanner disabled in test environment');
      return;
    }

    this.logger.log('Starting snooze/reminder scanner', {
      intervalMs: SnoozeReminderScannerService.SCAN_INTERVAL_MS,
    });

    // Initial scan after a short delay
    this.timeoutHandle = setTimeout(() => {
      this.timeoutHandle = null;
      this.scan().catch((err) =>
        this.logger.error('Initial snooze/reminder scan failed', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }, 15_000);

    this.intervalHandle = setInterval(() => {
      this.scan().catch((err) =>
        this.logger.error('Scheduled snooze/reminder scan failed', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }, SnoozeReminderScannerService.SCAN_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.log('Snooze/reminder scanner stopped');
  }

  async scan(): Promise<{ reactivated: number; remindersActivated: number }> {
    let reactivated = 0;
    let remindersActivated = 0;

    try {
      reactivated =
        await this.engineService.reactivateSnoozedNotifications();
      remindersActivated =
        await this.engineService.activatePendingReminders();

      if (reactivated > 0 || remindersActivated > 0) {
        this.logger.log('Snooze/reminder scan completed', {
          reactivated,
          remindersActivated,
        });
      }
    } catch (error) {
      this.logger.error('Snooze/reminder scan error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return { reactivated, remindersActivated };
  }
}
