// Multi-survey domain helpers: brands, surveys, questions library.
// Wrapped over the D1 database. The legacy single-survey code keeps working;
// these helpers add the per-survey scoping needed for the new multi-survey UI.

export type Brand = {
  id: 'huiskamer' | 'ebdiep' | string
  url_prefix: string
  name_nl: string
  name_en: string
  primary_color: string
  accent_color: string
  surface_color: string
  logo_url: string | null
  website_url: string | null
  contact_email: string | null
  created_at: string
}

export type SurveyStatus = 'open' | 'closed' | 'archived'

export type Survey = {
  id: number
  slug: string
  brand_id: string
  series_name: string | null
  title_nl: string
  title_en: string
  subtitle_nl: string | null
  subtitle_en: string | null
  artist: string | null
  concert_date: string | null
  date_from: string | null
  date_to: string | null
  location: string | null
  status: SurveyStatus
  lang_default: 'nl' | 'en'
  question_codes: string[]
  intro_nl: string | null
  intro_en: string | null
  thanks_nl: string | null
  thanks_en: string | null
  created_at: string
  closed_at: string | null
}

type SurveyRow = Omit<Survey, 'question_codes'> & { question_codes: string }

function rowToSurvey(r: SurveyRow): Survey {
  let codes: string[] = []
  try {
    codes = r.question_codes ? JSON.parse(r.question_codes) : []
    if (!Array.isArray(codes)) codes = []
  } catch { codes = [] }
  return { ...r, question_codes: codes }
}

export async function listBrands(db: D1Database): Promise<Brand[]> {
  const r = await db.prepare('SELECT * FROM brands ORDER BY url_prefix').all<Brand>()
  return r.results ?? []
}

export async function getBrand(db: D1Database, id: string): Promise<Brand | null> {
  const r = await db.prepare('SELECT * FROM brands WHERE id = ?').bind(id).first<Brand>()
  return r ?? null
}

export async function getBrandByPrefix(db: D1Database, prefix: string): Promise<Brand | null> {
  const r = await db.prepare('SELECT * FROM brands WHERE url_prefix = ?').bind(prefix).first<Brand>()
  return r ?? null
}

export async function listSurveys(
  db: D1Database,
  opts: { brandId?: string; status?: SurveyStatus | 'all' } = {},
): Promise<Survey[]> {
  const where: string[] = []
  const args: any[] = []
  if (opts.brandId) { where.push('brand_id = ?'); args.push(opts.brandId) }
  if (opts.status && opts.status !== 'all') { where.push('status = ?'); args.push(opts.status) }
  const sql = 'SELECT * FROM surveys' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY id DESC'
  const r = await db.prepare(sql).bind(...args).all<SurveyRow>()
  return (r.results ?? []).map(rowToSurvey)
}

export async function getSurveyById(db: D1Database, id: number): Promise<Survey | null> {
  const r = await db.prepare('SELECT * FROM surveys WHERE id = ?').bind(id).first<SurveyRow>()
  return r ? rowToSurvey(r) : null
}

export async function getSurveyBySlug(
  db: D1Database,
  brandPrefix: string,
  slug: string,
): Promise<Survey | null> {
  const r = await db.prepare(`
    SELECT s.* FROM surveys s
    JOIN brands b ON b.id = s.brand_id
    WHERE b.url_prefix = ? AND s.slug = ?
  `).bind(brandPrefix, slug).first<SurveyRow>()
  return r ? rowToSurvey(r) : null
}

export type ListSurveysWithStatsRow = Survey & {
  brand_name_nl: string
  brand_name_en: string
  brand_primary_color: string
  brand_accent_color: string
  brand_logo_url: string | null
  response_count: number
  avg_nps: number | null
  last_response_at: string | null
}

