import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysUserNotification } from '../entities/sys-user-notification.entity';
import { NotificationTriggerService } from './notification-trigger.service';
import { StructuredLoggerService } from '../../common/logger';

/**
 * DueDateScannerService
 *
 * Periodically scans for todo tasks approaching their due date (within 24h)
 * and creates notifications for the assigned users.
 *
 * Runs every 30 minutes. Disabled in test environment via NODE_ENV check.
 *
 * Roadmap:
 * - v0: Simple interval-based scanner for todo tasks
 * - v1: Extend to GRC/ITSM entities (risks, incidents, CAPAs)
 * - v2: Configurable scan intervals per tenant
 */
@Injectable()
export class DueDateScannerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: StructuredLoggerService;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  /** Scan interval: 30 minutes */
  private static readonly SCAN_INTERVAL_MS = 30 * 60 * 1000;

  /** Look-ahead window: 24 hours */
  private static readonly LOOKAHEAD_HOURS = 24;

  constructor(
    private readonly triggerService: NotificationTriggerService,
    @InjectRepository(SysUserNotification)
    private readonly notifRepo: Repository<SysUserNotification>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('DueDateScannerService');
  }

  onModuleInit(): void {
    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('Due-date scanner disabled in test environment');
      return;
    }

    this.logger.log('Starting due-date scanner', {
      intervalMs: DueDateScannerService.SCAN_INTERVAL_MS,
      lookaheadHours: DueDateScannerService.LOOKAHEAD_HOURS,
    });

    // Run initial scan after a short delay to let the app fully bootstrap
    setTimeout(() => {
      this.scan().catch((err) =>
        this.logger.error('Initial due-date scan failed', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }, 10_000);

    this.intervalHandle = setInterval(() => {
      this.scan().catch((err) =>
        this.logger.error('Scheduled due-date scan failed', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }, DueDateScannerService.SCAN_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log('Due-date scanner stopped');
    }
  }

  /**
   * Scan all tenants for tasks with approaching due dates.
   */
  async scan(): Promise<number> {
    let totalNotified = 0;

    try {
      // Get distinct tenant IDs that have todo tasks
      const tenants: Array<{ tenant_id: string }> =
        await this.notifRepo.manager.query(
          `SELECT DISTINCT tenant_id FROM todo_tasks WHERE is_deleted = false AND due_date IS NOT NULL LIMIT 1000`,
        );

      for (const row of tenants) {
        const count = await this.scanTenant(row.tenant_id);
        totalNotified += count;
      }

      if (totalNotified > 0) {
        this.logger.log('Due-date scan completed', {
          tenantsScanned: tenants.length,
          notificationsCreated: totalNotified,
        });
      }
    } catch (error) {
      this.logger.error('Due-date scan error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return totalNotified;
  }

  /**
   * Scan a single tenant for tasks approaching due date.
   */
  private async scanTenant(tenantId: string): Promise<number> {
    const tasks = await this.triggerService.findTasksDueSoon(
      tenantId,
      DueDateScannerService.LOOKAHEAD_HOURS,
    );

    let count = 0;
    for (const task of tasks) {
      try {
        await this.triggerService.notifyDueDateApproaching(
          tenantId,
          task.assigneeUserId,
          task.id,
          task.title,
          new Date(task.dueDate),
        );
        count++;
      } catch (error) {
        this.logger.error('Failed to create due-date notification', {
          tenantId,
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return count;
  }
}
