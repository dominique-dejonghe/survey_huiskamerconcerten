// AI-driven survey analysis via Cloudflare Workers AI (Llama 3.3 70B)
// Produces structured JSON in NL or EN.

import type { ResponseRow } from './db'
import type { Lang } from './i18n'

export type AnalysisResult = {
  generated_at: string
  response_count: number
  lang: Lang
  samenvatting: string                     // 1-paragraph general tendency
  sterke_punten: { punt: string; bewijs: string }[]   // 3-5 items
  verbeterpunten: { punt: string; bewijs: string }[]  // 3-5 items
  suggesties_reeks2: { titel: string; beschrijving: string }[] // 5-8 actionable
  citaten: { vraag: string; tekst: string; sentiment: 'positief' | 'neutraal' | 'kritisch' }[]
}

type Bindings = { AI: any; DB: D1Database }

// ---- Build a compact, structured digest of all responses ----
function buildDigest(rows: ResponseRow[]): string {
  if (rows.length === 0) return 'Geen antwoorden beschikbaar.'

  const n = rows.length
  const npsScores = rows.map(r => r.q1_nps).filter(v => typeof v === 'number')
  const promotors = npsScores.filter(v => v >= 9).length
  const passives  = npsScores.filter(v => v >= 7 && v <= 8).length
  const detractors = npsScores.filter(v => v <= 6).length
  const nps = npsScores.length === 0 ? 0 : Math.round(((promotors / npsScores.length) - (detractors / npsScores.length)) * 100)

  const avg = (key: keyof ResponseRow) => {
    const vals = rows.map(r => r[key]).filter(v => typeof v === 'number') as number[]
    return vals.length === 0 ? 0 : Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  const aantal: Record<string, number> = {}
  rows.forEach(r => { if (r.q3_aantal) aantal[r.q3_aantal] = (aantal[r.q3_aantal] || 0) + 1 })

  // Collect open answers per question, truncated to 240 chars each
  const collectOpen = (key: keyof ResponseRow): string[] =>
    rows
      .map(r => r[key])
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map(s => s.trim().replace(/\s+/g, ' ').slice(0, 240))

  const blocks: string[] = []
  blocks.push(`Aantal responses: ${n}`)
  blocks.push(`NPS: ${nps} (promotors=${promotors}, passives=${passives}, detractors=${detractors})`)
  blocks.push(`Gemiddelden (1-5 schaal): sfeer=${avg('q4_sfeer')}, akoestiek=${avg('q6_akoestiek')}, repertoire=${avg('q8_repertoire')}, interactie=${avg('q10_interactie')}, communicatie=${avg('q12_communic')}, bijdrage=${avg('q14_bijdrage')}`)
  blocks.push(`Concertbezoek: ${Object.entries(aantal).map(([k, v]) => `${k}=${v}`).join(', ')}`)

  const openMap: { label: string; key: keyof ResponseRow }[] = [
    { label: 'Q2 wat blijft bij',        key: 'q2_blijft_bij' },
    { label: 'Q5 sfeer toelichting',     key: 'q5_sfeer_open' },
    { label: 'Q7 fortepiano',            key: 'q7_fortepiano' },
    { label: 'Q9 favoriet concert',      key: 'q9_favoriet' },
    { label: 'Q11 ruimte voor gesprek',  key: 'q11_gesprek' },
    { label: 'Q13 catering/receptie',    key: 'q13_catering' },
    { label: 'Q15 wensen Reeks II',      key: 'q15_wensen_2' },
    { label: 'Q16 gewenste gasten',      key: 'q16_gasten' },
    { label: 'Q17 wat zou je terug brengen', key: 'q17_terugkomen' },
    { label: 'Q18 overige',              key: 'q18_overige' },
  ]

  for (const { label, key } of openMap) {
    const items = collectOpen(key)
    if (items.length === 0) continue
    blocks.push(`\n${label} (${items.length} antwoorden):`)
    // Limit to 12 quotes per question to keep prompt small
    items.slice(0, 12).forEach((q, i) => blocks.push(`  ${i + 1}. "${q}"`))
  }

  return blocks.join('\n')
}

// ---- Prompts ----
const PROMPTS = {
  nl: {
    system: `Je bent een ervaren cultureel adviseur die Nederlandse surveys analyseert voor een klassiek-muziek-vereniging.
Je antwoordt UITSLUITEND met geldige JSON volgens het exacte schema dat de gebruiker meegeeft.
Geen extra tekst, geen markdown-blokken, geen toelichting buiten het JSON-object.
Schrijf in het Nederlands, in een warm-persoonlijke maar zakelijke toon (zoals een verfijnd cultureel verslag).
Citeer ALTIJD letterlijk uit de antwoorden — verzin nooit citaten.
Wees concreet en actiegericht; vermijd cliché-taal als "het was een fantastische ervaring".`,
    user: (digest: string) => `Hieronder een samenvatting van alle survey-antwoorden over de Huiskamerconcerten Reeks I (Jos van Immerseel + Ayako Ito, fortepiano).

DATA:
${digest}

Lever JSON met deze EXACTE structuur (geen extra velden):
{
  "samenvatting": "Eén alinea van 4-6 zinnen over de algemene tendens.",
  "sterke_punten": [
    { "punt": "Korte titel", "bewijs": "Cijferonderbouwing of letterlijk citaat met aanhalingstekens." }
  ],
  "verbeterpunten": [
    { "punt": "Korte titel", "bewijs": "Cijferonderbouwing of letterlijk citaat." }
  ],
  "suggesties_reeks2": [
    { "titel": "Concrete actie in 4-7 woorden", "beschrijving": "1-2 zinnen waarom + hoe uit te voeren." }
  ],
  "citaten": [
    { "vraag": "Q5", "tekst": "letterlijk citaat", "sentiment": "positief" }
  ]
}

Regels:
- 3 à 5 sterke_punten, 3 à 5 verbeterpunten, 5 à 8 suggesties_reeks2.
- 6 à 10 citaten, gebalanceerd: minstens 2 positief, 2 kritisch, 2 neutraal indien beschikbaar.
- sentiment is exact één van: "positief", "neutraal", "kritisch".
- Schrijf ALLES in het Nederlands.
- Antwoord UITSLUITEND met het JSON-object, niets ervoor of erna.`,
  },
  en: {
    system: `You are an experienced cultural consultant who analyses surveys for a classical-music association.
You respond EXCLUSIVELY with valid JSON matching the exact schema the user provides.
No extra text, no markdown fences, no explanation outside the JSON object.
Write in English, in a warm-personal yet professional tone (like a refined cultural report).
ALWAYS quote answers verbatim — never invent quotes.
Be concrete and actionable; avoid cliché phrases like "it was a fantastic experience".`,
    user: (digest: string) => `Below is a digest of all survey responses about the House Concerts Series I (Jos van Immerseel + Ayako Ito, fortepiano).

DATA:
${digest}

Return JSON with this EXACT structure (no extra fields):
{
  "samenvatting": "One paragraph of 4-6 sentences on the overall tendency.",
  "sterke_punten": [
    { "punt": "Short title", "bewijs": "Numerical evidence or verbatim quote in quotation marks." }
  ],
  "verbeterpunten": [
    { "punt": "Short title", "bewijs": "Numerical evidence or verbatim quote." }
  ],
  "suggesties_reeks2": [
    { "titel": "Concrete action in 4-7 words", "beschrijving": "1-2 sentences why + how to execute." }
  ],
  "citaten": [
    { "vraag": "Q5", "tekst": "verbatim quote (translate Dutch quotes to English in parentheses if needed)", "sentiment": "positief" }
  ]
}

Rules:
- 3 to 5 sterke_punten, 3 to 5 verbeterpunten, 5 to 8 suggesties_reeks2.
- 6 to 10 citaten, balanced: at least 2 positive, 2 critical, 2 neutral if available.
- sentiment is exactly one of: "positief", "neutraal", "kritisch" (we keep the Dutch labels for consistency with the data model).
- Write ALL content in English.
- Respond ONLY with the JSON object, nothing before or after.`,
  },
}

// ---- Helper: try to extract a JSON object from a possibly noisy LLM string ----
function extractJson(raw: string): any | null {
  if (!raw) return null

  // 1. Direct parse
  try { return JSON.parse(raw) } catch {}

  // 2. Strip code fences ```json ... ```
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence) {
    try { return JSON.parse(fence[1]) } catch {}
  }

  // 3. Slice from first '{' to last '}'
  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  if (first >= 0 && last > first) {
    const candidate = raw.slice(first, last + 1)
    try { return JSON.parse(candidate) } catch {}
  }

  // 4. Repair truncated JSON (common when max_tokens too low):
  //    walk from first '{' tracking braces/brackets/strings, then close gracefully.
  if (first >= 0) {
    const repaired = repairTruncatedJson(raw.slice(first))
    if (repaired) {
      try { return JSON.parse(repaired) } catch {}
    }
  }

  return null
}

