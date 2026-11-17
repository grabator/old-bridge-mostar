-- phones that get a notification for every new enquiry (Web Push)
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  keys TEXT NOT NULL,
  ua TEXT,
  created_at TEXT
);
