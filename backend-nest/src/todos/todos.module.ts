import { Module } from '@nestjs/common';
import { TodosController } from './todos.controller';

/**
 * Todos Module
 *
 * Provides a minimal in-memory todo list for demo purposes.
 * This module does not use database persistence to avoid migrations.
 * Data is stored in memory and resets on server restart.
 */
@Module({
  controllers: [TodosController],
})
export class TodosModule {}
