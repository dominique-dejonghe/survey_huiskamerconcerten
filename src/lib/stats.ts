// KPI berekeningen voor admin dashboard
//
// Sinds 2026-05 zijn deze stats survey-bewust: ze rekenen niet meer met
// hard-coded q1..q20 kolomnamen, maar gebruiken de per-survey vragen-snapshot
// (survey_questions) als bron van waarheid voor welke vragen er bestaan en
// welk type/min/max ze hebben.
//
// Waarden worden eerst uit `answers_json` gelezen (volledig per-survey antwoord-
// pakket sinds migratie 0004); voor surveys die toevallig nog de legacy
// q1..q20 codes hergebruiken, vallen we netjes terug op de oude kolommen,
// zodat bestaande Reeks-I data zonder migratie blijft tellen.
import type { ResponseRow } from './db'
import type { SurveyQuestion } from './surveys'

/** Eén regel in de "scores per dimensie" balkenchart. */
export type ScaleAverage = {
  code: string
  label_nl: string
  label_en: string
  type: 'nps' | 'scale'
  scale_min: number
  scale_max: number
  avg: number   // rounded to 2 decimals, 0 if no answers
  count: number // aantal antwoorden dat meetelde
}

/** Verdeling voor één choice-vraag (bv. "# concerten bijgewoond"). */
export type ChoiceBreakdown = {
  code: string
  label_nl: string
  label_en: string
  /** Behoudt de volgorde van options_nl uit de survey-snapshot. */
  options: Array<{ value: string; count: number }>
}

export type AdminStats = {
  total: number
  /** null als de survey geen NPS-vraag heeft */
  nps: {
    code: string
    score: number
    promoters: number
    passives: number
    detractors: number
    distribution: number[] // 11 buckets 0..10
  } | null
  /** Eén regel per scale/nps vraag, in display_order. */
  scaleAverages: ScaleAverage[]
  /**
   * Eén breakdown per choice-vraag. Het frontend toont standaard de eerste,
   * maar we leveren ze alle om later eventueel meerdere choice-grafieken te
   * tonen zonder server-roundtrip.
   */
  choiceBreakdowns: ChoiceBreakdown[]
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Veilig answers_json parsen — geeft {} bij ongeldige/lege input. */
function parseAnswers(row: ResponseRow): Record<string, unknown> {
  if (!row.answers_json) return {}
  try {
    const o = JSON.parse(row.answers_json)
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch { return {} }
}

/**
 * Lees het antwoord op `code` uit een response-row.
 * Voorrang: answers_json (nieuwe pipeline) > legacy q* kolommen (Reeks I).
 * Geeft `undefined` als de vraag niet beantwoord werd.
 */
function getAnswer(row: ResponseRow, code: string, parsed?: Record<string, unknown>): unknown {
  const a = parsed ?? parseAnswers(row)
  if (Object.prototype.hasOwnProperty.call(a, code)) {
    const v = a[code]
    // Behandel lege string / null / undefined als "niet ingevuld"
    if (v === null || v === undefined) return undefined
    if (typeof v === 'string' && v.trim() === '') return undefined
    return v
  }
  // Fallback: legacy kolom met exact dezelfde naam
  // (werkt voor q1_nps..q20_email zonder verdere mapping)
  if (code in row) {
    const v = (row as unknown as Record<string, unknown>)[code]
    if (v === null || v === undefined) return undefined
    if (typeof v === 'string' && v.trim() === '') return undefined
    return v
  }
  return undefined
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Bereken alle dashboard-statistieken voor één survey.
 *
 * @param rows      response-rijen voor deze survey (al gefilterd op survey_id)
 * @param questions survey-snapshot van vraagdefinities, in display order
 */
export function computeStats(
  rows: ResponseRow[],
  questions: SurveyQuestion[] = [],
): AdminStats {
  const total = rows.length

  // Per-row geparseerd answers_json cachen — anders parsen we N×M keer.
  const parsed = rows.map(parseAnswers)

  // ── NPS ──────────────────────────────────────────────────
  // Eerste vraag met type 'nps' (meestal q1_nps in Reeks I, maar niet vereist).
  const npsQ = questions.find(q => q.type === 'nps')
  let nps: AdminStats['nps'] = null
  if (npsQ) {
    const min = npsQ.scale_min ?? 0
    const max = npsQ.scale_max ?? 10
    // Distribution-array dekt het hele bereik (meestal 0..10 = 11 buckets)
    const bucketCount = Math.max(1, max - min + 1)
    const distribution = new Array(bucketCount).fill(0)
    let promoters = 0, passives = 0, detractors = 0, counted = 0
    rows.forEach((r, i) => {
      const v = toNumber(getAnswer(r, npsQ.code, parsed[i]))
      if (v == null) return
      const idx = Math.round(v) - min
      if (idx >= 0 && idx < bucketCount) distribution[idx]++
      // Klassieke NPS-buckets gelden alleen voor 0..10 schaal; voor andere
      // schalen mappen we promoters = top 20%, detractors = bottom 60%.
      if (max - min === 10) {
        if (v >= 9) promoters++
        else if (v >= 7) passives++
        else detractors++
      } else {
        const range = max - min
        if (v >= min + range * 0.8) promoters++
        else if (v >= min + range * 0.6) passives++
        else detractors++
      }
      counted++
    })
    const score = counted > 0
      ? Math.round(((promoters / counted) - (detractors / counted)) * 100)
      : 0
    nps = { code: npsQ.code, score, promoters, passives, detractors, distribution }
  }

  // ── Scale/NPS gemiddelden ────────────────────────────────
  // Eén regel per scale-vraag (en ook voor de NPS-vraag, zodat hij in de
  // scores-chart kan verschijnen als het dashboard hem wil tonen).
  const scaleAverages: ScaleAverage[] = []
  for (const q of questions) {
    if (q.type !== 'scale' && q.type !== 'nps') continue
    let sum = 0, count = 0
    rows.forEach((r, i) => {
      const v = toNumber(getAnswer(r, q.code, parsed[i]))
      if (v == null) return
      sum += v
      count++
    })
    scaleAverages.push({
      code: q.code,
      label_nl: q.label_nl,
      label_en: q.label_en,
      type: q.type,
      scale_min: q.scale_min ?? 1,
      scale_max: q.scale_max ?? 5,
      avg: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
      count,
    })
  }

  // ── Choice breakdowns ────────────────────────────────────
  // Eén regel per choice-vraag, in display order. Het frontend kiest welke
  // het wil tonen (typisch de eerste — equivalent van de oude q3_aantal).
  const choiceBreakdowns: ChoiceBreakdown[] = []
  for (const q of questions) {
    if (q.type !== 'choice') continue
    const opts = q.options_nl ?? []
    // Per-optie teller, behoudend de oorspronkelijke volgorde
    const tally = new Map<string, number>()
    for (const opt of opts) tally.set(opt, 0)
    rows.forEach((r, i) => {
      const v = getAnswer(r, q.code, parsed[i])
      if (v == null) return
      const s = String(v)
      tally.set(s, (tally.get(s) ?? 0) + 1)
    })
    choiceBreakdowns.push({
      code: q.code,
      label_nl: q.label_nl,
      label_en: q.label_en,
      options: Array.from(tally.entries()).map(([value, count]) => ({ value, count })),
    })
  }

  return { total, nps, scaleAverages, choiceBreakdowns }
}

// Format NL date: DD/MM/YYYY HH:mm
export function formatNL(iso: string): string {
  // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' (UTC)
  const safe = iso.replace(' ', 'T') + (iso.includes('T') || iso.includes('Z') ? '' : 'Z')
  const d = new Date(safe)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