export async function listSurveysWithStats(
  db: D1Database,
  opts: { status?: SurveyStatus | 'all' } = {},
): Promise<ListSurveysWithStatsRow[]> {
  const where: string[] = []
  const args: any[] = []
  if (opts.status && opts.status !== 'all') { where.push('s.status = ?'); args.push(opts.status) }
  const sql = `
    SELECT
      s.*,
      b.name_nl AS brand_name_nl,
      b.name_en AS brand_name_en,
      b.primary_color AS brand_primary_color,
      b.accent_color AS brand_accent_color,
      b.logo_url AS brand_logo_url,
      (SELECT COUNT(*) FROM responses r WHERE r.survey_id = s.id AND r.deleted_at IS NULL) AS response_count,
      (SELECT AVG(r.q1_nps) FROM responses r WHERE r.survey_id = s.id AND r.deleted_at IS NULL) AS avg_nps,
      (SELECT MAX(r.submitted_at) FROM responses r WHERE r.survey_id = s.id AND r.deleted_at IS NULL) AS last_response_at
    FROM surveys s
    JOIN brands b ON b.id = s.brand_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.created_at DESC
  `
  const r = await db.prepare(sql).bind(...args).all<any>()
  return (r.results ?? []).map((row: any) => ({
    ...rowToSurvey(row),
    brand_name_nl: row.brand_name_nl,
    brand_name_en: row.brand_name_en,
    brand_primary_color: row.brand_primary_color,
    brand_accent_color: row.brand_accent_color,
    brand_logo_url: row.brand_logo_url,
    response_count: Number(row.response_count) || 0,
    avg_nps: row.avg_nps == null ? null : Number(row.avg_nps),
    last_response_at: row.last_response_at,
  }))
}

// ============================================================
// QUESTION LIBRARY
// ============================================================

export type LibraryQuestion = {
  code: string
  type: 'nps' | 'scale' | 'choice' | 'text' | 'paragraph'
  category: string | null
  required: number
  scale_min: number | null
  scale_max: number | null
  label_nl: string
  label_en: string
  helper_nl: string | null
  helper_en: string | null
  min_label_nl: string | null
  min_label_en: string | null
  max_label_nl: string | null
  max_label_en: string | null
  options_nl: string[] | null
  options_en: string[] | null
  conditional_on: { field: string; value: string } | null
  times_used: number
  last_used_at: string | null
  created_at: string
}

type LibraryQuestionRow = Omit<LibraryQuestion, 'options_nl' | 'options_en' | 'conditional_on'> & {
  options_nl: string | null
  options_en: string | null
  conditional_on: string | null
}

function rowToQuestion(r: LibraryQuestionRow): LibraryQuestion {
  const parseArr = (s: string | null): string[] | null => {
    if (!s) return null
    try { const a = JSON.parse(s); return Array.isArray(a) ? a : null } catch { return null }
  }
  let cond: { field: string; value: string } | null = null
  try {
    if (r.conditional_on) {
      const c = JSON.parse(r.conditional_on)
      if (c && typeof c === 'object') cond = { field: c.showField ?? c.field, value: c.whenValue ?? c.value }
    }
  } catch { cond = null }
  return {
    ...r,
    options_nl: parseArr(r.options_nl),
    options_en: parseArr(r.options_en),
    conditional_on: cond,
  }
}

export async function listLibraryQuestions(db: D1Database): Promise<LibraryQuestion[]> {
  const r = await db.prepare('SELECT * FROM questions ORDER BY times_used DESC, code').all<LibraryQuestionRow>()
  return (r.results ?? []).map(rowToQuestion)
}

export async function getLibraryQuestion(db: D1Database, code: string): Promise<LibraryQuestion | null> {
  const r = await db.prepare('SELECT * FROM questions WHERE code = ?').bind(code).first<LibraryQuestionRow>()
  return r ? rowToQuestion(r) : null
}

// ============================================================
// QUESTION LIBRARY CRUD — used by /admin/questions
// ============================================================

export type QuestionInput = {
  code: string
  type: 'nps' | 'scale' | 'choice' | 'text' | 'paragraph'
  category?: string | null
  required: boolean
  scale_min?: number | null
  scale_max?: number | null
  label_nl: string
  label_en: string
  helper_nl?: string | null
  helper_en?: string | null
  min_label_nl?: string | null
  min_label_en?: string | null
  max_label_nl?: string | null
  max_label_en?: string | null
  options_nl?: string[] | null
  options_en?: string[] | null
  conditional_on?: { field: string; value: string } | null
}

