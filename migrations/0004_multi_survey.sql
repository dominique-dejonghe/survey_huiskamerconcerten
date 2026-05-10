-- Migration 0004: multi-survey support
-- Introduces brands, surveys and a question library.
-- Existing 'responses' rows are linked to the original survey ("huiskamer-reeks-1").
-- Backwards compatible: legacy q1_nps..q20_email columns remain populated.

-- ============================================================
-- 1. BRANDS
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id              TEXT PRIMARY KEY,           -- 'huiskamer' | 'ebdiep'
  url_prefix      TEXT NOT NULL UNIQUE,       -- 'h' | 'e'
  name_nl         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  primary_color   TEXT NOT NULL,              -- hex
  accent_color    TEXT NOT NULL,
  surface_color   TEXT NOT NULL,
  logo_url        TEXT,
  website_url     TEXT,
  contact_email   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO brands
  (id, url_prefix, name_nl, name_en, primary_color, accent_color, surface_color, logo_url, website_url, contact_email)
VALUES
  ('huiskamer', 'h',
   'Huiskamerconcerten', 'House Concerts',
   '#5B1F2A', '#F4A93C', '#FBF8F2',
   NULL,
   'https://www.josvanimmerseel.com/huisconcerten',
   'dominique.dejonghe@iutum.be'),
  ('ebdiep', 'e',
   'Ebdiepconcerten', 'Ebdiep Concerts',
   '#3C587E', '#D8942B', '#F8FAFC',
   '/static/brand/ebdiep-logo.png',
   'https://www.ebdiepconcerten.be',
   'dominique.dejonghe@iutum.be');

-- ============================================================
-- 2. SURVEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS surveys (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,        -- url-friendly, scoped per brand: 'reeks-1-immerseel-ito'
  brand_id        TEXT NOT NULL REFERENCES brands(id),
  series_name     TEXT,                        -- 'Reeks I 2026' / 'Lente 2026'
  title_nl        TEXT NOT NULL,
  title_en        TEXT NOT NULL,
  subtitle_nl     TEXT,                        -- e.g. 'Jos van Immerseel & Ayako Ito'
  subtitle_en     TEXT,
  artist          TEXT,
  concert_date    TEXT,                        -- ISO date YYYY-MM-DD (single concert) or NULL for series
  date_from       TEXT,                        -- ISO date for series start
  date_to         TEXT,                        -- ISO date for series end
  location        TEXT,
  status          TEXT NOT NULL DEFAULT 'open' -- 'open' | 'closed' | 'archived'
                  CHECK (status IN ('open', 'closed', 'archived')),
  lang_default    TEXT NOT NULL DEFAULT 'nl'
                  CHECK (lang_default IN ('nl', 'en')),
  question_codes  TEXT NOT NULL,               -- JSON array: ["q1_nps","q2_blijft_bij",...] in display order
  intro_nl        TEXT,                        -- override intro card text (NULL → use brand default)
  intro_en        TEXT,
  thanks_nl       TEXT,
  thanks_en       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_surveys_brand ON surveys(brand_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_surveys_slug ON surveys(slug);

-- Seed: existing survey (Huiskamerconcerten Reeks I — Immerseel/Ito)
INSERT OR IGNORE INTO surveys
  (id, slug, brand_id, series_name,
   title_nl, title_en,
   subtitle_nl, subtitle_en,
   artist, concert_date, location,
   status, lang_default,
   question_codes,
   created_at)
VALUES
  (1, 'reeks-1-immerseel-ito', 'huiskamer', 'Reeks I 2026',
   'Huiskamerconcerten — Reeks I',
   'House Concerts — Series I',
   'Jos van Immerseel & Ayako Ito',
   'Jos van Immerseel & Ayako Ito',
   'Jos van Immerseel & Ayako Ito',
   '2026-04-15',
   'Jos & Ayako · huiskamer',
   'open', 'nl',
   '["q1_nps","q2_blijft_bij","q3_aantal","q4_sfeer","q5_sfeer_open","q6_akoestiek","q7_fortepiano","q8_repertoire","q9_favoriet","q10_interactie","q11_gesprek","q12_communic","q13_catering","q14_bijdrage","q15_wensen_2","q16_gasten","q17_terugkomen","q18_overige","q19_naam","q20_contact"]',
   datetime('now'));

-- ============================================================
-- 3. QUESTION LIBRARY
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  code            TEXT PRIMARY KEY,            -- e.g. 'q1_nps' (canonical id reused from current code base)
  type            TEXT NOT NULL                -- 'nps' | 'scale' | 'choice' | 'text' | 'paragraph'
                  CHECK (type IN ('nps', 'scale', 'choice', 'text', 'paragraph')),
  category        TEXT,                        -- e.g. 'algemeen', 'akoestiek', 'organisatie'
  required        INTEGER NOT NULL DEFAULT 0,  -- 0/1 boolean
  scale_min       INTEGER,                     -- for scale/nps
  scale_max       INTEGER,                     -- for scale/nps
  label_nl        TEXT NOT NULL,
  label_en        TEXT NOT NULL,
  helper_nl       TEXT,
  helper_en       TEXT,
  min_label_nl    TEXT,
  min_label_en    TEXT,
  max_label_nl    TEXT,
  max_label_en    TEXT,
  options_nl      TEXT,                        -- JSON array of strings (choice questions)
  options_en      TEXT,
  conditional_on  TEXT,                        -- JSON: { "field": "...", "value": "..." } or NULL
  times_used      INTEGER NOT NULL DEFAULT 0,
  last_used_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 4. RESPONSES — add survey_id
-- (SQLite cannot add a REFERENCES column with NOT NULL DEFAULT in one ALTER,
--  so we add it as nullable, backfill, then enforce via app-level invariant.)
-- ============================================================
ALTER TABLE responses ADD COLUMN survey_id INTEGER DEFAULT 1;
ALTER TABLE responses ADD COLUMN answers_json TEXT;  -- generic answers (future surveys; legacy q1..q20 cols stay populated for survey 1)

CREATE INDEX IF NOT EXISTS idx_responses_survey ON responses(survey_id);

-- All existing responses belong to survey 1 (Huiskamer Reeks I).
UPDATE responses SET survey_id = 1 WHERE survey_id IS NULL;

-- ============================================================
-- 5. ANALYSIS CACHE — scope per survey
-- ============================================================
-- Existing table has lang as PK. Migrate to (survey_id, lang) compound PK.
CREATE TABLE IF NOT EXISTS analysis_cache_v2 (
  survey_id        INTEGER NOT NULL REFERENCES surveys(id),
  lang             TEXT NOT NULL CHECK (lang IN ('nl','en')),
  generated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  response_count   INTEGER NOT NULL,
  payload          TEXT NOT NULL,
  PRIMARY KEY (survey_id, lang)
);

-- Migrate existing rows (all belong to survey 1)
INSERT OR IGNORE INTO analysis_cache_v2 (survey_id, lang, generated_at, response_count, payload)
  SELECT 1, lang, generated_at, response_count, payload FROM analysis_cache;

DROP TABLE IF EXISTS analysis_cache;
ALTER TABLE analysis_cache_v2 RENAME TO analysis_cache;
