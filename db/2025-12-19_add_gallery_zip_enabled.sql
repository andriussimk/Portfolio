-- Add per-gallery toggle for ZIP downloads (default ON)
ALTER TABLE galleries ADD COLUMN zip_enabled INTEGER NOT NULL DEFAULT 1;