/** Strict validation matching the type definition. Returns array of error strings. */
export function validateQuestionInput(input: Partial<QuestionInput>): string[] {
  const errs: string[] = []
  const codeRe = /^[a-z][a-z0-9_]*$/
  if (!input.code || !codeRe.test(input.code)) {
    errs.push('Code is verplicht en moet beginnen met een kleine letter; alleen kleine letters, cijfers en underscores (bv. q1_nps).')
  }
  const allowedTypes = ['nps', 'scale', 'choice', 'text', 'paragraph']
  if (!input.type || !allowedTypes.includes(input.type)) {
    errs.push(`Type moet één van zijn: ${allowedTypes.join(', ')}.`)
  }
  if (!input.label_nl || !input.label_nl.trim()) errs.push('Label NL is verplicht.')
  if (!input.label_en || !input.label_en.trim()) errs.push('Label EN is verplicht.')
  if (input.type === 'nps') {
    // NPS is conventioneel 0-10; auto-fill als de import ze weglaat.
    if (input.scale_min == null) input.scale_min = 0
    if (input.scale_max == null) input.scale_max = 10
    if (input.scale_min >= input.scale_max) {
      errs.push('scale_min moet kleiner zijn dan scale_max.')
    }
  } else if (input.type === 'scale') {
    if (input.scale_min == null || input.scale_max == null) {
      errs.push('Voor type scale zijn scale_min en scale_max verplicht.')
    } else if (input.scale_min >= input.scale_max) {
      errs.push('scale_min moet kleiner zijn dan scale_max.')
    }
  }
  if (input.type === 'choice') {
    const optsNl = input.options_nl || []
    const optsEn = input.options_en || []
    if (!Array.isArray(optsNl) || optsNl.length < 2) {
      errs.push('Voor type choice zijn minstens 2 opties (NL) verplicht.')
    }
    if (Array.isArray(optsNl) && Array.isArray(optsEn) && optsNl.length !== optsEn.length) {
      errs.push('Aantal opties NL en EN moet gelijk zijn.')
    }
  }
  if (input.conditional_on) {
    if (!input.conditional_on.field || !input.conditional_on.value) {
      errs.push('Conditional_on moet zowel field als value bevatten.')
    }
  }
  return errs
}

