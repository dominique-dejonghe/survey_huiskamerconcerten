import { z } from 'zod'
import type { SurveyQuestion } from './surveys'

// ============================================================
// Server-side validation voor POST /api/responses
//
// We zijn van een rigide Reeks-I-only schema (q1_nps, q2_blijft_bij, ...)
// overgestapt op een twee-traps benadering die alle (huidige én
// toekomstige) enquêtes ondersteunt:
//
//   1) Zod-schema valideert enkel METADATA (taal, survey-id, honeypot,
//      legacy q1..q20 als ze meekomen) plus een open-eind `answers`-map
//      met willekeurige sleutels en string|number|null waarden.
//   2) `validateSurveyAnswers(questions, answers)` valideert élke
//      antwoord-waarde tegen de overeenkomstige `SurveyQuestion`
//      (type, required, scale_min/max, choice-options, e-mailregex).
//
// Backwards-compat: Reeks I blijft werken zoals voorheen, want zijn
// vragen-snapshot bevat exact q1_nps..q20_email; de validator gaat
// er gewoon doorheen.
// ============================================================

// ── 1) Zod metadata-schema ───────────────────────────────────
//
// `answers` is een vrije record. Per-vraag-validatie gebeurt in stap 2.
// We staan ook nog steeds toe dat antwoorden op het *root*-niveau
// meekomen (zoals het oude formaat) — die mergen we vóór stap 2 in
// de answers-bag. Dat geeft de frontend-migratie tijd zonder dat
// oude submits stuk gaan.
export const responseSchema = z.object({
  // Honeypot — moet leeg zijn
  website: z.string().max(0).optional().or(z.literal('')),

  // Taalcode (nl default)
  lang: z.enum(['nl', 'en']).optional().default('nl'),

  // Multi-survey identification
  survey_id: z.number().int().positive().optional(),
  brand_prefix: z.string().max(8).optional(),
  survey_slug: z.string().max(120).optional(),

  // Nieuwe, generieke antwoorden-bag
  answers: z.record(
    z.string().min(1).max(80),
    z.union([z.string().max(10000), z.number(), z.null()]),
  ).optional(),
}).passthrough() // ← legacy q1..q20 mogen meekomen op root-niveau

export type ResponseInput = z.infer<typeof responseSchema>

// ── 2) Per-vraag-validatie ───────────────────────────────────

