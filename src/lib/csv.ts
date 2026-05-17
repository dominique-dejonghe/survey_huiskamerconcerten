// Survey-aware CSV/JSON export.
//
// Sinds 2026-05 zijn de kolommen niet meer hard-coded op q1..q20 maar afgeleid
// van de per-survey vragen-snapshot (survey_questions). Daardoor klopt de export
// ook voor Ebdiepconcert-1 of welke toekomstige survey dan ook — inclusief Q14
// of nieuwe vragen die later worden toegevoegd.
import type { ResponseRow } from './db'
import type { SurveyQuestion } from './surveys'
import { formatNL } from './stats'

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
 * Identieke logica als in stats.ts — bewust dupliceerd om cross-imports
 * te vermijden (csv.ts moet edge-runtime-safe blijven).
 */
function getAnswer(row: ResponseRow, code: string, parsed?: Record<string, unknown>): unknown {
  const a = parsed ?? parseAnswers(row)
  if (Object.prototype.hasOwnProperty.call(a, code)) {
    const v = a[code]
    if (v === null || v === undefined) return undefined
    if (typeof v === 'string' && v.trim() === '') return undefined
    return v
  }
  if (code in row) {
    const v = (row as unknown as Record<string, unknown>)[code]
    if (v === null || v === undefined) return undefined
    if (typeof v === 'string' && v.trim() === '') return undefined
    return v
  }
  return undefined
}

function csvField(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  // Excel-veiligheid tegen formula injection
  if (/^[=+\-@]/.test(s)) s = "'" + s
  if (/[",;\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/** Maakt een korte, leesbare CSV-header van een label, bv. "Q4_SFEER · Hoe ervoer je..." */
function headerForQuestion(q: SurveyQuestion): string {
  // Behoud de code als prefix zodat sorteren in Excel logisch blijft,
  // maar voeg het label erbij zodat de kolom interpreteerbaar is zonder lookup.
  const codeUp = q.code.toUpperCase()
  const label = (q.label_nl || '').trim()
  if (!label) return codeUp
  // Truncate erg lange labels om Excel-kolommen werkbaar te houden
  const short = label.length > 80 ? label.slice(0, 77) + '…' : label
  return `${codeUp} — ${short}`
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Bouw een CSV-string op uit responses, gebruikmakend van de survey-snapshot
 * om te bepalen welke kolommen er moeten zijn en in welke volgorde.
 *
 * Layout:
 *   id ; submitted_at_utc ; submitted_at_nl ; lang ; <Q1> ; <Q2> ; … ; <Q-N>
 *
 * Vragen verschijnen in display_order (zelfde volgorde als het formulier
 * en het dashboard tonen).
 */
export function rowsToCsv(rows: ResponseRow[], questions: SurveyQuestion[] = []): string {
  // Standaard meta-kolommen — altijd vooraan
  const metaCols: Array<{ id: string; label: string; render: (r: ResponseRow) => string }> = [
    { id: 'id', label: 'id', render: r => r.id },
    { id: 'submitted_at_utc', label: 'submitted_at_utc', render: r => r.submitted_at },
    { id: 'submitted_at_nl', label: 'submitted_at_nl', render: r => formatNL(r.submitted_at) },
    {
      id: 'lang',
      label: 'lang',
      render: r => String((r as unknown as Record<string, unknown>).lang ?? ''),
    },
  ]

  // Vraagkolommen — uit survey-snapshot, in display_order (al zo binnen vanuit listSurveyQuestions)
  const qCols = questions.map(q => ({ q, header: headerForQuestion(q) }))

  // Header rij
  const headerCells = [
    ...metaCols.map(m => csvField(m.label)),
    ...qCols.map(c => csvField(c.header)),
  ]
  const header = headerCells.join(';')

  // Data rijen — per response één rij, vragen in dezelfde volgorde als header
  const lines = rows.map(r => {
    const parsed = parseAnswers(r)
    const cells = [
      ...metaCols.map(m => csvField(m.render(r))),
      ...qCols.map(c => {
        const v = getAnswer(r, c.q.code, parsed)
        return csvField(v)
      }),
    ]
    return cells.join(';')
  })

  // BOM voor Excel-compatibiliteit + ; als delimiter (Belgische Excel-locale)
  return '\uFEFF' + [header, ...lines].join('\r\n')
}

/**
 * JSON-export: machineleesbaar, met volledige vragen-snapshot meegeleverd zodat
 * downstream tools (Sheets, Power BI, een eigen script) kunnen reconstrueren
 * wat elke code betekent — zonder afhankelijkheid van het admin-dashboard.
 *
 * Structuur:
 * {
 *   exported_at: "...ISO...",
 *   count: 12,
 *   survey: { id, slug, title_nl, ... },         // optioneel
 *   questions: [{code, type, label_nl, ...}, …], // volledige snapshot
 *   responses: [
 *     {
 *       id, submitted_at, lang, ...,
 *       answers: { q1_nps: 9, q4_sfeer: 5, ... } // genormaliseerd
 *     }, …
 *   ]
 * }
 */
export function rowsToJson(
  rows: ResponseRow[],
  questions: SurveyQuestion[] = [],
  survey?: { id: number; slug: string; title_nl: string | null; brand_id?: string | null } | null,
): string {
  // Bouw genormaliseerde antwoorden-blok: één key per vraag uit de snapshot,
  // ongeacht of het origineel uit answers_json of een legacy kolom komt.
  const normalized = rows.map(r => {
    const parsed = parseAnswers(r)
    const answers: Record<string, unknown> = {}
    for (const q of questions) {
      const v = getAnswer(r, q.code, parsed)
      answers[q.code] = v === undefined ? null : v
    }
    return {
      id: r.id,
      submitted_at: r.submitted_at,
      submitted_at_nl: formatNL(r.submitted_at),
      lang: (r as unknown as Record<string, unknown>).lang ?? null,
      answers,
    }
  })

  return JSON.stringify({
    exported_at: new Date().toISOString(),
    count: rows.length,
    survey: survey
      ? {
          id: survey.id,
          slug: survey.slug,
          title_nl: survey.title_nl,
          brand_id: survey.brand_id ?? null,
        }
      : null,
    questions,
    responses: normalized,
  }, null, 2)
}
