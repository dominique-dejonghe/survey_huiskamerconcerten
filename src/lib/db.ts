// D1 query helpers
import { uuid } from './crypto'

export type ResponseRow = {
  id: string
  survey_id: number
  submitted_at: string
  ip_hash: string | null
  user_agent: string | null
  lang: string
  // ─ Legacy kolommen (Reeks I) — blijven beschikbaar voor stats/csv/ai
  q1_nps: number
  q2_blijft_bij: string | null
  q3_aantal: string
  q4_sfeer: number
  q5_sfeer_open: string | null
  q6_akoestiek: number
  q7_fortepiano: string | null
  q8_repertoire: number
  q9_favoriet: string | null
  q10_interactie: number
  q11_gesprek: string | null
  q12_communic: number
  q13_catering: string | null
  q14_bijdrage: number
  q15_wensen_2: string | null
  q16_gasten: string | null
  q17_terugkomen: string | null
  q18_overige: string | null
  q19_naam: string | null
  q20_contact: string | null
  q20_email: string | null
  // ─ Generieke kolom voor surveys met andere vragen-snapshots
  answers_json: string | null
  deleted_at: string | null
}

/**
 * Generieke response-insert. Werkt voor ELKE survey omdat het écht
 * antwoorden in `answers_json` stopt; voor Reeks I (en elke survey
 * die toevallig dezelfde q1..q20 codes hergebruikt) populeren we
 * óók de legacy-kolommen zodat bestaande stats/csv/AI/exports
 * onveranderd blijven werken.
 *
 * `answers` is een vrije map vraagcode → waarde. Lege strings en
 * `undefined` worden tot `null` genormaliseerd vóór opslag.
 */
export async function insertResponse(
  db: D1Database,
  answers: Record<string, unknown>,
  meta: { ipHash: string; userAgent: string; surveyId?: number; lang?: string },
): Promise<string> {
  const id = uuid()
  const surveyId = meta.surveyId ?? 1
  const lang = meta.lang || 'nl'

  // ── Normaliseer & pluk legacy-velden ─────────────────────
  const A = answers // alias, voor leesbaarheid

  const numOrNull = (v: unknown): number | null => {
    if (v === undefined || v === null || v === '') return null
    const n = typeof v === 'number' ? v : parseFloat(String(v))
    return Number.isFinite(n) ? n : null
  }
  const strOrNull = (v: unknown): string | null => {
    if (v === undefined || v === null) return null
    const s = String(v).trim()
    return s.length === 0 ? null : s
  }

  // q20_email enkel bewaren als q20_contact='ja' (privacy)
  const q20Contact = strOrNull(A.q20_contact)?.toLowerCase() ?? null
  const q20Email = q20Contact === 'ja' ? strOrNull(A.q20_email) : null

  // ── Volledige answers-bag opslaan als JSON ───────────────
  // We strippen niet-relevante metadata (al weggefilterd in extractAnswers).
  // Kolom 'answers_json' bestaat sinds migration 0004.
  const answersJson = JSON.stringify(A)

  await db.prepare(`
    INSERT INTO responses (
      id, survey_id, ip_hash, user_agent, lang,
      q1_nps, q2_blijft_bij, q3_aantal,
      q4_sfeer, q5_sfeer_open,
      q6_akoestiek, q7_fortepiano,
      q8_repertoire, q9_favoriet,
      q10_interactie, q11_gesprek,
      q12_communic, q13_catering, q14_bijdrage,
      q15_wensen_2, q16_gasten, q17_terugkomen, q18_overige,
      q19_naam, q20_contact, q20_email,
      answers_json
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?
    )
  `).bind(
    id, surveyId, meta.ipHash, meta.userAgent, lang,
    numOrNull(A.q1_nps), strOrNull(A.q2_blijft_bij), strOrNull(A.q3_aantal),
    numOrNull(A.q4_sfeer), strOrNull(A.q5_sfeer_open),
    numOrNull(A.q6_akoestiek), strOrNull(A.q7_fortepiano),
    numOrNull(A.q8_repertoire), strOrNull(A.q9_favoriet),
    numOrNull(A.q10_interactie), strOrNull(A.q11_gesprek),
    numOrNull(A.q12_communic), strOrNull(A.q13_catering), numOrNull(A.q14_bijdrage),
    strOrNull(A.q15_wensen_2), strOrNull(A.q16_gasten), strOrNull(A.q17_terugkomen), strOrNull(A.q18_overige),
    strOrNull(A.q19_naam), q20Contact, q20Email,
    answersJson,
  ).run()
  return id
}

export async function listResponses(db: D1Database, surveyId?: number): Promise<ResponseRow[]> {
  if (typeof surveyId === 'number') {
    const r = await db.prepare(`
      SELECT * FROM responses
      WHERE deleted_at IS NULL AND survey_id = ?
      ORDER BY submitted_at DESC
    `).bind(surveyId).all<ResponseRow>()
    return r.results ?? []
  }
  const r = await db.prepare(`
    SELECT * FROM responses
    WHERE deleted_at IS NULL
    ORDER BY submitted_at DESC
  `).all<ResponseRow>()
  return r.results ?? []
}

export async function getResponse(db: D1Database, id: string): Promise<ResponseRow | null> {
  const r = await db.prepare('SELECT * FROM responses WHERE id = ? AND deleted_at IS NULL').bind(id).first<ResponseRow>()
  return r ?? null
}

export async function softDeleteResponse(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE responses SET deleted_at = datetime('now') WHERE id = ?").bind(id).run()
}

export async function deleteAllResponses(db: D1Database, surveyId?: number): Promise<number> {
  if (typeof surveyId === 'number') {
    const r = await db.prepare(
      "UPDATE responses SET deleted_at = datetime('now') WHERE deleted_at IS NULL AND survey_id = ?"
    ).bind(surveyId).run()
    return r.meta?.changes ?? 0
  }
  const r = await db.prepare("UPDATE responses SET deleted_at = datetime('now') WHERE deleted_at IS NULL").run()
  return r.meta?.changes ?? 0
}

export async function logAudit(
  db: D1Database,
  action: string,
  ipHash: string | null,
  details: object | null = null,
): Promise<void> {
  await db.prepare(
    'INSERT INTO audit_log (id, action, ip_hash, details) VALUES (?, ?, ?, ?)'
  ).bind(uuid(), action, ipHash, details ? JSON.stringify(details) : null).run()
}

// Rate limiting: max N submissions per IP-hash per uur
export async function checkRateLimit(
  db: D1Database,
  ipHash: string,
  maxPerHour: number,
): Promise<{ ok: boolean; current: number }> {
  const windowTs = Math.floor(Date.now() / (60 * 60 * 1000)) // current hour
  const row = await db.prepare(
    'SELECT count FROM rate_limit WHERE ip_hash = ? AND window_ts = ?'
  ).bind(ipHash, windowTs).first<{ count: number }>()
  const current = row?.count ?? 0
  if (current >= maxPerHour) return { ok: false, current }
  await db.prepare(`
    INSERT INTO rate_limit (ip_hash, window_ts, count) VALUES (?, ?, 1)
    ON CONFLICT(ip_hash, window_ts) DO UPDATE SET count = count + 1
  `).bind(ipHash, windowTs).run()
  // opportunistic cleanup van oude vensters (24h+)
  await db.prepare('DELETE FROM rate_limit WHERE window_ts < ?').bind(windowTs - 24).run()
  return { ok: true, current: current + 1 }
}
