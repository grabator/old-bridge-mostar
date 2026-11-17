-- the free guide / mailing list: who signed up, with their consent, and a token for one-click unsubscribe
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  source TEXT,
  consent_text TEXT,
  token TEXT NOT NULL UNIQUE,
  ip_hash TEXT,
  mailed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  unsubscribed_at TEXT
);
CREATE INDEX IF NOT EXISTS subscribers_created ON subscribers (created_at);
CREATE INDEX IF NOT EXISTS subscribers_ip ON subscribers (ip_hash, created_at);
