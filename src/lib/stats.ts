// KPI berekeningen voor admin dashboard
import type { ResponseRow } from './db'

export type AdminStats = {
  total: number
  nps: { score: number; promoters: number; passives: number; detractors: number; distribution: number[] }
  averages: {
    q4_sfeer: number
    q6_akoestiek: number
    q8_repertoire: number
    q10_interactie: number
    q12_communic: number
    q14_bijdrage: number
  }
  attendanceCounts: Record<string, number>
}

export function computeStats(rows: ResponseRow[]): AdminStats {
  const total = rows.length
  // NPS: promoters 9-10, passives 7-8, detractors 0-6
  const distribution = new Array(11).fill(0)
  let promoters = 0, passives = 0, detractors = 0
  for (const r of rows) {
    distribution[r.q1_nps]++
    if (r.q1_nps >= 9) promoters++
    else if (r.q1_nps >= 7) passives++
    else detractors++
  }
  const npsScore = total > 0
    ? Math.round((promoters / total - detractors / total) * 100)
    : 0

  const avg = (key: keyof ResponseRow) => {
    if (total === 0) return 0
    let s = 0, n = 0
    for (const r of rows) {
      const v = r[key]
      if (typeof v === 'number') { s += v; n++ }
    }
    return n > 0 ? Math.round((s / n) * 100) / 100 : 0
  }

  const attendanceCounts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, 'alle 6': 0 }
  for (const r of rows) {
    if (r.q3_aantal in attendanceCounts) attendanceCounts[r.q3_aantal]++
  }

  return {
    total,
    nps: { score: npsScore, promoters, passives, detractors, distribution },
    averages: {
      q4_sfeer: avg('q4_sfeer'),
      q6_akoestiek: avg('q6_akoestiek'),
      q8_repertoire: avg('q8_repertoire'),
      q10_interactie: avg('q10_interactie'),
      q12_communic: avg('q12_communic'),
      q14_bijdrage: avg('q14_bijdrage'),
    },
    attendanceCounts,
  }
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
