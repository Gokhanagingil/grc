const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

let db;

const USER_TABLE_SQL = `CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);`;

function initDb() {
  return new Promise((resolve, reject)=>{
    const dir = path.join(__dirname);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'grc.db');
    const instance = new sqlite3.Database(file, (err)=>{
      if (err) return reject(err);
      db = instance;
      instance.serialize(()=>{
        const ensureUserSchema = ()=>{
          instance.all('PRAGMA table_info(users);', (infoErr, rows)=>{
            if (infoErr) return reject(infoErr);
            const required = new Set(['id','email','password_hash','created_at']);
            const present = new Set(rows.map(r=>r.name));
            const missing = [...required].filter(col=>!present.has(col));
            if (missing.length) {
              instance.exec('DROP TABLE IF EXISTS users;', (dropErr)=>{
                if (dropErr) return reject(dropErr);
                instance.run(USER_TABLE_SQL, (recreateErr)=> recreateErr ? reject(recreateErr) : resolve());
              });
            } else {
              resolve();
            }
          });
        };
        instance.run(USER_TABLE_SQL, (schemaErr)=> schemaErr ? reject(schemaErr) : ensureUserSchema());
      });
    });
  });
}

function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

module.exports = { initDb, getDb };