function repairTruncatedJson(s: string): string | null {
  let inString = false
  let escape = false
  const stack: string[] = []
  let lastValidEnd = -1

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escape) { escape = false; continue }
    if (c === '\\' && inString) { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue

    if (c === '{' || c === '[') stack.push(c)
    else if (c === '}') { if (stack[stack.length - 1] === '{') stack.pop(); if (stack.length === 0) lastValidEnd = i }
    else if (c === ']') { if (stack[stack.length - 1] === '[') stack.pop(); if (stack.length === 0) lastValidEnd = i }
  }

  // If we have a complete top-level object somewhere, take that
  if (lastValidEnd > 0) return s.slice(0, lastValidEnd + 1)

  // Otherwise: truncate at last sensible position and close brackets
  // Find last comma or '{' or '[' that is NOT inside a string, then truncate there
  let truncatePos = s.length
  inString = false
  escape = false
  let lastSafe = -1
  const stack2: string[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escape) { escape = false; continue }
    if (c === '\\' && inString) { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{' || c === '[') stack2.push(c)
    else if (c === '}' || c === ']') stack2.pop()
    if (!inString && (c === ',' || c === '}' || c === ']')) lastSafe = i
  }
  if (lastSafe > 0) truncatePos = lastSafe // include up to and incl this char
  let body = s.slice(0, truncatePos + 1)

  // If we ended with a comma, drop it
  body = body.replace(/,\s*$/, '')

  // Close any open strings (we should not normally cut inside a string,
  // but be safe: check if number of unescaped quotes is odd)
  let q = 0; let esc = false
  for (let i = 0; i < body.length; i++) {
    if (esc) { esc = false; continue }
    if (body[i] === '\\') { esc = true; continue }
    if (body[i] === '"') q++
  }
  if (q % 2 !== 0) body += '"'

  // Close remaining open brackets
  const openStack: string[] = []
  inString = false
  escape = false
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (escape) { escape = false; continue }
    if (c === '\\' && inString) { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{' || c === '[') openStack.push(c)
    else if (c === '}' && openStack[openStack.length - 1] === '{') openStack.pop()
    else if (c === ']' && openStack[openStack.length - 1] === '[') openStack.pop()
  }
  while (openStack.length) {
    const o = openStack.pop()
    body += o === '{' ? '}' : ']'
  }
  return body
}

// ---- Main entry ----
export async function generateAnalysis(
  env: Bindings,
  rows: ResponseRow[],
  lang: Lang,
): Promise<AnalysisResult> {
  const digest = buildDigest(rows)
  const p = PROMPTS[lang]

  // Llama 3.3 70B Instruct (fast variant for Workers AI)
  // Fallback to 3.1 if 3.3 not available in account region.
  const models = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-70b-instruct']
  let lastError: any = null
  for (const model of models) {
    try {
      const result: any = await env.AI.run(model, {
        messages: [
          { role: 'system', content: p.system },
          { role: 'user',   content: p.user(digest) },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      })
      const text: string = typeof result === 'string' ? result : (result?.response ?? result?.result ?? '')
      const json = extractJson(text)
      if (json && typeof json === 'object') {
        return normalise(json, rows.length, lang)
      }
      lastError = new Error('AI returned non-JSON output: ' + String(text).slice(0, 200))
    } catch (e: any) {
      lastError = e
    }
  }
  throw lastError ?? new Error('AI analysis failed')
}

function normalise(j: any, count: number, lang: Lang): AnalysisResult {
  const arr = (v: any): any[] => Array.isArray(v) ? v : []
  return {
    generated_at: new Date().toISOString(),
    response_count: count,
    lang,
    samenvatting: typeof j.samenvatting === 'string' ? j.samenvatting : '',
    sterke_punten: arr(j.sterke_punten).map(x => ({
      punt: String(x?.punt ?? '').slice(0, 200),
      bewijs: String(x?.bewijs ?? '').slice(0, 600),
    })).filter(x => x.punt),
    verbeterpunten: arr(j.verbeterpunten).map(x => ({
      punt: String(x?.punt ?? '').slice(0, 200),
      bewijs: String(x?.bewijs ?? '').slice(0, 600),
    })).filter(x => x.punt),
    suggesties_reeks2: arr(j.suggesties_reeks2).map(x => ({
      titel: String(x?.titel ?? '').slice(0, 200),
      beschrijving: String(x?.beschrijving ?? '').slice(0, 600),
    })).filter(x => x.titel),
    citaten: arr(j.citaten).map(x => {
      const s = String(x?.sentiment ?? 'neutraal').toLowerCase()
      const sentiment = s.startsWith('pos') ? 'positief' as const
        : s.startsWith('krit') || s.startsWith('neg') ? 'kritisch' as const
        : 'neutraal' as const
      return {
        vraag: String(x?.vraag ?? '').slice(0, 40),
        tekst: String(x?.tekst ?? '').slice(0, 500),
        sentiment,
      }
    }).filter(x => x.tekst),
  }
}

// ---- Cache helpers (24h TTL, per-lang row in analysis_cache) ----
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function getCachedAnalysis(db: D1Database, lang: Lang): Promise<AnalysisResult | null> {
  const row = await db
    .prepare('SELECT generated_at, response_count, payload FROM analysis_cache WHERE lang = ?')
    .bind(lang)
    .first<{ generated_at: string; response_count: number; payload: string }>()
  if (!row) return null
  // SQLite returns "YYYY-MM-DD HH:MM:SS" UTC — parse safely
  const ts = Date.parse(row.generated_at.replace(' ', 'T') + 'Z')
  if (Number.isFinite(ts) && Date.now() - ts > CACHE_TTL_MS) return null
  try {
    const data = JSON.parse(row.payload)
    return { ...data, generated_at: row.generated_at, response_count: row.response_count, lang }
  } catch { return null }
}

export async function saveCachedAnalysis(db: D1Database, lang: Lang, result: AnalysisResult): Promise<void> {
  await db
    .prepare(`
      INSERT INTO analysis_cache (lang, generated_at, response_count, payload)
      VALUES (?, datetime('now'), ?, ?)
      ON CONFLICT(lang) DO UPDATE SET
        generated_at = datetime('now'),
        response_count = excluded.response_count,
        payload = excluded.payload
    `)
    .bind(lang, result.response_count, JSON.stringify(result))
    .run()
}

export async function clearCachedAnalysis(db: D1Database, lang?: Lang): Promise<void> {
  if (lang) {
    await db.prepare('DELETE FROM analysis_cache WHERE lang = ?').bind(lang).run()
  } else {
    await db.prepare('DELETE FROM analysis_cache').run()
  }
}
