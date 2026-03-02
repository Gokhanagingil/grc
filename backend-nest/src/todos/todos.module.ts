import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';
import { TodoTask, TodoBoard, TodoBoardColumn, TodoTag, TodoTaskTag } from './entities';
import { TenantsModule } from '../tenants/tenants.module';
import { NotificationEngineModule } from '../notification-engine/notification-engine.module';

/**
 * Todos Module
 *
 * Provides CRUD for To-Do tasks and Kanban boards with PostgreSQL persistence.
 * Replaces the previous in-memory implementation that lost data on restart.
 *
 * Imports TenantsModule to ensure TenantGuard dependencies are available
 * during app bootstrap (required for E2E tests).
 *
 * Imports NotificationEngineModule for task-assignment notifications (Goal B).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TodoTask, TodoBoard, TodoBoardColumn, TodoTag, TodoTaskTag]),
    TenantsModule,
    NotificationEngineModule,
  ],
  controllers: [TodosController],
  providers: [TodosService],
  exports: [TodosService],
})
export class TodosModule {}
