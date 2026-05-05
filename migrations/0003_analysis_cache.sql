-- Cache for AI-generated analyses (per language, refreshed manually or after 24h)
CREATE TABLE IF NOT EXISTS analysis_cache (
  lang             TEXT PRIMARY KEY,           -- 'nl' | 'en'
  generated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  response_count   INTEGER NOT NULL,            -- aantal responses ten tijde van generatie
  payload          TEXT NOT NULL                -- JSON: { samenvatting, sterke_punten[], verbeterpunten[], suggesties[], citaten[] }
);
