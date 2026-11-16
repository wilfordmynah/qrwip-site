-- Safe to re-run.
CREATE TABLE IF NOT EXISTS contact_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, name TEXT, email TEXT, company TEXT, topic TEXT, message TEXT, emailed INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages (created_at);
