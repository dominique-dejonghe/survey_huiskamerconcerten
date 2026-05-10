import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { SurveyPage, ThanksPage, PrivacyPage } from './views/survey'
import { LandingPage } from './views/landing'
import { LoginPage, DashboardPage, AdminOverviewPage, NewSurveyPage } from './views/admin'
import { responseSchema } from './lib/validation'
import { hashIp } from './lib/crypto'
import {
  insertResponse, listResponses, deleteAllResponses,
  logAudit, checkRateLimit, softDeleteResponse,
} from './lib/db'
import { computeStats } from './lib/stats'
import { rowsToCsv, rowsToJson } from './lib/csv'
import { buildSurveyDocx } from './lib/docx-report'
import {
  type Bindings,
  createAdminSession, clearAdminSession, getAdminSession,
  requireAdmin, checkAdminCredentials,
} from './lib/auth'
import { sendNewResponseNotification } from './lib/email'
import {
  generateAnalysis, getCachedAnalysis, saveCachedAnalysis, clearCachedAnalysis,
} from './lib/ai'
import {
  listBrands, listSurveys, listSurveysWithStats,
  getBrandByPrefix, getSurveyBySlug, getSurveyById,
  listLibraryQuestions, createSurvey, slugify, generateUniqueSlug,
} from './lib/surveys'
import type { Lang } from './lib/i18n'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())

