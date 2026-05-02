-- Add language column to responses (NL default for backward compatibility)
ALTER TABLE responses ADD COLUMN lang TEXT NOT NULL DEFAULT 'nl';
CREATE INDEX IF NOT EXISTS idx_responses_lang ON responses(lang);
