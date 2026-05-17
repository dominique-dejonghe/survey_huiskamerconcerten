// AI-driven survey analysis via OpenAI (primary) → Cloudflare Workers AI (fallback).
//
// Sinds 2026-05 is dit volledig survey-aware: digest, prompt en context worden
// opgebouwd uit de per-survey vragen-snapshot (survey_questions) i.p.v. uit
// hard-coded Reeks-I codes. De prompt-tekst spreekt nu over "deze concertformule"
// en gebruikt indien beschikbaar de survey-titel / brand-context, zodat de AI
// niet meer halsstarrig over "Huiskamerconcerten Reeks I" gaat schrijven als de
// data over Ebdiep gaat.

import type { ResponseRow } from './db'
import type { Lang } from './i18n'
import type { SurveyQuestion } from './surveys'

export type AnalysisResult = {
  generated_at: string
  response_count: number
  lang: Lang
  provider?: string                        // 'openai:gpt-4o-mini' | 'workers-ai:llama-3.3' …
  samenvatting: string                     // 1-paragraph general tendency
  sterke_punten: { punt: string; bewijs: string }[]   // 3-5 items
  verbeterpunten: { punt: string; bewijs: string }[]  // 3-5 items
  // NB: veldnaam blijft `suggesties_reeks2` voor backwards-compat met cached records.
  // Inhoudelijk gaan deze suggesties over "de volgende editie van deze concertformule"
  // (niet specifiek Reeks II).
  suggesties_reeks2: { titel: string; beschrijving: string }[] // 5-8 actionable
  citaten: { vraag: string; tekst: string; sentiment: 'positief' | 'neutraal' | 'kritisch' }[]
}

type Bindings = {
  AI: any
  DB: D1Database
  OPENAI_API_KEY?: string
  OPENAI_MODEL?: string
}

/** Lichte context over de survey, gebruikt om de prompt te personaliseren. */
export type SurveyContext = {
  title_nl?: string | null
  title_en?: string | null
  series_name?: string | null
  brand_id?: string | null
  artist?: string | null
  location?: string | null
}

// ────────────────────────────────────────────────────────────
// Survey-aware helpers
// ────────────────────────────────────────────────────────────

