-- D1 schema for portfolio galleries and photos
-- Apply this in Cloudflare D1 Console before using the admin panel.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  is_private INTEGER NOT NULL DEFAULT 0,
  private_token TEXT,
  zip_enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_galleries_private ON galleries(is_private);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  object_key TEXT NOT NULL,
  thumb_object_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE,
  UNIQUE (gallery_id, filename)
);

CREATE INDEX IF NOT EXISTS idx_photos_gallery_id ON photos(gallery_id);
CREATE INDEX IF NOT EXISTS idx_photos_gallery_sort ON photos(gallery_id, sort_order, created_at);

-- Editable static pages (about, other)
CREATE TABLE IF NOT EXISTS site_pages (
  slug TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Contacts info (single-row)
CREATE TABLE IF NOT EXISTS site_contacts (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT,
  phone TEXT,
  instagram TEXT,
  facebook TEXT,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO site_contacts (id, email, phone, instagram, facebook, updated_at)
VALUES (1, 'hello@shotbyandrius.com', '+37061804969', 'https://instagram.com/shot_by_andrius', 'https://facebook.com/andriussimk', datetime('now'));

-- Collection view analytics (aggregate counters)
CREATE TABLE IF NOT EXISTS collection_views (
  gallery_id TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0,
  last_viewed TEXT
);
