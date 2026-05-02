import type { ResponseRow } from './db'
import { formatNL } from './stats'

const COLUMNS: (keyof ResponseRow | 'submitted_at_nl')[] = [
  'id', 'submitted_at', 'submitted_at_nl',
  'q1_nps', 'q2_blijft_bij', 'q3_aantal',
  'q4_sfeer', 'q5_sfeer_open',
  'q6_akoestiek', 'q7_fortepiano',
  'q8_repertoire', 'q9_favoriet',
  'q10_interactie', 'q11_gesprek',
  'q12_communic', 'q13_catering', 'q14_bijdrage',
  'q15_wensen_2', 'q16_gasten', 'q17_terugkomen', 'q18_overige',
  'q19_naam', 'q20_contact', 'q20_email',
]

const HEADER_LABELS: Record<string, string> = {
  id: 'id',
  submitted_at: 'submitted_at_utc',
  submitted_at_nl: 'submitted_at_nl',
  q1_nps: 'Q1_NPS',
  q2_blijft_bij: 'Q2_blijft_bij',
  q3_aantal: 'Q3_aantal_concerten',
  q4_sfeer: 'Q4_sfeer',
  q5_sfeer_open: 'Q5_sfeer_open',
  q6_akoestiek: 'Q6_akoestiek',
  q7_fortepiano: 'Q7_fortepiano',
  q8_repertoire: 'Q8_repertoire',
  q9_favoriet: 'Q9_favoriet_concert',
  q10_interactie: 'Q10_interactie_jos',
  q11_gesprek: 'Q11_ruimte_gesprek',
  q12_communic: 'Q12_communicatie',
  q13_catering: 'Q13_catering',
  q14_bijdrage: 'Q14_bijdrage_model',
  q15_wensen_2: 'Q15_wensen_reeks2',
  q16_gasten: 'Q16_gewenste_gasten',
  q17_terugkomen: 'Q17_terugkomen',
  q18_overige: 'Q18_overige',
  q19_naam: 'Q19_naam',
  q20_contact: 'Q20_contact_ja_nee',
  q20_email: 'Q20_email',
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

export function rowsToCsv(rows: ResponseRow[]): string {
  const header = COLUMNS.map(c => csvField(HEADER_LABELS[c as string] ?? c)).join(';')
  const lines = rows.map(r => COLUMNS.map(c => {
    if (c === 'submitted_at_nl') return csvField(formatNL(r.submitted_at))
    return csvField((r as Record<string, unknown>)[c as string])
  }).join(';'))
  // BOM voor Excel-compatibiliteit + ; als delimiter (Belgische Excel-locale)
  return '\uFEFF' + [header, ...lines].join('\r\n')
}

export function rowsToJson(rows: ResponseRow[]): string {
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    count: rows.length,
    responses: rows,
  }, null, 2)
}
