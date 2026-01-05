import { Module } from '@nestjs/common';
import { TodosController } from './todos.controller';
import { TenantsModule } from '../tenants/tenants.module';

/**
 * Todos Module
 *
 * Provides a minimal in-memory todo list for demo purposes.
 * This module does not use database persistence to avoid migrations.
 * Data is stored in memory and resets on server restart.
 */
@Module({
  imports: [TenantsModule],
  controllers: [TodosController],
})
export class TodosModule {}
