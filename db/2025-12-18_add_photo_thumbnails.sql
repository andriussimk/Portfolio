-- Migration: add thumbnail support for photos
-- Date: 2025-12-18
--
-- This migration adds a nullable column to store the R2 object key of a JPEG thumbnail.
-- The application stores thumbnails in R2 at:
--   <galleryId>/thumbs/<originalFilename>.jpg
-- and persists the same path in `photos.thumb_object_key`.
--
-- Safe to run once. (If you run it twice, SQLite will error because the column exists.)

PRAGMA foreign_keys = ON;

ALTER TABLE photos ADD COLUMN thumb_object_key TEXT;

-- Optional: helpful for queries that filter on "has thumbnail".
-- CREATE INDEX idx_photos_thumb_object_key ON photos(thumb_object_key);
