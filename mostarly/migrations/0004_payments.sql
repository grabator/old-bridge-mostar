-- online payments from the /pay/ page (Monri)
CREATE TABLE IF NOT EXISTS payments (
  order_number TEXT PRIMARY KEY,
  view_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | review
  amount INTEGER NOT NULL,                -- in cents
  currency TEXT NOT NULL,
  name TEXT, email TEXT, tour_slug TEXT, tour TEXT, date TEXT,
  booking_id TEXT, ip_hash TEXT, mode TEXT, provider TEXT,
  created_at TEXT, updated_at TEXT, paid_at TEXT
);
CREATE INDEX IF NOT EXISTS payments_ip ON payments (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS payments_created ON payments (created_at);
