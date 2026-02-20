import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

/**
 * Events Module
 *
 * Configures the event emitter for domain events.
 * This module should be imported in AppModule to enable
 * event-driven architecture across the application.
 */
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Use wildcards for flexible event matching
      wildcard: false,
      // Delimiter for namespaced events (e.g., 'user.logged_in')
      delimiter: '.',
      // Throw errors if no listeners are registered
      newListener: false,
      // Remove listeners on module destroy
      removeListener: false,
      // Maximum number of listeners per event
      maxListeners: 10,
      // Show event name in memory leak message
      verboseMemoryLeak: true,
      // Disable throwing uncaughtException if an error event is emitted
      ignoreErrors: false,
    }),
  ],
  exports: [EventEmitterModule],
})
export class EventsModule {}
