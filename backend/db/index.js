/**
 * Database Configuration Module
 * Supports both SQLite and PostgreSQL with a unified interface
 * 
 * Environment Variables:
 * - DB_CLIENT: 'sqlite' or 'pg' (default: 'pg')
 * - For PostgreSQL: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * - For SQLite: DB_PATH
 */

const config = require('../config');

// Database client type
const DB_CLIENT = process.env.DB_CLIENT || 'pg';

// PostgreSQL configuration
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'grc_platform',
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 5000
};

// SQLite configuration
const sqliteConfig = {
  path: process.env.DB_PATH || './database/grc.db'
};

let db = null;
let dbType = null;

/**
 * Initialize the database connection
 * @returns {Promise<void>}
 */
async function init() {
  if (DB_CLIENT === 'pg') {
    await initPostgres();
  } else if (DB_CLIENT === 'sqlite') {
    await initSqlite();
  } else {
    throw new Error(`FATAL: Unknown DB_CLIENT "${DB_CLIENT}". Supported values: pg, sqlite`);
  }
}

/**
 * Initialize PostgreSQL connection
 */
async function initPostgres() {
  const { Pool } = require('pg');
  
  console.log('Initializing PostgreSQL connection...');
  console.log(`  Host: ${pgConfig.host}:${pgConfig.port}`);
  console.log(`  Database: ${pgConfig.database}`);
  console.log(`  User: ${pgConfig.user}`);
  
  db = new Pool(pgConfig);
  dbType = 'pg';
  
  // Test connectivity
  try {
    const client = await db.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('PostgreSQL connection established successfully');
  } catch (error) {
    console.error('FATAL: Failed to connect to PostgreSQL:', error.message);
    console.error('Please ensure PostgreSQL is running and the connection details are correct.');
    process.exit(1);
  }
}

/**
 * Initialize SQLite connection
 */
async function initSqlite() {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const fs = require('fs');
  
  console.log('Initializing SQLite connection...');
  console.log(`  Database path: ${sqliteConfig.path}`);
  
  // Ensure database directory exists
  const dbDir = path.dirname(sqliteConfig.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(sqliteConfig.path, (err) => {
      if (err) {
        console.error('FATAL: Failed to connect to SQLite:', err.message);
        process.exit(1);
      }
      dbType = 'sqlite';
      console.log('SQLite connection established successfully');
      resolve();
    });
  });
}

/**
 * Get the database instance
 * @returns {Object} Database instance (Pool for pg, Database for sqlite)
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.');
  }
  return db;
}

/**
 * Get the database client type
 * @returns {string} 'pg' or 'sqlite'
 */
function getDbType() {
  return dbType;
}

/**
 * Check if using PostgreSQL
 * @returns {boolean}
 */
function isPostgres() {
  return dbType === 'pg';
}

/**
 * Check if using SQLite
 * @returns {boolean}
 */
function isSqlite() {
  return dbType === 'sqlite';
}

/**
 * Execute a query with unified interface
 * Returns a Promise for both pg and sqlite
 * 
 * @param {string} sql - SQL query (use $1, $2 for pg, ? for sqlite)
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(sql, params = []) {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.');
  }
  
  if (dbType === 'pg') {
    const result = await db.query(sql, params);
    return result;
  } else {
    // SQLite - wrap in promise
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve({ rows, rowCount: rows ? rows.length : 0 });
      });
    });
  }
}

/**
 * Execute a query and return all rows
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Array of rows
 */
async function all(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Execute a query and return the first row
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} First row or null
 */
async function get(sql, params = []) {
  const result = await query(sql, params);
  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Execute an INSERT/UPDATE/DELETE query
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Result with rowCount/changes
 */
async function run(sql, params = []) {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.');
  }
  
  if (dbType === 'pg') {
    const result = await db.query(sql, params);
    return { 
      rowCount: result.rowCount,
      rows: result.rows,
      lastID: result.rows && result.rows[0] ? result.rows[0].id : null
    };
  } else {
    // SQLite - wrap in promise
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ 
          rowCount: this.changes,
          changes: this.changes,
          lastID: this.lastID
        });
      });
    });
  }
}

/**
 * Close the database connection
 * @returns {Promise<void>}
 */
async function close() {
  if (!db) return;
  
  if (dbType === 'pg') {
    await db.end();
  } else {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  db = null;
  dbType = null;
}

/**
 * Get a client from the pool (PostgreSQL only)
 * For transactions or multiple queries
 * @returns {Promise<Object>} Client object
 */
async function getClient() {
  if (dbType !== 'pg') {
    throw new Error('getClient() is only available for PostgreSQL');
  }
  return await db.connect();
}

module.exports = {
  init,
  getDb,
  getDbType,
  isPostgres,
  isSqlite,
  query,
  all,
  get,
  run,
  close,
  getClient,
  // Export config for reference
  pgConfig,
  sqliteConfig
};