// Stricter CSP for public routes
app.use('*', async (c, next) => {
  const path = c.req.path
  const isAdmin = path.startsWith('/admin') || path.startsWith('/api/admin')
  const csp = isAdmin
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
    : [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
  c.header('Content-Security-Policy', csp)
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  await next()
})
app.use('/api/*', cors({ origin: (o) => o ?? '*', credentials: true }))

// ----- Helpers -----
function getClientIp(c: any): string {
  return c.req.header('cf-connecting-ip')
    || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || '0.0.0.0'
}

async function adminSurveyId(c: any): Promise<number> {
  const raw = c.req.query('survey')
  const id = raw ? parseInt(raw, 10) : NaN
  if (Number.isFinite(id) && id > 0) {
    const s = await getSurveyById(c.env.DB, id)
    if (s) return s.id
  }
  return 1 // backwards-compatible default
}

// ============================================================
// LANDING + LEGACY REDIRECTS
// ============================================================
app.get('/', async (c) => {
  const surveys = await listSurveysWithStats(c.env.DB, { status: 'open' })
  const brands = await listBrands(c.env.DB)
  return c.html(<LandingPage lang="nl" surveys={surveys} brands={brands} />)
})
app.get('/en', async (c) => {
  const surveys = await listSurveysWithStats(c.env.DB, { status: 'open' })
  const brands = await listBrands(c.env.DB)
  return c.html(<LandingPage lang="en" surveys={surveys} brands={brands} />)
})

// Legacy redirects: keep old links to Reeks I working
app.get('/dank-je', (c) => c.html(<ThanksPage lang="nl" />))
app.get('/privacy', (c) => c.html(<PrivacyPage lang="nl" />))
app.get('/thank-you', (c) => c.html(<ThanksPage lang="en" />))
app.get('/en/privacy', (c) => c.html(<PrivacyPage lang="en" />))
app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

// ============================================================
// PUBLIC SURVEY ROUTES — /h/:slug and /e/:slug (NL + EN)
// ============================================================
async function renderSurveyForSlug(c: any, prefix: string, slug: string, lang: Lang) {
  const brand = await getBrandByPrefix(c.env.DB, prefix)
  if (!brand) return c.notFound()
  const survey = await getSurveyBySlug(c.env.DB, prefix, slug)
  if (!survey) return c.notFound()
  if (survey.status !== 'open') {
    // Could render a "closed" page; for now redirect to landing
    return c.redirect(lang === 'en' ? '/en' : '/')
  }
  return c.html(<SurveyPage lang={lang} brand={brand} survey={survey} />)
}

app.get('/:prefix{[he]}/:slug', async (c) => {
  return renderSurveyForSlug(c, c.req.param('prefix'), c.req.param('slug'), 'nl')
})
app.get('/:prefix{[he]}/:slug/en', async (c) => {
  return renderSurveyForSlug(c, c.req.param('prefix'), c.req.param('slug'), 'en')
})
app.get('/:prefix{[he]}/:slug/dank-je', async (c) => {
  const brand = await getBrandByPrefix(c.env.DB, c.req.param('prefix'))
  const survey = await getSurveyBySlug(c.env.DB, c.req.param('prefix'), c.req.param('slug'))
  if (!brand || !survey) return c.notFound()
  return c.html(<ThanksPage lang="nl" brand={brand} survey={survey} />)
})
app.get('/:prefix{[he]}/:slug/thank-you', async (c) => {
  const brand = await getBrandByPrefix(c.env.DB, c.req.param('prefix'))
  const survey = await getSurveyBySlug(c.env.DB, c.req.param('prefix'), c.req.param('slug'))
  if (!brand || !survey) return c.notFound()
  return c.html(<ThanksPage lang="en" brand={brand} survey={survey} />)
})

// ============================================================
// API: SUBMIT RESPONSE
// ============================================================
app.post('/api/responses', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid_json' }, 400) }

  const parsed = responseSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      error: 'validation_failed',
      details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    }, 400)
  }

  const data = parsed.data as any
  if ((data.website ?? '').trim().length > 0) {
    return c.json({ error: 'spam_detected' }, 400)
  }

  // Resolve survey by id (preferred) or by slug (fallback). Default to 1 for backwards compat.
  let surveyId = 1
  if (typeof data.survey_id === 'number' && data.survey_id > 0) {
    const s = await getSurveyById(c.env.DB, data.survey_id)
    if (s) surveyId = s.id
  } else if (typeof data.brand_prefix === 'string' && typeof data.survey_slug === 'string') {
    const s = await getSurveyBySlug(c.env.DB, data.brand_prefix, data.survey_slug)
    if (s) surveyId = s.id
  }

  // Verify survey is open
  const survey = await getSurveyById(c.env.DB, surveyId)
  if (!survey) return c.json({ error: 'unknown_survey' }, 400)
  if (survey.status !== 'open') return c.json({ error: 'survey_closed' }, 403)

  const ip = getClientIp(c)
  const salt = c.env.IP_HASH_SALT || 'dev-salt-change-me'
  const ipHash = await hashIp(ip, salt)
  const userAgent = c.req.header('user-agent') ?? ''

  const rl = await checkRateLimit(c.env.DB, ipHash, 3)
  if (!rl.ok) {
    await logAudit(c.env.DB, 'rate_limited', ipHash, { current: rl.current, surveyId })
    return c.json({ error: 'rate_limited', message: 'Maximum 3 inzendingen per uur.' }, 429)
  }

  const id = await insertResponse(c.env.DB, parsed.data, { ipHash, userAgent, surveyId })
  await logAudit(c.env.DB, 'response_submitted', ipHash, { id, nps: data.q1_nps, surveyId })

  const url = new URL(c.req.url)
  const siteUrl = `${url.protocol}//${url.host}`
  c.executionCtx.waitUntil(
    sendNewResponseNotification(c.env, {
      id,
      nps: data.q1_nps,
      aantal: data.q3_aantal,
      wensen: data.q15_wensen_2 ?? '',
      siteUrl,
    }).then((res) => logAudit(c.env.DB, 'email_attempt', ipHash, { id, surveyId, ...res }))
  )

  return c.json({ ok: true, id, surveyId }, 201)
})

// ============================================================
// ADMIN: LOGIN / LOGOUT
// ============================================================
app.get('/admin/login', async (c) => {
  const s = await getAdminSession(c)
  if (s) return c.redirect('/admin')
  const err = c.req.query('error')
  return c.html(<LoginPage error={err === 'invalid' ? 'Ongeldige combinatie van e-mail en wachtwoord.' : undefined} />)
})

app.post('/admin/login', async (c) => {
  const form = await c.req.parseBody()
  const email = String(form.email || '')
  const password = String(form.password || '')
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')

  const ok = await checkAdminCredentials(email, password, c.env.ADMIN_EMAIL || '', c.env.ADMIN_PASSWORD || '')
  if (!ok) {
    await logAudit(c.env.DB, 'login_fail', ipHash, { email })
    return c.redirect('/admin/login?error=invalid')
  }
  await createAdminSession(c, email)
  await logAudit(c.env.DB, 'login_success', ipHash, { email })
  return c.redirect('/admin')
})

app.get('/admin/logout', async (c) => {
  clearAdminSession(c)
  return c.redirect('/admin/login')
})

// ============================================================
// ADMIN: OVERVIEW (all surveys) + per-survey dashboard
// ============================================================
app.get('/admin', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveys = await listSurveysWithStats(c.env.DB, { status: 'all' })
  const brands = await listBrands(c.env.DB)
  return c.html(<AdminOverviewPage surveys={surveys} brands={brands} />)
})

