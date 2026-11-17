-- Mirna's planner: every enquiry from the site, plus the ones she adds herself (Instagram, phone...)
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'new',   -- new, replied, confirmed, done, cancelled
  source TEXT NOT NULL DEFAULT 'site',  -- site-email, site-whatsapp, instagram, whatsapp, phone, email, agency, walkin, other
  date TEXT,                            -- tour date YYYY-MM-DD (empty = flexible)
  data TEXT NOT NULL,                   -- everything else as JSON
  ip_hash TEXT,                         -- only for limiting spam from the public form
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS bookings_date ON bookings (date);
CREATE INDEX IF NOT EXISTS bookings_created ON bookings (created_at);
CREATE INDEX IF NOT EXISTS bookings_ip ON bookings (ip_hash, created_at);
