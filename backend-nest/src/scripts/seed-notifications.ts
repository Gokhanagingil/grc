/**
 * Seed demo notifications (idempotent).
 *
 * Usage (dev):  npx ts-node -r tsconfig-paths/register src/scripts/seed-notifications.ts
 * Usage (prod): node dist/scripts/seed-notifications.js
 *
 * Creates sample notifications for the demo tenant admin user.
 */
import { DataSource } from 'typeorm';
import * as path from 'path';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SEED_MARKER = 'notification-seed-v1';

async function main() {
  // Detect environment: dist/ for production, src/ for dev
  const isProduction = __filename.endsWith('.js');
  const entitiesGlob = isProduction
    ? path.join(__dirname, '..', '**', '*.entity.js')
    : path.join(__dirname, '..', '**', '*.entity.ts');

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'grc_platform',
    entities: [entitiesGlob],
    synchronize: false,
  });

  await ds.initialize();
  console.log('[seed-notifications] Connected to database');

  try {
    // Check idempotency marker
    const existing = await ds.query(
      `SELECT COUNT(*) as cnt FROM sys_user_notifications
       WHERE tenant_id = $1 AND metadata->>'seedMarker' = $2`,
      [DEMO_TENANT_ID, SEED_MARKER],
    );
    if (parseInt(existing[0].cnt, 10) > 0) {
      console.log('[seed-notifications] Seed already applied, skipping');
      return;
    }

    // Find a demo user
    const users = await ds.query(
      `SELECT id FROM nest_users WHERE tenant_id = $1 LIMIT 1`,
      [DEMO_TENANT_ID],
    );
    if (users.length === 0) {
      console.log('[seed-notifications] No users found for demo tenant, skipping');
      return;
    }
    const userId = users[0].id;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

    const notifications = [
      {
        tenant_id: DEMO_TENANT_ID,
        user_id: userId,
        title: 'Task Assigned',
        body: 'You have been assigned to "Q1 Risk Assessment Review".',
        type: 'ASSIGNMENT',
        severity: 'INFO',
        source: 'TODO',
        entity_type: 'todo_task',
        entity_id: null,
        link: '/todo',
        due_at: null,
        metadata: JSON.stringify({ seedMarker: SEED_MARKER, reason: 'assigned to you' }),
        actions: JSON.stringify([
          { label: 'Open Task', actionType: 'OPEN_RECORD', payload: { entityType: 'todo_task' } },
        ]),
      },
      {
        tenant_id: DEMO_TENANT_ID,
        user_id: userId,
        title: 'Task Due Soon',
        body: '"SOC 2 Evidence Collection" is due tomorrow.',
        type: 'DUE_DATE',
        severity: 'WARNING',
        source: 'TODO',
        entity_type: 'todo_task',
        entity_id: null,
        link: '/todo',
        due_at: tomorrow.toISOString(),
        metadata: JSON.stringify({ seedMarker: SEED_MARKER, reason: 'due date approaching' }),
        actions: JSON.stringify([
          { label: 'Open Task', actionType: 'OPEN_RECORD', payload: { entityType: 'todo_task' } },
          { label: 'Set Due Date', actionType: 'SET_DUE_DATE', payload: { entityType: 'todo_task' } },
        ]),
      },
      {
        tenant_id: DEMO_TENANT_ID,
        user_id: userId,
        title: 'Major Incident',
        body: 'Production database outage detected — immediate action required.',
        type: 'STATUS_CHANGE',
        severity: 'CRITICAL',
        source: 'ITSM',
        entity_type: 'itsm_incident',
        entity_id: null,
        link: '/itsm/incidents',
        due_at: null,
        metadata: JSON.stringify({ seedMarker: SEED_MARKER, reason: 'major incident assigned to you', priority: 'P1' }),
        actions: JSON.stringify([
          { label: 'Open Incident', actionType: 'OPEN_RECORD', payload: { entityType: 'itsm_incident' } },
        ]),
      },
    ];

    for (const n of notifications) {
      await ds.query(
        `INSERT INTO sys_user_notifications
         (tenant_id, user_id, title, body, type, severity, source,
          entity_type, entity_id, link, due_at, metadata, actions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          n.tenant_id, n.user_id, n.title, n.body, n.type, n.severity, n.source,
          n.entity_type, n.entity_id, n.link, n.due_at, n.metadata, n.actions,
        ],
      );
    }

    console.log(`[seed-notifications] Created ${notifications.length} demo notifications`);
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('[seed-notifications] Error:', err);
  process.exit(1);
});
