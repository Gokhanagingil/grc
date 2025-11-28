import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to create calendar_events table
 * 
 * This table stores calendar events for audit engagements, BCP exercises,
 * risk reviews, control tests, maintenance windows, and other scheduled activities.
 */
export class CreateCalendarEventsTable1739000000000
  implements MigrationInterface
{
  name = 'CreateCalendarEventsTable1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // Helper function to check if table exists
    const tableExists = async (table: string): Promise<boolean> => {
      const tableName = table.includes('.') ? table.split('.')[1] : table;
      const schema = table.includes('.') ? table.split('.')[0] : isPostgres ? 'public' : null;

      if (isPostgres) {
        const result = await queryRunner.query(
          `
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = $1 AND table_name = $2
          ) as exists;
        `,
          [schema || 'public', tableName],
        );
        return result[0]?.exists || false;
      } else {
        const tables = await queryRunner.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
          [tableName],
        );
        return tables.length > 0;
      }
    };

    const calendarEventsTable = isPostgres
      ? 'public.calendar_events'
      : 'calendar_events';
    const calendarEventsExists = await tableExists(calendarEventsTable);

    if (!calendarEventsExists) {
      const uuidType = isPostgres ? 'UUID' : 'TEXT';
      const timestampType = isPostgres ? 'TIMESTAMPTZ' : 'TEXT';
      const timestampDefault = isPostgres ? 'DEFAULT now()' : 'DEFAULT CURRENT_TIMESTAMP';
      const textType = isPostgres ? 'TEXT' : 'TEXT';
      const varcharType = (length: number) => `VARCHAR(${length})`;

      const calendarEventsTableSql = isPostgres
        ? `
        CREATE TABLE public.calendar_events (
          id ${uuidType} PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id ${uuidType} NOT NULL,
          title ${textType} NOT NULL,
          description ${textType},
          event_type ${varcharType(50)} NOT NULL DEFAULT 'OTHER',
          source_module ${varcharType(50)},
          source_entity ${varcharType(100)},
          source_id ${uuidType},
          start_at ${timestampType} NOT NULL,
          end_at ${timestampType},
          status ${varcharType(50)} NOT NULL DEFAULT 'PLANNED',
          location ${textType},
          owner_user_id ${uuidType},
          color_hint ${varcharType(20)},
          created_by ${uuidType},
          updated_by ${uuidType},
          created_at ${timestampType} NOT NULL ${timestampDefault},
          updated_at ${timestampType} NOT NULL ${timestampDefault}
        );
      `
        : `
        CREATE TABLE calendar_events (
          id ${uuidType} PRIMARY KEY,
          tenant_id ${uuidType} NOT NULL,
          title ${textType} NOT NULL,
          description ${textType},
          event_type ${varcharType(50)} NOT NULL DEFAULT 'OTHER',
          source_module ${varcharType(50)},
          source_entity ${varcharType(100)},
          source_id ${uuidType},
          start_at ${timestampType} NOT NULL,
          end_at ${timestampType},
          status ${varcharType(50)} NOT NULL DEFAULT 'PLANNED',
          location ${textType},
          owner_user_id ${uuidType},
          color_hint ${varcharType(20)},
          created_by ${uuidType},
          updated_by ${uuidType},
          created_at ${timestampType} NOT NULL ${timestampDefault},
          updated_at ${timestampType} NOT NULL ${timestampDefault}
        );
      `;
      await queryRunner.query(calendarEventsTableSql);

      // Create indexes
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant ON calendar_events(tenant_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at ON calendar_events(start_at);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source_module, source_entity, source_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_calendar_events_owner ON calendar_events(owner_user_id);
      `);

      console.log('✅ Created calendar_events table');
    } else {
      console.log('⚠️  calendar_events table already exists');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    const calendarEventsTable = isPostgres
      ? 'public.calendar_events'
      : 'calendar_events';

    await queryRunner.query(`DROP TABLE IF EXISTS ${calendarEventsTable};`);
  }
}