/** Insert a new question. Caller must validate first. */
export async function createQuestion(
  db: D1Database, input: QuestionInput,
): Promise<void> {
  await db.prepare(`
    INSERT INTO questions (
      code, type, category, required, scale_min, scale_max,
      label_nl, label_en, helper_nl, helper_en,
      min_label_nl, min_label_en, max_label_nl, max_label_en,
      options_nl, options_en, conditional_on
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    input.code,
    input.type,
    input.category ?? null,
    input.required ? 1 : 0,
    input.scale_min ?? null,
    input.scale_max ?? null,
    input.label_nl,
    input.label_en,
    input.helper_nl ?? null,
    input.helper_en ?? null,
    input.min_label_nl ?? null,
    input.min_label_en ?? null,
    input.max_label_nl ?? null,
    input.max_label_en ?? null,
    input.options_nl ? JSON.stringify(input.options_nl) : null,
    input.options_en ? JSON.stringify(input.options_en) : null,
    input.conditional_on ? JSON.stringify(input.conditional_on) : null,
  ).run()
}

/** Update an existing question (code is the immutable PK). */
export async function updateQuestion(
  db: D1Database, code: string, input: Omit<QuestionInput, 'code'>,
): Promise<void> {
  await db.prepare(`
    UPDATE questions SET
      type = ?, category = ?, required = ?,
      scale_min = ?, scale_max = ?,
      label_nl = ?, label_en = ?,
      helper_nl = ?, helper_en = ?,
      min_label_nl = ?, min_label_en = ?, max_label_nl = ?, max_label_en = ?,
      options_nl = ?, options_en = ?, conditional_on = ?
    WHERE code = ?
  `).bind(
    input.type,
    input.category ?? null,
    input.required ? 1 : 0,
    input.scale_min ?? null,
    input.scale_max ?? null,
    input.label_nl,
    input.label_en,
    input.helper_nl ?? null,
    input.helper_en ?? null,
    input.min_label_nl ?? null,
    input.min_label_en ?? null,
    input.max_label_nl ?? null,
    input.max_label_en ?? null,
    input.options_nl ? JSON.stringify(input.options_nl) : null,
    input.options_en ? JSON.stringify(input.options_en) : null,
    input.conditional_on ? JSON.stringify(input.conditional_on) : null,
    code,
  ).run()
}

/** Returns array of survey ids that use the given question code. */
export async function getSurveysUsingQuestion(
  db: D1Database, code: string,
): Promise<Array<{ id: number; title_nl: string; status: string }>> {
  // SQLite has json_each — but to stay portable we filter in JS after a coarse LIKE.
  const r = await db.prepare(
    `SELECT id, title_nl, status, question_codes FROM surveys WHERE question_codes LIKE ?`,
  ).bind(`%"${code}"%`).all<{ id: number; title_nl: string; status: string; question_codes: string }>()
  const out: Array<{ id: number; title_nl: string; status: string }> = []
  for (const row of r.results ?? []) {
    try {
      const arr = JSON.parse(row.question_codes)
      if (Array.isArray(arr) && arr.includes(code)) {
        out.push({ id: row.id, title_nl: row.title_nl, status: row.status })
      }
    } catch { /* skip */ }
  }
  return out
}

/** Delete a question. Caller is responsible for checking it's not in use. */
export async function deleteQuestion(db: D1Database, code: string): Promise<void> {
  await db.prepare('DELETE FROM questions WHERE code = ?').bind(code).run()
}

/** Bulk import: validate all rows, then upsert (replace existing by code). */
export async function importQuestions(
  db: D1Database, rows: QuestionInput[], mode: 'replace' | 'skip',
): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0, updated = 0, skipped = 0
  for (const row of rows) {
    const existing = await db.prepare('SELECT 1 FROM questions WHERE code = ?').bind(row.code).first()
    if (existing) {
      if (mode === 'skip') { skipped++; continue }
      await updateQuestion(db, row.code, row)
      updated++
    } else {
      await createQuestion(db, row)
      inserted++
    }
  }
  return { inserted, updated, skipped }
}

export async function getQuestionsForSurvey(db: D1Database, survey: Survey): Promise<LibraryQuestion[]> {
  // Reads from the per-survey SNAPSHOT (survey_questions), not from the library.
  // This guarantees that edits to a survey's questions only affect that survey,
  // and library edits never retroactively affect existing surveys.
  return listSurveyQuestions(db, survey.id) as unknown as Promise<LibraryQuestion[]>
}

// ============================================================
// SURVEY-SCOPED QUESTIONS (snapshot table `survey_questions`)
// Each survey owns its own immutable copy of question wording / scale / options.
// Editing a survey's question does NOT touch the library — that's the whole point.
// ============================================================

export type SurveyQuestion = LibraryQuestion & {
  survey_id: number
  display_order: number
  source_code: string | null   // original library code at snapshot time, NULL if survey-only custom
  snapshotted_at: string
}

type SurveyQuestionRow = Omit<SurveyQuestion, 'options_nl' | 'options_en' | 'conditional_on' | 'times_used' | 'last_used_at' | 'created_at'> & {
  options_nl: string | null
  options_en: string | null
  conditional_on: string | null
}

function rowToSurveyQuestion(r: SurveyQuestionRow): SurveyQuestion {
  const parseArr = (s: string | null): string[] | null => {
    if (!s) return null
    try { const a = JSON.parse(s); return Array.isArray(a) ? a : null } catch { return null }
  }
  let cond: { field: string; value: string } | null = null
  try {
    if (r.conditional_on) {
      const c = JSON.parse(r.conditional_on)
      if (c && typeof c === 'object') cond = { field: c.showField ?? c.field, value: c.whenValue ?? c.value }
    }
  } catch { cond = null }
  return {
    ...r,
    options_nl: parseArr(r.options_nl),
    options_en: parseArr(r.options_en),
    conditional_on: cond,
    // Library-only fields that views may reference — give safe defaults.
    times_used: 0,
    last_used_at: null,
    created_at: r.snapshotted_at,
  }
}

/** All questions for a given survey, in display order. */
export async function listSurveyQuestions(db: D1Database, surveyId: number): Promise<SurveyQuestion[]> {
  const r = await db.prepare(
    `SELECT survey_id, code, display_order, type, category, required, scale_min, scale_max,
            label_nl, label_en, helper_nl, helper_en,
            min_label_nl, min_label_en, max_label_nl, max_label_en,
            options_nl, options_en, conditional_on, source_code, snapshotted_at
       FROM survey_questions
      WHERE survey_id = ?
      ORDER BY display_order, code`,
  ).bind(surveyId).all<SurveyQuestionRow>()
  return (r.results ?? []).map(rowToSurveyQuestion)
}

/** Fetch one survey-scoped question. */
export async function getSurveyQuestion(
  db: D1Database, surveyId: number, code: string,
): Promise<SurveyQuestion | null> {
  const r = await db.prepare(
    `SELECT survey_id, code, display_order, type, category, required, scale_min, scale_max,
            label_nl, label_en, helper_nl, helper_en,
            min_label_nl, min_label_en, max_label_nl, max_label_en,
            options_nl, options_en, conditional_on, source_code, snapshotted_at
       FROM survey_questions
      WHERE survey_id = ? AND code = ?`,
  ).bind(surveyId, code).first<SurveyQuestionRow>()
  return r ? rowToSurveyQuestion(r) : null
}

/** Snapshot a library question into a survey (idempotent — INSERT OR IGNORE). */
export async function copyLibraryQuestionToSurvey(
  db: D1Database, surveyId: number, libraryCode: string, displayOrder?: number,
): Promise<{ inserted: boolean; code: string }> {
  const lib = await getLibraryQuestion(db, libraryCode)
  if (!lib) throw new Error(`Library question "${libraryCode}" not found.`)
  // If a question with the same code already exists in this survey, skip.
  const existing = await getSurveyQuestion(db, surveyId, libraryCode)
  if (existing) return { inserted: false, code: libraryCode }

  // Resolve display_order: append at the end unless explicitly provided.
  let order = displayOrder
  if (order == null) {
    const m = await db.prepare(
      `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM survey_questions WHERE survey_id = ?`,
    ).bind(surveyId).first<{ next_order: number }>()
    order = m?.next_order ?? 0
  }

  await db.prepare(
    `INSERT INTO survey_questions (
       survey_id, code, display_order, type, category, required, scale_min, scale_max,
       label_nl, label_en, helper_nl, helper_en,
       min_label_nl, min_label_en, max_label_nl, max_label_en,
       options_nl, options_en, conditional_on, source_code, snapshotted_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))`,
  ).bind(
    surveyId, lib.code, order, lib.type, lib.category, lib.required, lib.scale_min, lib.scale_max,
    lib.label_nl, lib.label_en, lib.helper_nl, lib.helper_en,
    lib.min_label_nl, lib.min_label_en, lib.max_label_nl, lib.max_label_en,
    lib.options_nl ? JSON.stringify(lib.options_nl) : null,
    lib.options_en ? JSON.stringify(lib.options_en) : null,
    lib.conditional_on ? JSON.stringify(lib.conditional_on) : null,
    lib.code,  // source_code = original library code
  ).run()
  return { inserted: true, code: lib.code }
}

/** Create a brand-new question directly inside a survey (not from library). */
export async function createSurveyQuestion(
  db: D1Database, surveyId: number, input: QuestionInput,
): Promise<void> {
  const existing = await getSurveyQuestion(db, surveyId, input.code)
  if (existing) throw new Error(`Een vraag met code "${input.code}" bestaat al in deze enquête.`)

  const m = await db.prepare(
    `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM survey_questions WHERE survey_id = ?`,
  ).bind(surveyId).first<{ next_order: number }>()
  const order = m?.next_order ?? 0

  await db.prepare(
    `INSERT INTO survey_questions (
       survey_id, code, display_order, type, category, required, scale_min, scale_max,
       label_nl, label_en, helper_nl, helper_en,
       min_label_nl, min_label_en, max_label_nl, max_label_en,
       options_nl, options_en, conditional_on, source_code, snapshotted_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NULL, datetime('now'))`,
  ).bind(
    surveyId, input.code, order, input.type, input.category ?? null,
    input.required ? 1 : 0, input.scale_min ?? null, input.scale_max ?? null,
    input.label_nl, input.label_en, input.helper_nl ?? null, input.helper_en ?? null,
    input.min_label_nl ?? null, input.min_label_en ?? null,
    input.max_label_nl ?? null, input.max_label_en ?? null,
    input.options_nl ? JSON.stringify(input.options_nl) : null,
    input.options_en ? JSON.stringify(input.options_en) : null,
    input.conditional_on ? JSON.stringify(input.conditional_on) : null,
  ).run()
}

/** Update an existing survey-scoped question (everything except code + survey_id). */
export async function updateSurveyQuestion(
  db: D1Database, surveyId: number, code: string, input: Omit<QuestionInput, 'code'>,
): Promise<void> {
  await db.prepare(
    `UPDATE survey_questions SET
       type = ?, category = ?, required = ?, scale_min = ?, scale_max = ?,
       label_nl = ?, label_en = ?, helper_nl = ?, helper_en = ?,
       min_label_nl = ?, min_label_en = ?, max_label_nl = ?, max_label_en = ?,
       options_nl = ?, options_en = ?, conditional_on = ?
     WHERE survey_id = ? AND code = ?`,
  ).bind(
    input.type, input.category ?? null,
    input.required ? 1 : 0, input.scale_min ?? null, input.scale_max ?? null,
    input.label_nl, input.label_en, input.helper_nl ?? null, input.helper_en ?? null,
    input.min_label_nl ?? null, input.min_label_en ?? null,
    input.max_label_nl ?? null, input.max_label_en ?? null,
    input.options_nl ? JSON.stringify(input.options_nl) : null,
    input.options_en ? JSON.stringify(input.options_en) : null,
    input.conditional_on ? JSON.stringify(input.conditional_on) : null,
    surveyId, code,
  ).run()
}

/** Remove a question from a single survey (does NOT touch the library). */
export async function deleteSurveyQuestion(
  db: D1Database, surveyId: number, code: string,
): Promise<void> {
  await db.prepare(
    `DELETE FROM survey_questions WHERE survey_id = ? AND code = ?`,
  ).bind(surveyId, code).run()
}

/** Re-order all questions of a survey from a given code list (in desired order). */
export async function reorderSurveyQuestions(
  db: D1Database, surveyId: number, orderedCodes: string[],
): Promise<void> {
  const stmts = orderedCodes.map((code, idx) =>
    db.prepare(`UPDATE survey_questions SET display_order = ? WHERE survey_id = ? AND code = ?`)
      .bind(idx, surveyId, code),
  )
  if (stmts.length > 0) await db.batch(stmts)
}

// ============================================================
// CREATE SURVEY — used by /admin/surveys/new
// ============================================================

/** URL-friendly slug: lowercase, ASCII, hyphens. */
export function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')      // strip diacritics (é → e)
    .replace(/['"`]/g, '')                 // drop quotes
    .replace(/[^a-z0-9]+/g, '-')           // non-alphanum → hyphen
    .replace(/^-+|-+$/g, '')               // trim hyphens
    .replace(/-{2,}/g, '-')                // collapse runs
    .slice(0, 80)
}

