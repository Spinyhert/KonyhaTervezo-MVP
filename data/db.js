const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "konyhatervezo.sqlite");
let db;

function getDb() {
  if (!db) db = new Database(dbPath);
  return db;
}

function init() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template TEXT DEFAULT 'straight',
      room_width REAL DEFAULT 3600,
      room_depth REAL DEFAULT 2800,
      room_height REAL DEFAULT 2700,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
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
      label TEXT DEFAULT 'Szekrény',
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
  `);
  console.log("✅ Adatbázis inicializálva");
}

module.exports = { getDb, init };
