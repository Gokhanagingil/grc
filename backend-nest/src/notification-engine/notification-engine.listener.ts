import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SysEvent } from '../event-bus/entities/sys-event.entity';
import { EventBusService } from '../event-bus/event-bus.service';
import { NotificationEngineService } from './services/notification-engine.service';
import { StructuredLoggerService } from '../common/logger';

@Injectable()
export class NotificationEngineListener {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly engineService: NotificationEngineService,
    private readonly eventBusService: EventBusService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('NotificationEngineListener');
  }

  @OnEvent('sys.event')
  async onSysEvent(event: SysEvent): Promise<void> {
    try {
      await this.engineService.processEvent(event);
      await this.eventBusService.markProcessed(event.id);
    } catch (error) {
      this.logger.error('Failed to process event for notifications', {
        eventId: event.id,
        eventName: event.eventName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await this.eventBusService.markFailed(event.id);
    }
  }
}