/** Returns slug if free, otherwise slug-2, slug-3, … (within the brand). */
export async function generateUniqueSlug(
  db: D1Database, brandId: string, base: string,
): Promise<string> {
  const seed = slugify(base) || 'enquete'
  let candidate = seed
  let n = 1
  // hard cap at 50 attempts to avoid runaway loops
  while (n < 50) {
    const exists = await db.prepare(
      'SELECT 1 FROM surveys WHERE brand_id = ? AND slug = ? LIMIT 1',
    ).bind(brandId, candidate).first<{ '1': number }>()
    if (!exists) return candidate
    n += 1
    candidate = `${seed}-${n}`
  }
  // fallback: timestamp suffix
  return `${seed}-${Date.now()}`
}

export type CreateSurveyInput = {
  brandId: string
  slug: string
  seriesName?: string | null
  artist?: string | null
  concertDate?: string | null   // ISO date "YYYY-MM-DD"
  location?: string | null
  titleNl: string
  titleEn?: string | null       // falls back to titleNl
  subtitleNl?: string | null
  subtitleEn?: string | null
  questionCodes: string[]
  status?: SurveyStatus         // defaults to 'open'
  langDefault?: 'nl' | 'en'     // defaults to 'nl'
  introNl?: string | null
  introEn?: string | null
  thanksNl?: string | null
  thanksEn?: string | null
}

