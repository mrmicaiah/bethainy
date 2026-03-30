-- Migration 003: Add mode column to entries table
-- The original entries table is missing the mode column

ALTER TABLE entries ADD COLUMN mode TEXT;

-- Update existing entries to have a default mode if any exist
UPDATE entries SET mode = 'fitness' WHERE mode IS NULL;

-- Create index for mode queries
CREATE INDEX IF NOT EXISTS idx_entries_mode ON entries(mode);
CREATE INDEX IF NOT EXISTS idx_entries_mode_type ON entries(mode, type);
