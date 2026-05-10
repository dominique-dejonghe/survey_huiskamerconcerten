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

export async function getQuestionsForSurvey(db: D1Database, survey: Survey): Promise<LibraryQuestion[]> {
  if (survey.question_codes.length === 0) return []
  // SQLite IN (?, ?, ...) — keep order via in-memory sort
  const placeholders = survey.question_codes.map(() => '?').join(',')
  const r = await db.prepare(`SELECT * FROM questions WHERE code IN (${placeholders})`)
    .bind(...survey.question_codes).all<LibraryQuestionRow>()
  const byCode = new Map<string, LibraryQuestion>()
  for (const row of r.results ?? []) {
    const q = rowToQuestion(row)
    byCode.set(q.code, q)
  }
  return survey.question_codes.map(c => byCode.get(c)).filter((q): q is LibraryQuestion => Boolean(q))
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