/** Insert a survey. Returns the new id. Caller must validate inputs first. */
export async function createSurvey(
  db: D1Database, input: CreateSurveyInput,
): Promise<{ id: number; slug: string }> {
  const codesJson = JSON.stringify(input.questionCodes ?? [])
  const r = await db.prepare(`
    INSERT INTO surveys (
      brand_id, slug, series_name, artist, concert_date, location,
      title_nl, title_en, subtitle_nl, subtitle_en,
      status, lang_default, question_codes,
      intro_nl, intro_en, thanks_nl, thanks_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    input.brandId,
    input.slug,
    input.seriesName ?? null,
    input.artist ?? null,
    input.concertDate ?? null,
    input.location ?? null,
    input.titleNl,
    input.titleEn ?? input.titleNl,
    input.subtitleNl ?? null,
    input.subtitleEn ?? null,
    input.status ?? 'open',
    input.langDefault ?? 'nl',
    codesJson,
    input.introNl ?? null,
    input.introEn ?? null,
    input.thanksNl ?? null,
    input.thanksEn ?? null,
  ).run()

  // D1's meta.last_row_id is the new id
  const id = Number((r as any).meta?.last_row_id ?? 0)
  return { id, slug: input.slug }
}

// ============================================================
// UPDATE SURVEY — used by /admin/surveys/:id/edit
// ============================================================

export type UpdateSurveyInput = {
  // brand_id is intentionally NOT updatable: changing it would orphan responses
  // and break public URLs. If the user really needs to move a survey to another
  // brand, do it via the database console.
  slug: string
  seriesName?: string | null
  artist?: string | null
  concertDate?: string | null
  location?: string | null
  titleNl: string
  titleEn?: string | null
  subtitleNl?: string | null
  subtitleEn?: string | null
  questionCodes: string[]
  status?: SurveyStatus
  langDefault?: 'nl' | 'en'
  introNl?: string | null
  introEn?: string | null
  thanksNl?: string | null
  thanksEn?: string | null
}

/** Returns slug if free OR already belongs to surveyId, otherwise slug-2, slug-3, … */
export async function generateUniqueSlugForUpdate(
  db: D1Database, brandId: string, surveyId: number, base: string,
): Promise<string> {
  const seed = slugify(base) || 'enquete'
  let candidate = seed
  let n = 1
  while (n < 50) {
    const exists = await db.prepare(
      'SELECT id FROM surveys WHERE brand_id = ? AND slug = ? LIMIT 1',
    ).bind(brandId, candidate).first<{ id: number }>()
    if (!exists || exists.id === surveyId) return candidate
    n += 1
    candidate = `${seed}-${n}`
  }
  return `${seed}-${Date.now()}`
}

/** Update an existing survey. Caller must validate inputs first. */
export async function updateSurvey(
  db: D1Database, surveyId: number, input: UpdateSurveyInput,
): Promise<void> {
  const codesJson = JSON.stringify(input.questionCodes ?? [])
  await db.prepare(`
    UPDATE surveys SET
      slug = ?,
      series_name = ?,
      artist = ?,
      concert_date = ?,
      location = ?,
      title_nl = ?,
      title_en = ?,
      subtitle_nl = ?,
      subtitle_en = ?,
      status = ?,
      lang_default = ?,
      question_codes = ?,
      intro_nl = ?,
      intro_en = ?,
      thanks_nl = ?,
      thanks_en = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    input.slug,
    input.seriesName ?? null,
    input.artist ?? null,
    input.concertDate ?? null,
    input.location ?? null,
    input.titleNl,
    input.titleEn ?? input.titleNl,
    input.subtitleNl ?? null,
    input.subtitleEn ?? null,
    input.status ?? 'open',
    input.langDefault ?? 'nl',
    codesJson,
    input.introNl ?? null,
    input.introEn ?? null,
    input.thanksNl ?? null,
    input.thanksEn ?? null,
    surveyId,
  ).run()
}

