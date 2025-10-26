const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'grc.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

const init = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          first_name TEXT,
          last_name TEXT,
          department TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Policies table
      db.run(`
        CREATE TABLE IF NOT EXISTS policies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT,
          version TEXT DEFAULT '1.0',
          status TEXT DEFAULT 'draft',
          owner_id INTEGER,
          effective_date DATE,
          review_date DATE,
          content TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES users (id)
        )
      `);

      // Risks table
      db.run(`
        CREATE TABLE IF NOT EXISTS risks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT,
          severity TEXT,
          likelihood TEXT,
          impact TEXT,
          risk_score INTEGER,
          status TEXT DEFAULT 'open',
          owner_id INTEGER,
          assigned_to INTEGER,
          mitigation_plan TEXT,
          due_date DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES users (id),
          FOREIGN KEY (assigned_to) REFERENCES users (id)
        )
      `);

      // Compliance requirements table
      db.run(`
        CREATE TABLE IF NOT EXISTS compliance_requirements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          regulation TEXT,
          category TEXT,
          status TEXT DEFAULT 'pending',
          due_date DATE,
          owner_id INTEGER,
          assigned_to INTEGER,
          evidence TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES users (id),
          FOREIGN KEY (assigned_to) REFERENCES users (id)
        )
      `);

      // Audit logs table
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT NOT NULL,
          entity_type TEXT,
          entity_id INTEGER,
          old_values TEXT,
          new_values TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Organizations table
      db.run(`
        CREATE TABLE IF NOT EXISTS organizations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT,
          parent_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES organizations (id)
        )
      `);

      // Risk assessments table
      db.run(`
        CREATE TABLE IF NOT EXISTS risk_assessments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          risk_id INTEGER,
          assessor_id INTEGER,
          assessment_date DATE,
          likelihood_score INTEGER,
          impact_score INTEGER,
          overall_score INTEGER,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (risk_id) REFERENCES risks (id),
          FOREIGN KEY (assessor_id) REFERENCES users (id)
        )
      `);

      console.log('Database tables created successfully');
      resolve();
    });
  });
};

const getDb = () => db;

module.exports = {
  init,
  getDb
};
