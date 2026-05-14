-- 0008_survey_sections.sql
-- ------------------------------------------------------------
-- Per-survey snapshot of section dividers (headings shown on the public
-- survey page between groups of questions). Until now these were
-- hardcoded in src/lib/i18n.ts (SECTIONS_I18N) and shared across every
-- survey, which conflicts with the snapshot-isolation principle: editing
-- a section title for one survey would change every survey's UI.
--
-- This table follows the same isolation pattern as `survey_questions`:
-- each survey owns its own list of sections, fully editable independently
-- of any other survey. Section identifiers are unique WITHIN a survey but
-- may repeat across surveys.

CREATE TABLE IF NOT EXISTS survey_sections (
  survey_id     INTEGER NOT NULL,
  section_id    TEXT    NOT NULL,   -- short stable id (e.g. 'locatie'), unique within survey
  display_order INTEGER NOT NULL DEFAULT 0,
  title_nl      TEXT    NOT NULL,   -- the small badge text, e.g. "Locatie & sfeer"
  title_en      TEXT    NOT NULL,   -- English equivalent
  subtitle_nl   TEXT,                -- the larger heading below, e.g. "De huiskamer als ruimte."
  subtitle_en   TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (survey_id, section_id),
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_survey_sections_order
  ON survey_sections(survey_id, display_order);

-- ------------------------------------------------------------
-- Backfill: seed every existing survey with the seven legacy sections
-- that match the hardcoded SECTIONS_I18N table. Idempotent via
-- INSERT OR IGNORE — re-running the migration won't duplicate rows.

INSERT OR IGNORE INTO survey_sections
  (survey_id, section_id, display_order, title_nl, title_en, subtitle_nl, subtitle_en)
SELECT s.id, 'algemeen', 0,
       'Algemene beleving',  'Overall experience',
       'Hoe heb je de reeks ervaren?', 'How did you experience the series?'
FROM surveys s;

INSERT OR IGNORE INTO survey_sections
  (survey_id, section_id, display_order, title_nl, title_en, subtitle_nl, subtitle_en)
SELECT s.id, 'locatie', 1,
       'Locatie & sfeer', 'Location & atmosphere',
       'De huiskamer als ruimte.', 'The living room as a venue.'
FROM surveys s;

INSERT OR IGNORE INTO survey_sections
  (survey_id, section_id, display_order, title_nl, title_en, subtitle_nl, subtitle_en)
SELECT s.id, 'muzikaal', 2,
       'Muzikaal & instrument', 'Music & instrument',
       'Akoestiek, fortepiano, programma.', 'Acoustics, fortepiano, programme.'
FROM surveys s;

INSERT OR IGNORE INTO survey_sections
  (survey_id, section_id, display_order, title_nl, title_en, subtitle_nl, subtitle_en)
SELECT s.id, 'jos', 3,
       'Jos & Ayako als gastheer', 'Jos & Ayako as hosts',
       'Toelichting en interactie.', 'Commentary and interaction.'
FROM surveys s;

INSERT OR IGNORE INTO survey_sections
  (survey_id, section_id, display_order, title_nl, title_en, subtitle_nl, subtitle_en)
SELECT s.id, 'organisatie', 4,
       'Praktische organisatie', 'Practical organisation',
       'Communicatie, receptie, bijdrage.', 'Communication, reception, contribution.'
FROM surveys s;

INSERT OR IGNORE INTO survey_sections
  (survey_id, section_id, display_order, title_nl, title_en, subtitle_nl, subtitle_en)
SELECT s.id, 'reeks2', 5,
       'Reeks II en verder', 'Series II and beyond',
       'Wat zou je graag horen?', 'What would you like to hear?'
FROM surveys s;

INSERT OR IGNORE INTO survey_sections
  (survey_id, section_id, display_order, title_nl, title_en, subtitle_nl, subtitle_en)
SELECT s.id, 'totslot', 6,
       'Tot slot', 'Finally',
       'Naam en contact (optioneel).', 'Name and contact (optional).'
FROM surveys s;
