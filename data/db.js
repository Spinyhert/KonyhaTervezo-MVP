const path = require('path');
const fs = require('fs');

// Pure JS SQLite - nincs C++ fordítás szükséges
const initSqlJs = require('@databases/sqlite');

const DB_PATH = path.join(__dirname, 'konyhatervezo.db');
let db = null;

async function getDb() {
  if (db) return db;
  db = await initSqlJs(DB_PATH);
  return db;
}

async function init() {
  const db = await getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template TEXT DEFAULT 'straight',
      room_width REAL DEFAULT 3600,
      room_depth REAL DEFAULT 2800,
      room_height REAL DEFAULT 2700,
      created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS cabinets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      x REAL DEFAULT 0,
      z REAL DEFAULT 0,
      w REAL DEFAULT 600,
      h REAL DEFAULT 720,
      d REAL DEFAULT 560,
      corpus_material TEXT DEFAULT 'white',
      front_material TEXT DEFAULT 'anthracite',
      shelves INTEGER DEFAULT 1,
      door_open INTEGER DEFAULT 0,
      label TEXT DEFAULT 'Szekrény'
    )
  `);
  console.log('✅ Adatbázis inicializálva:', DB_PATH);
}

module.exports = { getDb, init };