// New-survey form (must come BEFORE /:id to avoid 'new' being parsed as id)
app.get('/admin/surveys/new', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const brands = await listBrands(c.env.DB)
  const questions = await listLibraryQuestions(c.env.DB)
  const surveys = await listSurveys(c.env.DB, {})
  const error = c.req.query('error') || ''
  return c.html(<NewSurveyPage brands={brands} questions={questions} surveys={surveys} error={error} />)
})

// JSON: check whether a slug is free for a given brand (live form validation)
app.get('/api/admin/check-slug', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const brandId = c.req.query('brand') || ''
  const raw = c.req.query('slug') || ''
  const slug = slugify(raw)
  if (!brandId || !slug) return c.json({ ok: false, free: false, slug, reason: 'missing' })
  const exists = await c.env.DB.prepare(
    'SELECT 1 FROM surveys WHERE brand_id = ? AND slug = ? LIMIT 1',
  ).bind(brandId, slug).first()
  return c.json({ ok: true, free: !exists, slug })
})

// Submit: create survey + redirect to its dashboard
app.post('/admin/surveys', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard

  const form = await c.req.formData()
  const get = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v.trim() : ''
  }
  const getAll = (k: string) => form.getAll(k).filter((v): v is string => typeof v === 'string')

  const brandId = get('brand_id')
  const titleNl = get('title_nl')
  const titleEn = get('title_en')
  const slugRaw = get('slug')
  const seriesName = get('series_name')
  const artist = get('artist')
  const concertDate = get('concert_date')
  const location = get('location')
  const subtitleNl = get('subtitle_nl')
  const subtitleEn = get('subtitle_en')
  const status = (get('status') || 'open') as 'open' | 'closed' | 'archived'
  const langDefault = (get('lang_default') || 'nl') as 'nl' | 'en'
  const codes = getAll('question_codes')

  // ----- Validation -----
  const errs: string[] = []
  if (!brandId) errs.push('Kies een merk.')
  if (!titleNl) errs.push('Titel (NL) is verplicht.')
  if (codes.length === 0) errs.push('Selecteer minstens één vraag.')
  if (status !== 'open' && status !== 'closed' && status !== 'archived') errs.push('Ongeldige status.')
  // verify brand exists
  const brand = brandId
    ? await c.env.DB.prepare('SELECT id FROM brands WHERE id = ?').bind(brandId).first()
    : null
  if (brandId && !brand) errs.push('Onbekend merk.')
  // verify question codes exist
  if (codes.length > 0) {
    const placeholders = codes.map(() => '?').join(',')
    const found = await c.env.DB
      .prepare(`SELECT code FROM questions WHERE code IN (${placeholders})`)
      .bind(...codes).all<{ code: string }>()
    const foundSet = new Set((found.results ?? []).map(r => r.code))
    const missing = codes.filter(c => !foundSet.has(c))
    if (missing.length > 0) errs.push(`Onbekende vragen: ${missing.join(', ')}`)
  }

  if (errs.length > 0) {
    return c.redirect('/admin/surveys/new?error=' + encodeURIComponent(errs.join(' · ')))
  }

  // Slug: use what user typed (slugified), or auto-generate from title
  const seedSlug = slugRaw || titleNl
  let finalSlug = slugify(seedSlug) || 'enquete'
  // If duplicate, fall back to unique slug (server safety net)
  const dupe = await c.env.DB
    .prepare('SELECT 1 FROM surveys WHERE brand_id = ? AND slug = ? LIMIT 1')
    .bind(brandId, finalSlug).first()
  if (dupe) {
    finalSlug = await generateUniqueSlug(c.env.DB, brandId, seedSlug)
  }

  const created = await createSurvey(c.env.DB, {
    brandId,
    slug: finalSlug,
    seriesName: seriesName || null,
    artist: artist || null,
    concertDate: concertDate || null,
    location: location || null,
    titleNl,
    titleEn: titleEn || titleNl,
    subtitleNl: subtitleNl || null,
    subtitleEn: subtitleEn || null,
    questionCodes: codes,
    status,
    langDefault,
  })

  // Audit log
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'survey_create', ipHash, {
    surveyId: created.id, brandId, slug: created.slug, questionCount: codes.length,
  })

  return c.redirect(`/admin/surveys/${created.id}?created=1`)
})