// ============================================================
// DELETE + DUPLICATE SURVEY
// ============================================================

/**
 * Count non-soft-deleted responses for a survey.
 * Used to decide whether deletion should be blocked (and the user
 * advised to archive instead) or allowed.
 */
export async function getResponseCountForSurvey(
  db: D1Database, surveyId: number,
): Promise<number> {
  const r = await db.prepare(
    'SELECT COUNT(*) AS n FROM responses WHERE survey_id = ? AND deleted_at IS NULL',
  ).bind(surveyId).first<{ n: number }>()
  return Number(r?.n ?? 0)
}

/**
 * Hard-delete a survey. Caller MUST first check getResponseCountForSurvey() — if
 * there are still live responses, refuse and tell the admin to archive instead.
 * We also soft-deleted-tombstone any orphan responses (they were already
 * `deleted_at`-marked, but their survey_id is now dangling so we drop them too,
 * keeping the audit log intact via the separate audit_log table).
 */
export async function deleteSurvey(
  db: D1Database, surveyId: number,
): Promise<void> {
  // Hard-delete any soft-deleted responses for this survey (they're already gone
  // from public view; this just reclaims DB space).
  await db.prepare(
    'DELETE FROM responses WHERE survey_id = ? AND deleted_at IS NOT NULL',
  ).bind(surveyId).run()
  // Then the survey itself.
  await db.prepare('DELETE FROM surveys WHERE id = ?').bind(surveyId).run()
}

