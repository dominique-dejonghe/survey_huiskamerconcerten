-- ============================================================
-- 0007 — survey_questions snapshot table
--
-- The `questions` table is now a TEMPLATE library. When a survey is created,
-- the chosen library questions are COPIED into `survey_questions`. From that
-- moment on, edits to a survey's questions only affect that survey, and edits
-- to the library only affect FUTURE new surveys. Existing surveys keep their
-- own immutable snapshot of question wording, options, scale labels, etc.
--
-- This protects research integrity: response data collected under one set of
-- question wording is never invalidated by retroactive library edits.
-- ============================================================

CREATE TABLE IF NOT EXISTS survey_questions (
  survey_id        INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  code             TEXT    NOT NULL,                       -- unique within a survey, may repeat across surveys
  display_order    INTEGER NOT NULL DEFAULT 0,             -- ordering within the survey
  type             TEXT    NOT NULL
                   CHECK (type IN ('nps', 'scale', 'choice', 'text', 'paragraph')),
  category         TEXT,
  required         INTEGER NOT NULL DEFAULT 0,             -- 0/1 boolean
  scale_min        INTEGER,
  scale_max        INTEGER,
  label_nl         TEXT NOT NULL,
  label_en         TEXT NOT NULL,
  helper_nl        TEXT,
  helper_en        TEXT,
  min_label_nl     TEXT,
  min_label_en     TEXT,
  max_label_nl     TEXT,
  max_label_en     TEXT,
  options_nl       TEXT,                                   -- JSON array
  options_en       TEXT,
  conditional_on   TEXT,                                   -- JSON: { field, value }
  source_code      TEXT,                                   -- original library code at snapshot time, NULL if survey-only
  snapshotted_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (survey_id, code)
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_order
  ON survey_questions(survey_id, display_order);

-- ============================================================
-- Backfill: for every existing survey, snapshot the library questions
-- referenced in its `question_codes` JSON array, in the listed order.
--
-- SQLite doesn't support JSON array iteration with a portable syntax across
-- versions. We use json_each() which is available in modern SQLite (incl. D1).
-- ============================================================

INSERT OR IGNORE INTO survey_questions (
  survey_id, code, display_order,
  type, category, required, scale_min, scale_max,
  label_nl, label_en, helper_nl, helper_en,
  min_label_nl, min_label_en, max_label_nl, max_label_en,
  options_nl, options_en, conditional_on,
  source_code, snapshotted_at
)
SELECT
  s.id AS survey_id,
  q.code AS code,
  je.key AS display_order,
  q.type, q.category, q.required, q.scale_min, q.scale_max,
  q.label_nl, q.label_en, q.helper_nl, q.helper_en,
  q.min_label_nl, q.min_label_en, q.max_label_nl, q.max_label_en,
  q.options_nl, q.options_en, q.conditional_on,
  q.code AS source_code,
  datetime('now') AS snapshotted_at
FROM surveys s
JOIN json_each(s.question_codes) je
JOIN questions q ON q.code = je.value
WHERE NOT EXISTS (
  SELECT 1 FROM survey_questions sq WHERE sq.survey_id = s.id AND sq.code = q.code
);
