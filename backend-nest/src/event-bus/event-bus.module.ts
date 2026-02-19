import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysEvent } from './entities/sys-event.entity';
import { EventBusService } from './event-bus.service';
import { EventLogController } from './event-log.controller';
import { EventBridgeListener } from './event-bridge.listener';
import { GuardsModule } from '../common/guards';

@Module({
  imports: [TypeOrmModule.forFeature([SysEvent]), GuardsModule],
  controllers: [EventLogController],
  providers: [EventBusService, EventBridgeListener],
  exports: [EventBusService],
})
export class EventBusModule {}
