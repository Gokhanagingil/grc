const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  await client.connect();
  const res = await client.query(
    'SELECT id, email, is_active, tenant_id FROM auth.users WHERE email=$1 LIMIT 1',
    ['admin@local']
  );
  await client.end();
  if (res.rows.length && res.rows[0].is_active) {
    console.log(JSON.stringify({ ok: true, user: { id: res.rows[0].id, email: res.rows[0].email, tenant_id: res.rows[0].tenant_id } }));
    process.exit(0);
  } else {
    console.log(JSON.stringify({ ok: false }));
    process.exit(2);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


