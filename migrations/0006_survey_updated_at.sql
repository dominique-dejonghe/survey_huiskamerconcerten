-- Add updated_at column to surveys for audit trail of admin edits.
-- SQLite ALTER TABLE ADD COLUMN doesn't allow non-constant defaults,
-- so we add the column NULL-able and backfill with created_at.

ALTER TABLE surveys ADD COLUMN updated_at TEXT;

UPDATE surveys SET updated_at = created_at WHERE updated_at IS NULL;