app.get('/admin/surveys/:id', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id) || id <= 0) return c.notFound()
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()
  return c.html(<DashboardPage survey={survey} />)
})

// ============================================================
// API: ADMIN
// ============================================================
app.get('/api/admin/surveys', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveys = await listSurveysWithStats(c.env.DB, { status: 'all' })
  c.header('Cache-Control', 'private, max-age=15')
  return c.json({ surveys })
})

app.get('/api/admin/responses', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const rows = await listResponses(c.env.DB, surveyId)
  const stats = computeStats(rows)
  c.header('Cache-Control', 'private, max-age=30')
  return c.json({ responses: rows, stats, surveyId })
})

app.get('/api/admin/export', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const survey = await getSurveyById(c.env.DB, surveyId)
  const fmtRaw = c.req.query('format')
  const format: 'csv' | 'json' | 'docx' =
    fmtRaw === 'json' ? 'json' : fmtRaw === 'docx' ? 'docx' : 'csv'
  const rows = await listResponses(c.env.DB, surveyId)

  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, `export_${format}`, ipHash, { count: rows.length, surveyId })

  const today = new Date().toISOString().slice(0, 10)
  const slug = survey?.slug ?? 'survey'
  const fileBase = `${slug}-${today}`

  if (format === 'csv') {
    const csv = rowsToCsv(rows)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileBase}.csv"`,
      },
    })
  }

  if (format === 'json') {
    const json = rowsToJson(rows)
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileBase}.json"`,
      },
    })
  }

  const lang: Lang = c.req.query('lang') === 'en' ? 'en' : 'nl'
  const analysis = await getCachedAnalysis(c.env.DB, lang, surveyId)
  const buffer = await buildSurveyDocx(rows, analysis, lang, survey ?? undefined)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileBase}.docx"`,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'no-store',
    },
  })
})

app.delete('/api/admin/responses/:id', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = c.req.param('id')
  await softDeleteResponse(c.env.DB, id)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'delete_response', ipHash, { id })
  return c.json({ ok: true })
})

app.delete('/api/admin/responses', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const deleted = await deleteAllResponses(c.env.DB, surveyId)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'delete_all', ipHash, { deleted, surveyId })
  return c.json({ ok: true, deleted })
})

// ============================================================
// API: AI ANALYSIS (per survey)
// ============================================================
app.get('/api/admin/analyze', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const lang: Lang = c.req.query('lang') === 'en' ? 'en' : 'nl'
  const cached = await getCachedAnalysis(c.env.DB, lang, surveyId)
  if (!cached) return c.json({ cached: false, analysis: null }, 200)
  return c.json({ cached: true, analysis: cached })
})

app.post('/api/admin/analyze', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const lang: Lang = c.req.query('lang') === 'en' ? 'en' : 'nl'
  const force = c.req.query('force') === '1'

  if (!force) {
    const cached = await getCachedAnalysis(c.env.DB, lang, surveyId)
    if (cached) return c.json({ cached: true, analysis: cached })
  }

  const rows = await listResponses(c.env.DB, surveyId)
  if (rows.length === 0) {
    return c.json({ error: 'no_data', message: 'Geen responses om te analyseren.' }, 400)
  }

  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  try {
    const result = await generateAnalysis(
      {
        AI: c.env.AI,
        DB: c.env.DB,
        OPENAI_API_KEY: c.env.OPENAI_API_KEY,
        OPENAI_MODEL: c.env.OPENAI_MODEL,
      },
      rows,
      lang,
    )
    await saveCachedAnalysis(c.env.DB, lang, result, surveyId)
    await logAudit(c.env.DB, 'ai_analyze', ipHash, { lang, count: rows.length, provider: result.provider, surveyId })
    return c.json({ cached: false, analysis: result })
  } catch (e: any) {
    console.error('AI analyze error:', e)
    await logAudit(c.env.DB, 'ai_analyze_fail', ipHash, { lang, error: String(e?.message ?? e).slice(0, 300), surveyId })
    return c.json({ error: 'ai_failed', message: e?.message ?? 'AI-analyse mislukt' }, 500)
  }
})

app.delete('/api/admin/analyze', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const lang = c.req.query('lang') as Lang | undefined
  await clearCachedAnalysis(c.env.DB, lang === 'nl' || lang === 'en' ? lang : undefined, surveyId)
  return c.json({ ok: true })
})

// ============================================================
// 404 / error
// ============================================================
app.notFound((c) => c.json({ error: 'not_found' }, 404))

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'server_error', message: err.message }, 500)
})

export default app