/**
 * Duplicate a survey: copies all fields, generates a fresh "<slug>-kopie"
 * unique slug, resets status to "closed" (so the new copy isn't accidentally
 * collecting responses before the admin has reviewed it).
 * Returns the new id + slug.
 */
export async function duplicateSurvey(
  db: D1Database, sourceId: number,
): Promise<{ id: number; slug: string }> {
  const source = await getSurveyById(db, sourceId)
  if (!source) throw new Error(`Survey ${sourceId} not found`)
  const baseSlug = `${source.slug}-kopie`
  const slug = await generateUniqueSlugForUpdate(db, source.brand_id, -1, baseSlug)
  return await createSurvey(db, {
    brandId: source.brand_id,
    slug,
    seriesName: source.series_name,
    artist: source.artist,
    concertDate: source.concert_date,
    location: source.location,
    titleNl: `${source.title_nl} (kopie)`,
    titleEn: source.title_en ? `${source.title_en} (copy)` : null,
    subtitleNl: source.subtitle_nl,
    subtitleEn: source.subtitle_en,
    status: 'closed', // start the copy closed — admin can flip to "open" after review
    langDefault: source.lang_default,
    questionCodes: source.question_codes,
    introNl: source.intro_nl,
    introEn: source.intro_en,
    thanksNl: source.thanks_nl,
    thanksEn: source.thanks_en,
  })
}
