-- Huiskamerconcerten Reeks I — Survey schema
-- Andre Devaere VZW

CREATE TABLE IF NOT EXISTS responses (
  id              TEXT PRIMARY KEY,
  submitted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  ip_hash         TEXT,
  user_agent      TEXT,
  q1_nps          INTEGER CHECK (q1_nps BETWEEN 0 AND 10),
  q2_blijft_bij   TEXT,
  q3_aantal       TEXT,
  q4_sfeer        INTEGER CHECK (q4_sfeer BETWEEN 1 AND 5),
  q5_sfeer_open   TEXT,
  q6_akoestiek    INTEGER CHECK (q6_akoestiek BETWEEN 1 AND 5),
  q7_fortepiano   TEXT,
  q8_repertoire   INTEGER CHECK (q8_repertoire BETWEEN 1 AND 5),
  q9_favoriet     TEXT,
  q10_interactie  INTEGER CHECK (q10_interactie BETWEEN 1 AND 5),
  q11_gesprek     TEXT,
  q12_communic    INTEGER CHECK (q12_communic BETWEEN 1 AND 5),
  q13_catering    TEXT,
  q14_bijdrage    INTEGER CHECK (q14_bijdrage BETWEEN 1 AND 5),
  q15_wensen_2    TEXT,
  q16_gasten      TEXT,
  q17_terugkomen  TEXT,
  q18_overige     TEXT,
  q19_naam        TEXT,
  q20_contact     TEXT CHECK (q20_contact IN ('ja','nee') OR q20_contact IS NULL),
  q20_email       TEXT,
  deleted_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_submitted_at ON responses(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_at ON responses(deleted_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  action      TEXT NOT NULL,
  ip_hash     TEXT,
  details     TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);

CREATE TABLE IF NOT EXISTS rate_limit (
  ip_hash     TEXT NOT NULL,
  window_ts   INTEGER NOT NULL,
  count       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, window_ts)
);
