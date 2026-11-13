-- Mostarly admin: what Mirna edits, and the pages the Worker serves after each save.
CREATE TABLE IF NOT EXISTS tours (
  slug TEXT PRIMARY KEY,
  data TEXT NOT NULL,            -- the tour as JSON (same fields as content/tours/*.json)
  sort INTEGER NOT NULL DEFAULT 99,
  hidden INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,            -- { name, country, date, rating, title, text, source }
  sort INTEGER NOT NULL DEFAULT 99,
  hidden INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS media (
  key TEXT PRIMARY KEY,          -- object key in R2, served at /media/<key>
  name TEXT,
  type TEXT,
  size INTEGER,
  w INTEGER,
  h INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pages (
  url TEXT PRIMARY KEY,          -- e.g. /tours/modern-mostar/ or /sitemap.xml
  body TEXT NOT NULL,
  type TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