export type ValidationIssue = { code: string; message: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Valideer een answers-bag tegen de vraagdefinities van een survey.
 * Geeft een lijst issues terug (leeg = alles ok).
 *
 * Belangrijk:
 *  - Onbekende sleutels (codes die niet in `questions` zitten) worden
 *    *geaccepteerd maar genegeerd* — handig voor honeypot, legacy
 *    velden, etc.
 *  - `null`, lege string en `undefined` tellen als "niet ingevuld".
 *  - Voor `nps`/`scale` accepteren we zowel `number` als numerieke
 *    string ("5", "10") — frontends zijn soms slordig.
 *  - Voor `choice`: waarde moet exact in `options_nl` of `options_en`
 *    zitten (of in het canonical normalized formaat).
 */
export function validateSurveyAnswers(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const q of questions) {
    const raw = answers[q.code]
    const isEmpty =
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && raw.trim() === '')

    if (q.required) {
      if (isEmpty) {
        issues.push({ code: q.code, message: 'required' })
        continue
      }
    } else if (isEmpty) {
      continue // niets te valideren
    }

    switch (q.type) {
      case 'nps':
      case 'scale': {
        const min = q.scale_min ?? (q.type === 'nps' ? 0 : 1)
        const max = q.scale_max ?? (q.type === 'nps' ? 10 : 5)
        const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
          issues.push({
            code: q.code,
            message: `must be integer between ${min} and ${max}`,
          })
        }
        break
      }
      case 'choice': {
        const s = String(raw)
        const allowed = new Set<string>([
          ...(q.options_nl || []),
          ...(q.options_en || []),
        ])
        // Sommige choice-vragen (zoals q20_contact ja/nee) komen in
        // canonical lowercase aan — accepteer ook die.
        const allowedLower = new Set(Array.from(allowed, x => x.toLowerCase()))
        if (allowed.size > 0 && !allowed.has(s) && !allowedLower.has(s.toLowerCase())) {
          issues.push({
            code: q.code,
            message: `must be one of: ${Array.from(allowed).join(', ')}`,
          })
        } else if (allowed.size === 0 && typeof raw === 'string' && raw.length > 200) {
          issues.push({ code: q.code, message: 'too long (max 200)' })
        }
        break
      }
      case 'text': {
        const s = String(raw)
        if (s.length > 2000) {
          issues.push({ code: q.code, message: 'too long (max 2000)' })
        }
        // Bijzonderheid: q20_email — wanneer ingevuld moet het geldig zijn.
        // We detecteren e-mail aan de code (eindigt op _email) of aan de
        // label-naam, om niet héél hard op één code te leunen.
        const looksLikeEmail =
          q.code.endsWith('_email') ||
          /e-?mail/i.test(q.label_nl) ||
          /e-?mail/i.test(q.label_en)
        if (looksLikeEmail && s.trim().length > 0 && !EMAIL_RE.test(s.trim())) {
          issues.push({ code: q.code, message: 'invalid email' })
        }
        break
      }
      case 'paragraph': {
        const s = String(raw)
        if (s.length > 10000) {
          issues.push({ code: q.code, message: 'too long (max 10000)' })
        }
        break
      }
      default:
        // Onbekend type → soepel accepteren (toekomstige types).
        break
    }
  }

  // Conditional follow-ups: als een choice-vraag een conditional dependant
  // heeft, en die dependant is required-when-yes, dan handhaven we dat.
  // We doen dit best-effort, gestuurd door `q.conditional_on`.
  for (const q of questions) {
    if (!q.conditional_on) continue
    const cond = q.conditional_on
    const triggerVal = answers[cond.field]
    const triggered =
      triggerVal != null &&
      String(triggerVal).toLowerCase() === String(cond.value).toLowerCase()
    if (triggered) {
      const v = answers[q.code]
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === 'string' && v.trim() === '')
      if (empty) {
        // Vervang of voeg toe — vermijd dubbele issues
        if (!issues.some(i => i.code === q.code)) {
          issues.push({ code: q.code, message: `required when ${cond.field}=${cond.value}` })
        }
      }
    }
  }

  // Speciale regel voor Reeks I (en elke survey die het patroon hergebruikt):
  // q20_email moet een geldige e-mail zijn als q20_contact='ja'. We doen deze
  // check hier expliciet, ook als q20_email géén eigen vraagrecord heeft (in
  // sommige snapshots is q20 'contact' een choice met een conditional input
  // dat los geserveerd wordt, niet als afzonderlijke survey_question-rij).
  if (
    String(answers.q20_contact ?? '').toLowerCase() === 'ja' &&
    !issues.some(i => i.code === 'q20_email')
  ) {
    const em = String(answers.q20_email ?? '').trim()
    if (em.length === 0) {
      issues.push({ code: 'q20_email', message: 'required when q20_contact=ja' })
    } else if (!EMAIL_RE.test(em)) {
      issues.push({ code: 'q20_email', message: 'invalid email' })
    }
  }

  return issues
}

/**
 * Helper: pak een answers-bag uit een geparste responseSchema-input,
 * inclusief eventuele legacy q*-velden die op root-niveau meekwamen.
 */
export function extractAnswers(parsed: ResponseInput): Record<string, unknown> {
  const explicit = (parsed as any).answers
  const bag: Record<string, unknown> =
    explicit && typeof explicit === 'object' ? { ...explicit } : {}
  // Merge legacy q* / contact / naam velden op root-niveau in de bag,
  // tenzij ze al expliciet in `answers` zaten.
  const META_KEYS = new Set(['website', 'lang', 'survey_id', 'brand_prefix', 'survey_slug', 'answers'])
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (META_KEYS.has(k)) continue
    if (!(k in bag)) bag[k] = v
  }
  return bag
}
