import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  age INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  allowance_amount REAL NOT NULL DEFAULT 0,
  allowance_cadence TEXT NOT NULL DEFAULT 'weekly',
  savings_rate REAL NOT NULL DEFAULT 0.5,
  growth_rate_pct REAL NOT NULL DEFAULT 7,
  starting_balance REAL NOT NULL DEFAULT 0,
  split_json TEXT NOT NULL DEFAULT '{"save":40,"spend":40,"share":10,"invest":10}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS income_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  cadence TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  catalog_id TEXT,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎯',
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  search_query TEXT,
  saved_so_far REAL NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prices (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  currency TEXT NOT NULL,
  source TEXT NOT NULL,
  query TEXT,
  note TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  price REAL NOT NULL,
  currency TEXT NOT NULL,
  source TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_price_history_key ON price_history(key, at);

CREATE TABLE IF NOT EXISTS price_cache (
  cache_key TEXT PRIMARY KEY,
  result_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  /** Set once the money has actually been moved into the Save jar. */
  moved_at TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_skips_profile ON skips(profile_id, at);

CREATE TABLE IF NOT EXISTS fx_rates (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  table_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('in', 'out')),
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  note TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ledger_profile ON ledger(profile_id, at);
`;

export function openDb(filePath: string): Db {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  ensureColumn(db, 'goals', 'target_date', 'TEXT');
  ensureColumn(db, 'goals', 'completed_at', 'TEXT');
  ensureColumn(db, 'ledger', 'goal_id', 'INTEGER');
  return db;
}

/** Add a column to an existing table if it is missing (tiny forward-only migration). */
export function ensureColumn(db: Db, table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
