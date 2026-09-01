const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || './data/wishare.db';

// Buat folder data jika belum ada
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Database connected');
  }
});

const initialize = () => {
  // Tabel Users (Admin)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabel Hotspot Configuration
  db.run(`
    CREATE TABLE IF NOT EXISTS hotspot_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ssid TEXT NOT NULL,
      password TEXT NOT NULL,
      max_users INTEGER DEFAULT 5,
      duration_minutes INTEGER,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Tabel Sharing Sessions
  db.run(`
    CREATE TABLE IF NOT EXISTS share_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      hotspot_config_id INTEGER,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      duration_minutes INTEGER,
      connected_devices INTEGER DEFAULT 0,
      data_used REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(hotspot_config_id) REFERENCES hotspot_config(id)
    )
  `);

  // Tabel Connected Devices
  db.run(`
    CREATE TABLE IF NOT EXISTS connected_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      device_name TEXT NOT NULL,
      device_mac TEXT,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      disconnected_at DATETIME,
      status TEXT DEFAULT 'connected',
      FOREIGN KEY(session_id) REFERENCES share_sessions(id)
    )
  `);

  // Tabel Usage Statistics
  db.run(`
    CREATE TABLE IF NOT EXISTS usage_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      date DATE,
      data_used REAL DEFAULT 0,
      data_today REAL DEFAULT 0,
      data_week REAL DEFAULT 0,
      data_month REAL DEFAULT 0,
      FOREIGN KEY(session_id) REFERENCES share_sessions(id)
    )
  `);

  console.log('✅ Database tables initialized');
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('Database error:', err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

module.exports = {
  db,
  initialize,
  run,
  get,
  all
};