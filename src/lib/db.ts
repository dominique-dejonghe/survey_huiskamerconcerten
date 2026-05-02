// D1 query helpers
import type { ResponseInput } from './validation'
import { uuid } from './crypto'

export type ResponseRow = {
  id: string
  submitted_at: string
  ip_hash: string | null
  user_agent: string | null
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
  deleted_at: string | null
}

export async function insertResponse(
  db: D1Database,
  data: ResponseInput,
  meta: { ipHash: string; userAgent: string },
): Promise<string> {
  const id = uuid()
  await db.prepare(`
    INSERT INTO responses (
      id, ip_hash, user_agent,
      q1_nps, q2_blijft_bij, q3_aantal,
      q4_sfeer, q5_sfeer_open,
      q6_akoestiek, q7_fortepiano,
      q8_repertoire, q9_favoriet,
      q10_interactie, q11_gesprek,
      q12_communic, q13_catering, q14_bijdrage,
      q15_wensen_2, q16_gasten, q17_terugkomen, q18_overige,
      q19_naam, q20_contact, q20_email
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
  `).bind(
    id, meta.ipHash, meta.userAgent,
    data.q1_nps, nz(data.q2_blijft_bij), data.q3_aantal,
    data.q4_sfeer, nz(data.q5_sfeer_open),
    data.q6_akoestiek, nz(data.q7_fortepiano),
    data.q8_repertoire, nz(data.q9_favoriet),
    data.q10_interactie, nz(data.q11_gesprek),
    data.q12_communic, nz(data.q13_catering), data.q14_bijdrage,
    nz(data.q15_wensen_2), nz(data.q16_gasten), nz(data.q17_terugkomen), nz(data.q18_overige),
    nz(data.q19_naam),
    data.q20_contact ?? null,
    data.q20_contact === 'ja' ? nz(data.q20_email) : null,
  ).run()
  return id
}

function nz(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

export async function listResponses(db: D1Database): Promise<ResponseRow[]> {
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

export async function deleteAllResponses(db: D1Database): Promise<number> {
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
