/**
 * Database Connection Compatibility Layer
 * 
 * This module provides backward compatibility for existing route handlers
 * that use the callback-based SQLite API (db.get, db.run, db.all).
 * 
 * It wraps the new unified database module (../db) and provides a
 * SQLite-compatible interface that works with both PostgreSQL and SQLite.
 * 
 * For new code, prefer using the ../db module directly with async/await.
 */

const mainDb = require('../db');

// SQLite schema for backward compatibility (used when DB_CLIENT=sqlite)
const sqliteSchema = `
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
  );

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
  );

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
  );

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
  );

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
  );

  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES organizations (id)
  );

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
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    category TEXT,
    tags TEXT,
    due_date DATE,
    completed_at DATETIME,
    owner_id INTEGER NOT NULL,
    assigned_to INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users (id),
    FOREIGN KEY (assigned_to) REFERENCES users (id)
  );
`;

/**
 * Convert SQL query from SQLite placeholder (?) to PostgreSQL ($1, $2, etc.)
 * @param {string} sql - SQL query with ? placeholders
 * @returns {string} - SQL query with $n placeholders for PostgreSQL
 */
function convertPlaceholders(sql) {
  if (!mainDb.isPostgres()) {
    return sql;
  }
  
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/**
 * Compatibility wrapper that provides SQLite-like callback interface
 * for both PostgreSQL and SQLite
 */
const compatDb = {
  /**
   * Execute a query and return all rows (callback-based)
   */
  all(sql, params, callback) {
    // Handle case where params is the callback
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const convertedSql = convertPlaceholders(sql);
    
    mainDb.all(convertedSql, params)
      .then(rows => callback(null, rows))
      .catch(err => callback(err, null));
  },
  
  /**
   * Execute a query and return the first row (callback-based)
   */
  get(sql, params, callback) {
    // Handle case where params is the callback
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const convertedSql = convertPlaceholders(sql);
    
    mainDb.get(convertedSql, params)
      .then(row => callback(null, row))
      .catch(err => callback(err, null));
  },
  
  /**
   * Execute an INSERT/UPDATE/DELETE query (callback-based)
   * Binds `this.lastID` and `this.changes` for SQLite compatibility
   */
  run(sql, params, callback) {
    // Handle case where params is the callback
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    let convertedSql = convertPlaceholders(sql);
    
    // For PostgreSQL INSERT, add RETURNING id to get lastID
    if (mainDb.isPostgres() && /^\s*INSERT/i.test(sql) && !/RETURNING/i.test(sql)) {
      convertedSql = convertedSql.replace(/;?\s*$/, ' RETURNING id');
    }
    
    mainDb.run(convertedSql, params)
      .then(result => {
        // Create context object with lastID and changes for callback
        const context = {
          lastID: result.lastID || (result.rows && result.rows[0] ? result.rows[0].id : null),
          changes: result.rowCount || result.changes || 0
        };
        callback.call(context, null);
      })
      .catch(err => {
        callback.call({ lastID: null, changes: 0 }, err);
      });
  },
  
  /**
   * Serialize operations (SQLite-specific, no-op for PostgreSQL)
   */
  serialize(callback) {
    if (mainDb.isSqlite()) {
      mainDb.getDb().serialize(callback);
    } else {
      // For PostgreSQL, just execute the callback
      callback();
    }
  }
};

/**
 * Initialize the database
 * For SQLite: creates tables using the schema
 * For PostgreSQL: assumes tables are created via init-db-pg.js script
 */
const init = async () => {
  // Initialize the main database connection
  await mainDb.init();
  
  // For SQLite, create tables
  if (mainDb.isSqlite()) {
    const db = mainDb.getDb();
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Split schema into individual statements and execute
        const statements = sqliteSchema.split(';').filter(s => s.trim());
        statements.forEach(stmt => {
          db.run(stmt.trim());
        });
        console.log('Database tables created successfully');
        resolve();
      });
    });
  } else {
    // For PostgreSQL, tables should be created via npm run db:init:pg
    console.log('PostgreSQL mode: Ensure tables are created via "npm run db:init:pg"');
    return Promise.resolve();
  }
};

/**
 * Get the compatibility database wrapper
 * @returns {Object} Database wrapper with SQLite-compatible interface
 */
const getDb = () => compatDb;

module.exports = {
  init,
  getDb
};
