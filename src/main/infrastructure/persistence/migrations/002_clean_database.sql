-- Migration 002: Clean database and remove is_new column
-- This migration deletes all existing data and removes the is_new column

-- Step 1: Delete all data from devices table
DELETE FROM devices;

-- Step 2: Drop the is_new column by recreating the table
-- SQLite doesn't support ALTER TABLE DROP COLUMN directly, so we recreate the table
CREATE TABLE IF NOT EXISTS devices_new (
    id TEXT PRIMARY KEY,
    device_friendly_name TEXT NOT NULL,
    model TEXT DEFAULT 'Unknown',
    version TEXT DEFAULT 'Unknown',
    arch TEXT DEFAULT 'Unknown',
    video_transferred INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    is_trusted INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Step 3: Copy data from old table to new table (should be empty due to DELETE above)
INSERT INTO devices_new (id, device_friendly_name, model, version, arch, video_transferred, is_favorite, is_trusted, created_at, updated_at)
SELECT id, device_friendly_name, model, version, arch, video_transferred, is_favorite, is_trusted, created_at, updated_at
FROM devices;

-- Step 4: Drop the old table
DROP TABLE IF EXISTS devices;

-- Step 5: Rename the new table to the original name
ALTER TABLE devices_new RENAME TO devices;

-- Step 6: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_devices_favorite ON devices(is_favorite);
CREATE INDEX IF NOT EXISTS idx_devices_trusted ON devices(is_trusted);
