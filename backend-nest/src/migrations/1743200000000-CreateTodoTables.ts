import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTodoTables1743200000000 implements MigrationInterface {
  name = 'CreateTodoTables1743200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TodoBoard table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "todo_boards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "visibility" varchar(50) NOT NULL DEFAULT 'TEAM',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_todo_boards" PRIMARY KEY ("id"),
        CONSTRAINT "FK_todo_boards_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_boards_tenant"
        ON "todo_boards" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_boards_tenant_name"
        ON "todo_boards" ("tenant_id", "name")
    `);

    // Partial unique index to prevent duplicate active boards per tenant+name
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_todo_boards_tenant_name_active"
        ON "todo_boards" ("tenant_id", "name") WHERE "is_deleted" = false
    `);

    // TodoBoardColumn table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "todo_board_columns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "board_id" uuid NOT NULL,
        "key" varchar(100) NOT NULL,
        "title" varchar(255) NOT NULL,
        "order_index" int NOT NULL DEFAULT 0,
        "wip_limit" int,
        "is_done_column" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_todo_board_columns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_todo_board_columns_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_todo_board_columns_board" FOREIGN KEY ("board_id")
          REFERENCES "todo_boards"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_board_columns_tenant"
        ON "todo_board_columns" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_board_columns_board_order"
        ON "todo_board_columns" ("tenant_id", "board_id", "order_index")
    `);

    // TodoTask table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "todo_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "title" varchar(500) NOT NULL,
        "description" text,
        "status" varchar(50) NOT NULL DEFAULT 'todo',
        "priority" varchar(50) NOT NULL DEFAULT 'medium',
        "due_date" timestamptz,
        "assignee_user_id" uuid,
        "owner_group_id" uuid,
        "tags" jsonb,
        "sort_order" int NOT NULL DEFAULT 0,
        "board_id" uuid,
        "category" varchar(255),
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_todo_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_todo_tasks_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_todo_tasks_board" FOREIGN KEY ("board_id")
          REFERENCES "todo_boards"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_tasks_tenant"
        ON "todo_tasks" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_tasks_tenant_board"
        ON "todo_tasks" ("tenant_id", "board_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_tasks_tenant_status"
        ON "todo_tasks" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_tasks_tenant_assignee"
        ON "todo_tasks" ("tenant_id", "assignee_user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_tasks_tenant_due_date"
        ON "todo_tasks" ("tenant_id", "due_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_tasks_tenant_priority"
        ON "todo_tasks" ("tenant_id", "priority")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_tasks_tenant_sort_order"
        ON "todo_tasks" ("tenant_id", "sort_order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "todo_tasks" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "todo_board_columns" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "todo_boards" CASCADE`);
  }
}
