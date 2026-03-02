import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTodoTagsTables1743300000000 implements MigrationInterface {
  name = 'AddTodoTagsTables1743300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TodoTag table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "todo_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "color" varchar(7),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_todo_tags" PRIMARY KEY ("id"),
        CONSTRAINT "FK_todo_tags_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_tags_tenant"
        ON "todo_tags" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_todo_tags_tenant_name_active"
        ON "todo_tags" ("tenant_id", "name") WHERE "is_deleted" = false
    `);

    // TodoTaskTag join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "todo_task_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "task_id" uuid NOT NULL,
        "tag_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_todo_task_tags" PRIMARY KEY ("id"),
        CONSTRAINT "FK_todo_task_tags_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_todo_task_tags_task" FOREIGN KEY ("task_id")
          REFERENCES "todo_tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_todo_task_tags_tag" FOREIGN KEY ("tag_id")
          REFERENCES "todo_tags"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_todo_task_tags_tenant_task_tag"
        ON "todo_task_tags" ("tenant_id", "task_id", "tag_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_task_tags_task"
        ON "todo_task_tags" ("task_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_todo_task_tags_tag"
        ON "todo_task_tags" ("tag_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "todo_task_tags" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "todo_tags" CASCADE`);
  }
}