function parseAnswers(row: ResponseRow): Record<string, unknown> {
  if (!row.answers_json) return {}
  try {
    const o = JSON.parse(row.answers_json)
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch { return {} }
}

/** answers_json > legacy q* kolom — zelfde fallback als stats/csv. */
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

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

// ────────────────────────────────────────────────────────────
// Digest-bouwer — survey-aware
// ────────────────────────────────────────────────────────────

/**
 * Bouw een compacte, gestructureerde samenvatting van alle responses,
 * gebruikmakend van de vragen-snapshot om zelf te bepalen welke vragen er
 * bestaan, welke schaal ze hebben en welke labels we tonen.
 *
 * Volgorde van blocks:
 *  1. Aantal responses
 *  2. NPS-cijfers (als er een nps-vraag is)
 *  3. Gemiddelden voor alle scale-vragen
 *  4. Choice-verdelingen per choice-vraag
 *  5. Open antwoorden, gegroepeerd per text/paragraph-vraag (max 12 citaten)
 */
function buildDigest(
  rows: ResponseRow[],
  questions: SurveyQuestion[],
  ctx?: SurveyContext,
): string {
  if (rows.length === 0) return 'Geen antwoorden beschikbaar.'

  const n = rows.length
  const parsedRows = rows.map(parseAnswers)
  const blocks: string[] = []

  // ── Context-header ──
  if (ctx) {
    const bits: string[] = []
    if (ctx.title_nl) bits.push(`titel="${ctx.title_nl}"`)
    if (ctx.artist) bits.push(`artiest="${ctx.artist}"`)
    if (ctx.location) bits.push(`locatie="${ctx.location}"`)
    if (ctx.brand_id) bits.push(`brand=${ctx.brand_id}`)
    if (bits.length) blocks.push(`Context: ${bits.join(', ')}`)
  }

  blocks.push(`Aantal responses: ${n}`)

  // ── NPS-blok ──
  const npsQ = questions.find(q => q.type === 'nps')
  if (npsQ) {
    const min = npsQ.scale_min ?? 0
    const max = npsQ.scale_max ?? 10
    const values: number[] = []
    rows.forEach((r, i) => {
      const v = toNumber(getAnswer(r, npsQ.code, parsedRows[i]))
      if (v != null) values.push(v)
    })
    let prom = 0, pas = 0, det = 0
    for (const v of values) {
      if (max - min === 10) {
        if (v >= 9) prom++; else if (v >= 7) pas++; else det++
      } else {
        const range = max - min
        if (v >= min + range * 0.8) prom++
        else if (v >= min + range * 0.6) pas++
        else det++
      }
    }
    const nps = values.length === 0
      ? 0
      : Math.round(((prom / values.length) - (det / values.length)) * 100)
    blocks.push(
      `NPS (${npsQ.code} · ${npsQ.label_nl}): ${nps} ` +
      `(promotors=${prom}, passives=${pas}, detractors=${det}, schaal=${min}-${max})`
    )
  }

  // ── Schaalgemiddelden ──
  const scaleLines: string[] = []
  for (const q of questions) {
    if (q.type !== 'scale') continue
    const vals: number[] = []
    rows.forEach((r, i) => {
      const v = toNumber(getAnswer(r, q.code, parsedRows[i]))
      if (v != null) vals.push(v)
    })
    if (vals.length === 0) {
      scaleLines.push(`${q.code}=geen antwoorden`)
      continue
    }
    const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
    const max = q.scale_max ?? 5
    scaleLines.push(`${q.code}(${q.label_nl})=${avg}/${max} (n=${vals.length})`)
  }
  if (scaleLines.length) {
    blocks.push(`Schaalgemiddelden:\n  ${scaleLines.join('\n  ')}`)
  }

  // ── Choice-verdelingen ──
  for (const q of questions) {
    if (q.type !== 'choice') continue
    const tally: Record<string, number> = {}
    rows.forEach((r, i) => {
      const v = getAnswer(r, q.code, parsedRows[i])
      if (v == null) return
      const s = String(v)
      tally[s] = (tally[s] || 0) + 1
    })
    const entries = Object.entries(tally)
    if (entries.length === 0) continue
    const summary = entries.map(([k, v]) => `${k}=${v}`).join(', ')
    blocks.push(`${q.code} (${q.label_nl}): ${summary}`)
  }

  // ── Open antwoorden ──
  for (const q of questions) {
    if (q.type !== 'text' && q.type !== 'paragraph') continue
    // Skip text-vragen die typisch een naam zijn — die hebben geen analytische waarde
    if (/naam|name|email/i.test(q.code)) continue
    const items: string[] = []
    rows.forEach((r, i) => {
      const v = getAnswer(r, q.code, parsedRows[i])
      if (typeof v !== 'string') return
      const t = v.trim().replace(/\s+/g, ' ')
      if (t.length === 0) return
      items.push(t.slice(0, 240))
    })
    if (items.length === 0) continue
    blocks.push(`\n${q.code.toUpperCase()} — ${q.label_nl} (${items.length} antwoorden):`)
    // Beperk tot 12 citaten per vraag om prompt-grootte onder controle te houden
    items.slice(0, 12).forEach((q, i) => blocks.push(`  ${i + 1}. "${q}"`))
  }

  return blocks.join('\n')
}

// ────────────────────────────────────────────────────────────
// Prompts — survey-bewust (geen "Reeks I / Jos van Immerseel" meer hardcoded)
// ────────────────────────────────────────────────────────────

function contextLineNL(ctx?: SurveyContext): string {
  if (!ctx) return 'klassieke-muziek-concertformule'
  const parts: string[] = []
  if (ctx.title_nl) parts.push(`"${ctx.title_nl}"`)
  if (ctx.artist) parts.push(`met ${ctx.artist}`)
  if (ctx.location) parts.push(`in ${ctx.location}`)
  return parts.length ? parts.join(' ') : 'deze concertformule'
}

function contextLineEN(ctx?: SurveyContext): string {
  if (!ctx) return 'classical music concert series'
  const parts: string[] = []
  if (ctx.title_en || ctx.title_nl) parts.push(`"${ctx.title_en || ctx.title_nl}"`)
  if (ctx.artist) parts.push(`with ${ctx.artist}`)
  if (ctx.location) parts.push(`at ${ctx.location}`)
  return parts.length ? parts.join(' ') : 'this concert format'
}

function buildPrompts(ctx?: SurveyContext) {
  const nlSubject = contextLineNL(ctx)
  const enSubject = contextLineEN(ctx)
  return {
    nl: {
      system: `Je bent een ervaren cultureel adviseur die Nederlandse surveys analyseert voor een klassiek-muziek-organisatie.
Je antwoordt UITSLUITEND met geldige JSON volgens het exacte schema dat de gebruiker meegeeft.
Geen extra tekst, geen markdown-blokken, geen toelichting buiten het JSON-object.
Schrijf in het Nederlands, in een warm-persoonlijke maar zakelijke toon (zoals een verfijnd cultureel verslag).
Citeer ALTIJD letterlijk uit de antwoorden — verzin nooit citaten.
Wees concreet en actiegericht; vermijd cliché-taal als "het was een fantastische ervaring".
BELANGRIJK: baseer je conclusies UITSLUITEND op de data in de DATA-sectie. Refereer alleen aan vragen/cijfers/citaten die daar daadwerkelijk staan — verzin geen vragen die er niet zijn.`,
      user: (digest: string) => `Hieronder een samenvatting van alle survey-antwoorden over ${nlSubject}.

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
    { "titel": "Concrete actie in 4-7 woorden", "beschrijving": "1-2 zinnen waarom + hoe uit te voeren voor de volgende editie van deze concertformule." }
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
- Gebruik in citaten het vraag-veld zoals het in DATA verschijnt (bv. "Q5_SFEER_OPEN" of "Q14_BIJDRAGE").
- Antwoord UITSLUITEND met het JSON-object, niets ervoor of erna.`,
    },
    en: {
      system: `You are an experienced cultural consultant who analyses surveys for a classical-music organisation.
You respond EXCLUSIVELY with valid JSON matching the exact schema the user provides.
No extra text, no markdown fences, no explanation outside the JSON object.
Write in English, in a warm-personal yet professional tone (like a refined cultural report).
ALWAYS quote answers verbatim — never invent quotes.
Be concrete and actionable; avoid cliché phrases like "it was a fantastic experience".
IMPORTANT: base conclusions EXCLUSIVELY on the data in the DATA section. Only reference questions/figures/quotes that actually appear there — never fabricate questions that aren't present.`,
      user: (digest: string) => `Below is a digest of all survey responses about ${enSubject}.

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
    { "titel": "Concrete action in 4-7 words", "beschrijving": "1-2 sentences why + how to execute for the next edition of this concert format." }
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
- Use the question codes from DATA in the "vraag" field (e.g. "Q5_SFEER_OPEN" or "Q14_BIJDRAGE").
- Respond ONLY with the JSON object, nothing before or after.`,
    },
  }
}

// ────────────────────────────────────────────────────────────
// JSON extract / repair helpers (ongewijzigd — best-effort parser voor LLM output)
// ────────────────────────────────────────────────────────────

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

  // 4. Repair truncated JSON
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

  if (lastValidEnd > 0) return s.slice(0, lastValidEnd + 1)

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
  if (lastSafe > 0) truncatePos = lastSafe
  let body = s.slice(0, truncatePos + 1)
  body = body.replace(/,\s*$/, '')

  let q = 0; let esc = false
  for (let i = 0; i < body.length; i++) {
    if (esc) { esc = false; continue }
    if (body[i] === '\\') { esc = true; continue }
    if (body[i] === '"') q++
  }
  if (q % 2 !== 0) body += '"'

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

// ────────────────────────────────────────────────────────────
// Providers
// ────────────────────────────────────────────────────────────

async function callOpenAI(
  env: Bindings,
  lang: Lang,
  digest: string,
  ctx?: SurveyContext,
): Promise<{ json: any; provider: string }> {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
  const model = env.OPENAI_MODEL || 'gpt-4o-mini'
  const p = buildPrompts(ctx)[lang]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: p.system },
        { role: 'user',   content: p.user(digest) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 300)}`)
  }
  const data: any = await res.json()
  const content = data?.choices?.[0]?.message?.content ?? ''
  const json = extractJson(content)
  if (!json || typeof json !== 'object') {
    throw new Error('OpenAI returned non-JSON content: ' + String(content).slice(0, 200))
  }
  return { json, provider: `openai:${model}` }
}

async function callWorkersAI(
  env: Bindings,
  lang: Lang,
  digest: string,
  ctx?: SurveyContext,
): Promise<{ json: any; provider: string }> {
  const p = buildPrompts(ctx)[lang]
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
        return { json, provider: `workers-ai:${model.split('/').pop()}` }
      }
      lastError = new Error('Workers AI returned non-JSON output: ' + String(text).slice(0, 200))
    } catch (e: any) {
      lastError = e
    }
  }
  throw lastError ?? new Error('Workers AI failed')
}

// ────────────────────────────────────────────────────────────
// Main entry
// ────────────────────────────────────────────────────────────

/**
 * Genereer analyse voor één survey.
 *
 * @param env       Cloudflare bindings (AI, DB, OPENAI_API_KEY, OPENAI_MODEL)
 * @param rows      antwoord-rijen voor deze survey
 * @param lang      'nl' | 'en'
 * @param questions vragen-snapshot (survey_questions, in display order)
 * @param ctx       optionele survey-context (titel, artiest, locatie, brand)
 */
export async function generateAnalysis(
  env: Bindings,
  rows: ResponseRow[],
  lang: Lang,
  questions: SurveyQuestion[] = [],
  ctx?: SurveyContext,
): Promise<AnalysisResult> {
  const digest = buildDigest(rows, questions, ctx)

  // Primary: OpenAI
  if (env.OPENAI_API_KEY) {
    try {
      const { json, provider } = await callOpenAI(env, lang, digest, ctx)
      const result = normalise(json, rows.length, lang)
      result.provider = provider
      return result
    } catch (e: any) {
      console.warn('OpenAI failed, falling back to Workers AI:', e?.message ?? e)
    }
  }

  // Fallback: Cloudflare Workers AI
  const { json, provider } = await callWorkersAI(env, lang, digest, ctx)
  const result = normalise(json, rows.length, lang)
  result.provider = provider
  return result
}

function normalise(j: any, count: number, lang: Lang): AnalysisResult {
  const arr = (v: any): any[] => Array.isArray(v) ? v : []
  return {
    generated_at: new Date().toISOString(),
    response_count: count,
    lang,
    provider: '',
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

// ────────────────────────────────────────────────────────────
// Cache helpers (24h TTL, per-survey × lang in analysis_cache)
// ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function getCachedAnalysis(
  db: D1Database,
  lang: Lang,
  surveyId: number = 1,
): Promise<AnalysisResult | null> {
  const row = await db
    .prepare('SELECT generated_at, response_count, payload FROM analysis_cache WHERE survey_id = ? AND lang = ?')
    .bind(surveyId, lang)
    .first<{ generated_at: string; response_count: number; payload: string }>()
  if (!row) return null
  const ts = Date.parse(row.generated_at.replace(' ', 'T') + 'Z')
  if (Number.isFinite(ts) && Date.now() - ts > CACHE_TTL_MS) return null
  try {
    const data = JSON.parse(row.payload)
    return { ...data, generated_at: row.generated_at, response_count: row.response_count, lang }
  } catch { return null }
}

export async function saveCachedAnalysis(
  db: D1Database,
  lang: Lang,
  result: AnalysisResult,
  surveyId: number = 1,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO analysis_cache (survey_id, lang, generated_at, response_count, payload)
      VALUES (?, ?, datetime('now'), ?, ?)
      ON CONFLICT(survey_id, lang) DO UPDATE SET
        generated_at = datetime('now'),
        response_count = excluded.response_count,
        payload = excluded.payload
    `)
    .bind(surveyId, lang, result.response_count, JSON.stringify(result))
    .run()
}

export async function clearCachedAnalysis(
  db: D1Database,
  lang?: Lang,
  surveyId?: number,
): Promise<void> {
  const conditions: string[] = []
  const args: any[] = []
  if (typeof surveyId === 'number') { conditions.push('survey_id = ?'); args.push(surveyId) }
  if (lang) { conditions.push('lang = ?'); args.push(lang) }
  const sql = 'DELETE FROM analysis_cache' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '')
  await db.prepare(sql).bind(...args).run()
}
