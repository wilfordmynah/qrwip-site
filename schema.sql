-- Ownership lives on each sign, so signs can move between accounts later.
CREATE TABLE IF NOT EXISTS users  (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, claim_hash TEXT UNIQUE NOT NULL, claimed_by INTEGER, claimed_at INTEGER, note TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS signs  (id TEXT PRIMARY KEY, order_id INTEGER, owner_id INTEGER, label TEXT, destination TEXT, updated_at INTEGER, archived_at INTEGER);
CREATE TABLE IF NOT EXISTS scans  (id INTEGER PRIMARY KEY AUTOINCREMENT, sign_id TEXT NOT NULL, ts INTEGER NOT NULL, country TEXT);
CREATE INDEX IF NOT EXISTS idx_scans_sign ON scans (sign_id, ts);
-- Login (added in step 2; safe to re-run)
CREATE TABLE IF NOT EXISTS login_tokens (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, claim_hash TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL);
